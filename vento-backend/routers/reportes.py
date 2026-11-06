from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from io import BytesIO

from database import get_db
from routers.auth import get_current_user, require_role

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

router = APIRouter(
    prefix="/api/reportes",
    tags=["Reportes"],
    dependencies=[Depends(get_current_user), Depends(require_role(["ADMINISTRADOR", "GERENCIA"]))]
)

@router.get("/kardex/excel")
def descargar_reporte_kardex_excel(db: Session = Depends(get_db)):
    """Genera un reporte de movimientos del Kardex en Excel"""
    query = text("""
        SELECT 
            m.fecha,
            p.sku,
            p.nombre as producto,
            m.tipo_movimiento,
            m.cantidad,
            m.costo_unitario,
            u.nombre_completo as usuario
        FROM movimientos_inventario m
        JOIN productos p ON m.id_producto = p.id_producto
        LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario
        ORDER BY m.fecha DESC
    """)
    resultados = db.execute(query).mappings().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Kardex Movimientos"

    # Encabezados
    headers = ["Fecha", "SKU", "Producto", "Tipo", "Cantidad", "Costo Unit. (S/)", "Usuario"]
    ws.append(headers)

    # Estilos
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="4F81BD")

    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for row in resultados:
        ws.append([
            row["fecha"].strftime("%Y-%m-%d %H:%M:%S") if row["fecha"] else "",
            row["sku"],
            row["producto"],
            row["tipo_movimiento"],
            float(row["cantidad"]),
            float(row["costo_unitario"]) if row["costo_unitario"] else 0.0,
            row["usuario"] or "-"
        ])

    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter 
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = (max_length + 2)
        ws.column_dimensions[column].width = adjusted_width

    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)

    return StreamingResponse(
        stream, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=reporte_kardex.xlsx"}
    )

@router.get("/inventario/pdf")
def descargar_reporte_inventario_pdf(db: Session = Depends(get_db)):
    """Genera un reporte del estado de inventario en PDF"""
    query = text("""
        SELECT 
            p.sku, 
            p.nombre as producto, 
            v.stock_actual, 
            v.stock_disponible,
            p.costo_promedio_pen,
            c.categoria as abc
        FROM v_stock_disponible v
        JOIN productos p ON v.id_producto = p.id_producto
        LEFT JOIN v_clasificacion_abc_vigente c ON p.id_producto = c.id_producto
        ORDER BY p.nombre ASC
    """)
    resultados = db.execute(query).mappings().all()

    stream = BytesIO()
    doc = SimpleDocTemplate(stream, pagesize=landscape(A4), title="Reporte de Inventario")
    elements = []
    
    styles = getSampleStyleSheet()
    title = Paragraph("<b>Reporte de Inventario y Valorización</b>", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 20))

    data = [["SKU", "Producto", "Stock Físico", "Stock Disp.", "Costo Prom (S/)", "ABC"]]
    
    for row in resultados:
        data.append([
            row["sku"],
            row["producto"],
            str(row["stock_actual"]),
            str(row["stock_disponible"]),
            f"S/ {float(row['costo_promedio_pen'] or 0):.2f}",
            row["abc"] or "-"
        ])

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4F81BD")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F2F2F2")),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.white)
    ]))

    elements.append(table)
    doc.build(elements)
    
    stream.seek(0)
    
    return StreamingResponse(
        stream,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=reporte_inventario.pdf"}
    )
