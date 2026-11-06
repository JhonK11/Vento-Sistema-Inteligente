from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from routers.auth import get_current_user, require_role
from schemas.ventas import VentaCreate
from services.ventas import guardar_venta
from services.consulta_ventas import consultar_venta, acceso_ventas, VENTA_SELECT
from datetime import date, datetime, timedelta
from typing import Literal
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A6
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

router = APIRouter(dependencies=[Depends(get_current_user)])
lectura = [Depends(require_role(['ADMINISTRADOR','GERENCIA','VENTAS']))]

@router.post("/api/ventas", dependencies=[Depends(require_role(['ADMINISTRADOR','VENTAS']))])
def registrar_venta(venta: VentaCreate, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    return guardar_venta(db, venta, current_user['user'])


@router.get('/api/ventas', dependencies=lectura)
def historial_ventas(fecha_desde: date | None = None, fecha_hasta: date | None = None,
    buscar: str = Query('', max_length=100), metodo: Literal['EFECTIVO','TARJETA','TRANSFERENCIA','CREDITO','OTRO'] | None = None,
    estado: Literal['EMITIDA','ANULADA'] | None = None, cajero_id: int | None = Query(None, gt=0),
    turno_id: int | None = Query(None, gt=0), pagina: int = Query(1, ge=1), tamanio: int = Query(20, ge=1, le=100),
    current=Depends(get_current_user), db: Session = Depends(get_db)):
    if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
        raise HTTPException(400, 'La fecha inicial debe ser anterior a la fecha final.')
    acceso, params = acceso_ventas(current['user'])
    filtros = [acceso]
    if fecha_desde:
        filtros.append('v.fecha>=:desde'); params['desde'] = datetime.combine(fecha_desde, datetime.min.time())
    if fecha_hasta:
        filtros.append('v.fecha<:hasta'); params['hasta'] = datetime.combine(fecha_hasta + timedelta(days=1), datetime.min.time())
    if buscar.strip():
        filtros.append('(v.numero_venta LIKE :buscar OR c.nombre_razon_social LIKE :buscar OR c.numero_documento LIKE :buscar)')
        params['buscar'] = '%' + buscar.strip() + '%'
    for columna, valor in [('metodo_pago',metodo),('estado',estado),('id_usuario',cajero_id),('id_turno',turno_id)]:
        if valor is not None:
            filtros.append(f'v.{columna}=:{columna}'); params[columna] = valor
    where = ' WHERE ' + ' AND '.join(filtros)
    base = ' FROM ventas v LEFT JOIN clientes c ON c.id_cliente=v.id_cliente'
    resumen = db.execute(text('''SELECT COUNT(*) AS registros,
        COALESCE(SUM(CASE WHEN v.estado='EMITIDA' THEN v.total ELSE 0 END),0) AS ventas_emitidas,
        COALESCE(SUM(CASE WHEN v.estado='EMITIDA' AND v.metodo_pago='EFECTIVO' THEN v.total ELSE 0 END),0) AS efectivo,
        COALESCE(SUM(CASE WHEN v.id_turno IS NULL THEN 1 ELSE 0 END),0) AS sin_turno''' + base + where), params).mappings().one()
    items = db.execute(text(VENTA_SELECT + where + ' ORDER BY v.fecha DESC,v.id_venta DESC LIMIT :limite OFFSET :offset'),
                       {**params, 'limite': tamanio, 'offset': (pagina-1)*tamanio}).mappings().all()
    # El hash es interno; no forma parte del historial presentado al usuario.
    filas = [{k: v for k, v in fila.items() if k != 'solicitud_hash'} for fila in items]
    return {'items': filas, 'total': resumen['registros'], 'pagina': pagina, 'tamanio': tamanio, 'resumen': dict(resumen)}


@router.get('/api/ventas/{id_venta}', dependencies=lectura)
def detalle_venta(id_venta: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    venta = consultar_venta(db, id_venta, current['user'])
    venta.pop('solicitud_hash', None)
    return venta

@router.get("/api/ventas/{id_venta}/ticket-pdf", dependencies=lectura)
def descargar_ticket_venta_pdf(id_venta: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    """Genera un comprobante / ticket de venta en PDF estilo térmico (A6)"""
    acceso, params = acceso_ventas(current['user'])
    venta_query = text("""
        SELECT 
            v.id_venta,
            v.numero_venta,
            v.fecha,
            v.metodo_pago,
            v.subtotal,
            v.descuento,
            v.impuesto,
            v.total,
            v.estado,
            v.id_turno, v.monto_recibido, v.vuelto,
            c.nombre_razon_social as cliente_nombre,
            c.tipo_documento as cliente_tipo_doc,
            c.numero_documento as cliente_doc,
            u.nombre_completo as cajero_nombre,
            a.nombre as almacen_nombre
        FROM ventas v
        LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
        LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
        LEFT JOIN almacenes a ON v.id_almacen = a.id_almacen
        WHERE v.id_venta = :vid AND """ + acceso)
    venta = db.execute(venta_query, {**params, "vid": id_venta}).mappings().first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    detalle_query = text("""
        SELECT 
            vd.cantidad,
            vd.precio_unitario,
            (vd.cantidad * vd.precio_unitario) as subtotal_item,
            COALESCE(vd.producto_nombre,p.nombre) as producto,
            COALESCE(vd.producto_sku,p.sku) as sku
        FROM ventas_detalle vd
        JOIN productos p ON vd.id_producto = p.id_producto
        WHERE vd.id_venta = :vid
    """)
    items = db.execute(detalle_query, {"vid": id_venta}).mappings().all()

    stream = BytesIO()
    doc = SimpleDocTemplate(
        stream, 
        pagesize=A6,
        leftMargin=15, 
        rightMargin=15, 
        topMargin=15, 
        bottomMargin=15
    )
    elements = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('TitleStyle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=13, alignment=1, spaceAfter=2)
    center_style = ParagraphStyle('CenterStyle', parent=styles['Normal'], fontName='Helvetica', fontSize=8, alignment=1)
    bold_style = ParagraphStyle('BoldStyle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8)
    normal_style = ParagraphStyle('NormalStyle', parent=styles['Normal'], fontName='Helvetica', fontSize=8)

    elements.append(Paragraph("<b>VENTO LOGÍSTICA & POS</b>", title_style))
    elements.append(Paragraph("RUC: 20608974512 • Puno, Perú", center_style))
    elements.append(Paragraph("ventas@vento.pe", center_style))
    elements.append(Spacer(1, 6))

    elements.append(Paragraph(f"<b>COMPROBANTE: {escape(venta['numero_venta'])}</b>", ParagraphStyle('Comp', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, alignment=1)))
    if venta['estado'] == 'ANULADA':
        elements.append(Paragraph('<b>VENTA ANULADA</b>', center_style))
    elements.append(Spacer(1, 4))

    fecha = datetime.fromisoformat(venta['fecha']) if isinstance(venta['fecha'], str) else venta['fecha']
    fecha_str = fecha.strftime("%d/%m/%Y %H:%M") if fecha else ""
    info_data = [
        [Paragraph("<b>Fecha:</b>", bold_style), Paragraph(fecha_str, normal_style)],
        [Paragraph("<b>Cajero:</b>", bold_style), Paragraph(escape(venta['cajero_nombre'] or "General"), normal_style)],
        [Paragraph("<b>Almacén:</b>", bold_style), Paragraph(escape(venta['almacen_nombre'] or "-"), normal_style)],
        [Paragraph(f"<b>Cliente ({venta['cliente_tipo_doc'] or 'DOC'}):</b>", bold_style), Paragraph(escape(f"{venta['cliente_doc'] or ''} - {venta['cliente_nombre'] or 'Cliente General'}"), normal_style)],
        [Paragraph("<b>Método Pago:</b>", bold_style), Paragraph(venta['metodo_pago'], normal_style)]
    ]
    t_info = Table(info_data, colWidths=[70, 185])
    t_info.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('TOPPADDING', (0,0), (-1,-1), 1)
    ]))
    elements.append(t_info)
    elements.append(Spacer(1, 6))

    items_data = [["Cant", "Descripción", "P.Unit", "Total"]]
    for item in items:
        cant_str = f"{int(item['cantidad']) if float(item['cantidad']).is_integer() else item['cantidad']}"
        items_data.append([
            cant_str,
            Paragraph(f"<b>{escape(item['producto'])}</b>", normal_style),
            f"S/ {float(item['precio_unitario']):.2f}",
            f"S/ {float(item['subtotal_item']):.2f}"
        ])

    t_items = Table(items_data, colWidths=[25, 130, 45, 55])
    t_items.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('LINEBELOW', (0,0), (-1,0), 1, colors.black),
        ('LINEBELOW', (0,-1), (-1,-1), 1, colors.black),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
    ]))
    elements.append(t_items)
    elements.append(Spacer(1, 5))

    totales_data = [
        ["Subtotal:", f"S/ {float(venta['subtotal']):.2f}"],
        ["Descuento:", f"S/ {float(venta['descuento']):.2f}"],
        ["Impuesto:", f"S/ {float(venta['impuesto']):.2f}"],
        ["TOTAL A PAGAR:", f"S/ {float(venta['total']):.2f}"]
    ]
    t_totales = Table(totales_data, colWidths=[175, 80])
    t_totales.setStyle(TableStyle([
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,-1), (-1,-1), 9),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.5),
        ('TOPPADDING', (0,0), (-1,-1), 1.5),
    ]))
    elements.append(t_totales)
    if venta['monto_recibido'] is not None:
        elements.append(Paragraph(f"Efectivo recibido: S/ {float(venta['monto_recibido']):.2f} · Vuelto: S/ {float(venta['vuelto'] or 0):.2f}", normal_style))
    if venta['id_turno']:
        elements.append(Paragraph(f"Turno de caja: {venta['id_turno']}", normal_style))
    elements.append(Spacer(1, 8))

    elements.append(Paragraph("¡Gracias por su compra!", ParagraphStyle('Bye', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, alignment=1)))
    elements.append(Paragraph("Conserve este comprobante para cualquier garantía.", center_style))

    doc.build(elements)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=ticket_{id_venta}.pdf"}
    )

