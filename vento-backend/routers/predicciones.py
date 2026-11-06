from datetime import date, timedelta
from statistics import NormalDist
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from database import get_db
from routers.auth import require_role
from services.abastecimiento import fecha_corte_local, politica_reposicion, pronosticar, serie_diaria

router = APIRouter(
    prefix="/api/predicciones", tags=["Predicciones ARIMA & Logística"],
    dependencies=[Depends(require_role(["ADMINISTRADOR", "GERENCIA", "ALMACEN", "COMPRAS"]))],
)

# Agregar cada relación antes de unirla evita multiplicar stock o ventas.
# Si hay varios proveedores principales, elegir uno de forma determinista.
PRODUCTOS_SQL = """
    SELECT p.id_producto, p.sku, p.nombre, p.fecha_creacion, p.costo_promedio_pen,
           COALESCE(p.peso_kg, 0) AS peso_kg, COALESCE(p.volumen_m3, 0) AS volumen_m3,
           c.nombre AS categoria,
           COALESCE(inv.stock_actual, 0) AS stock_actual,
           COALESCE(inv.stock_disponible, 0) AS stock_disponible,
           COALESCE(pp.tiempo_entrega_dias, prov.tiempo_entrega_dias_prom, 7) AS tiempo_entrega_dias,
           prov.id_proveedor, COALESCE(prov.razon_social, 'Sin proveedor principal') AS proveedor_principal
    FROM productos p
    LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
    LEFT JOIN (
        SELECT id_producto, SUM(stock_actual) AS stock_actual,
               SUM(stock_actual - stock_reservado) AS stock_disponible
        FROM inventario GROUP BY id_producto
    ) inv ON inv.id_producto = p.id_producto
    LEFT JOIN producto_proveedor pp ON pp.id_producto = p.id_producto
        AND pp.id_proveedor = (
            SELECT MIN(pp2.id_proveedor) FROM producto_proveedor pp2
            JOIN proveedores pr2 ON pr2.id_proveedor = pp2.id_proveedor AND pr2.estado = 1
            WHERE pp2.id_producto = p.id_producto AND pp2.es_principal = 1
        )
    LEFT JOIN proveedores prov ON prov.id_proveedor = pp.id_proveedor
"""


@router.get("/productos")
def listar_productos_para_prediccion(db: Session = Depends(get_db)):
    query = PRODUCTOS_SQL.replace(
        "SELECT p.id_producto", "SELECT COALESCE(vt.total_vendido, 0) AS total_vendido, p.id_producto", 1
    ) + """
        LEFT JOIN (
            SELECT vd.id_producto, SUM(vd.cantidad) AS total_vendido
            FROM ventas_detalle vd JOIN ventas v ON v.id_venta = vd.id_venta
            WHERE v.estado = 'EMITIDA' GROUP BY vd.id_producto
        ) vt ON vt.id_producto = p.id_producto
        WHERE COALESCE(p.activo, 1) = 1 ORDER BY total_vendido DESC, p.nombre
    """
    return db.execute(text(query)).mappings().all()


@router.get("/arima/{producto_id}")
def predecir_demanda_arima(
    producto_id: int,
    dias_proyeccion: int = Query(14, ge=7, le=60),
    nivel_servicio: float = Query(0.95, ge=0.80, le=0.99),
    db: Session = Depends(get_db),
):
    prod = db.execute(text(PRODUCTOS_SQL + " WHERE p.id_producto = :pid AND COALESCE(p.activo, 1) = 1"),
                      {"pid": producto_id}).mappings().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto activo no encontrado")
    corte = fecha_corte_local()
    ventas = db.execute(text("""
        SELECT DATE(v.fecha) AS fecha, SUM(vd.cantidad) AS cantidad
        FROM ventas_detalle vd JOIN ventas v ON v.id_venta = vd.id_venta
        WHERE vd.id_producto = :pid AND v.estado = 'EMITIDA'
          AND v.fecha >= :inicio AND v.fecha < :fin
        GROUP BY DATE(v.fecha) ORDER BY fecha
    """), {"pid": producto_id, "inicio": corte - timedelta(days=364),
            "fin": corte + timedelta(days=1)}).mappings().all()
    serie = serie_diaria(ventas, date.fromisoformat(str(prod["fecha_creacion"])[:10]), corte)
    modelo = pronosticar(serie, dias_proyeccion, nivel_servicio)
    demanda = float(modelo["valores"].mean())
    costo = float(prod["costo_promedio_pen"] or 0)
    politica = politica_reposicion(demanda, modelo["desviacion"], int(prod["tiempo_entrega_dias"]),
                                  float(prod["stock_disponible"]), costo, nivel_servicio)
    timeline = [{"fecha": fecha.strftime("%Y-%m-%d"), "ventas_reales": round(float(valor), 2),
                 "pronostico": None, "limite_inferior": None, "limite_superior": None}
                for fecha, valor in serie.tail(30).items()]
    for i in range(dias_proyeccion):
        timeline.append({"fecha": (corte + timedelta(days=i + 1)).isoformat(), "ventas_reales": None,
                         "pronostico": round(float(modelo["valores"][i]), 2),
                         "limite_inferior": round(float(modelo["inferior"][i]), 2),
                         "limite_superior": round(float(modelo["superior"][i]), 2)})
    return {
        "producto": {**dict(prod), "costo_promedio_pen": costo if costo > 0 else None,
                     "lead_time_dias": prod["tiempo_entrega_dias"], "proveedor": prod["proveedor_principal"]},
        "parametros_modelo": {"algoritmo": modelo["algoritmo"], "dias_proyectados": dias_proyeccion,
                              "nivel_servicio_porcentaje": round(nivel_servicio * 100, 1),
                              "z_score": round(NormalDist().inv_cdf(nivel_servicio), 3)},
        "calidad_datos": {"estado": modelo["calidad"], "dias_historial": modelo["dias_historial"],
                          "dias_con_ventas": modelo["dias_con_ventas"], "fecha_corte": corte.isoformat(),
                          "advertencia": "Estimación basada en ventas registradas; no corrige ventas perdidas por falta de stock."},
        "metricas_pronostico": {"demanda_diaria_promedio": round(demanda, 2),
                                "desviacion_estandar_demanda": round(modelo["desviacion"], 2),
                                "demanda_total_proyectada": round(float(modelo["valores"].sum()), 1),
                                "dias_cobertura_actual": politica["dias_cobertura"]},
        "politica_inventario": politica, "timeline_grafica": timeline,
    }


@router.get("/resumen-abastecimiento")
def obtener_resumen_abastecimiento_inteligente(db: Session = Depends(get_db)):
    corte = fecha_corte_local()
    productos = db.execute(text(PRODUCTOS_SQL + " WHERE COALESCE(p.activo, 1) = 1 ORDER BY p.nombre")).mappings().all()
    # Una consulta para todos los días/productos, sin cruces con almacenes.
    ventas = db.execute(text("""
        SELECT vd.id_producto, DATE(v.fecha) AS fecha, SUM(vd.cantidad) AS cantidad
        FROM ventas_detalle vd JOIN ventas v ON v.id_venta = vd.id_venta
        WHERE v.estado = 'EMITIDA' AND v.fecha >= :inicio AND v.fecha < :fin
        GROUP BY vd.id_producto, DATE(v.fecha)
    """), {"inicio": corte - timedelta(days=29), "fin": corte + timedelta(days=1)}).mappings().all()
    ventas_por_producto = {}
    for venta in ventas:
        ventas_por_producto.setdefault(venta["id_producto"], []).append(venta)
    alertas = []
    sin_ventas = 0
    for prod in productos:
        serie = serie_diaria(ventas_por_producto.get(prod["id_producto"], []),
                             max(date.fromisoformat(str(prod["fecha_creacion"])[:10]), corte - timedelta(days=29)), corte)
        demanda = float(serie.mean()) if len(serie) else 0.0
        if demanda <= 0:
            sin_ventas += 1
            continue
        desviacion = float(serie.std(ddof=0))
        politica = politica_reposicion(demanda, desviacion, int(prod["tiempo_entrega_dias"]),
                                      float(prod["stock_disponible"]), float(prod["costo_promedio_pen"] or 0))
        if politica["cantidad_sugerida_compra"] <= 0:
            continue
        alertas.append({
            "id_producto": prod["id_producto"], "sku": prod["sku"], "producto": prod["nombre"],
            "categoria": prod["categoria"] or "General", "stock_actual": float(prod["stock_actual"]),
            "peso_kg": float(prod["peso_kg"]), "volumen_m3": float(prod["volumen_m3"]),
            "stock_disponible": float(prod["stock_disponible"]), "id_proveedor": prod["id_proveedor"],
            "punto_reorden": politica["punto_reorden"], "stock_seguridad": politica["stock_seguridad"],
            "lead_time_dias": prod["tiempo_entrega_dias"], "proveedor": prod["proveedor_principal"],
            "cantidad_sugerida": politica["cantidad_sugerida_compra"],
            "costo_estimado_pen": politica["inversion_estimada_pen"], "costo_conocido": politica["costo_conocido"],
            "prioridad": "ALTA" if politica["estado"] in ("CRITICO", "AGOTADO") else "MEDIA",
            "demanda_diaria_estimada": round(demanda, 2), "ventas_ultimos_30d": float(serie.sum()),
        })
    alertas.sort(key=lambda a: (a["prioridad"] != "ALTA", a["stock_disponible"]))
    return {
        "resumen": {"total_productos_en_alerta": len(alertas),
                    "inversion_total_estimada_pen": round(sum(a["costo_estimado_pen"] or 0 for a in alertas), 2),
                    "productos_criticos": sum(a["prioridad"] == "ALTA" for a in alertas),
                    "productos_sin_costo": sum(not a["costo_conocido"] for a in alertas),
                    "productos_sin_ventas": sin_ventas, "fecha_corte": corte.isoformat(), "cobertura_dias": 20},
        "sugerencias_compra": alertas,
    }


@router.get("/plan-compras/excel")
def exportar_plan_compras(db: Session = Depends(get_db)):
    plan = obtener_resumen_abastecimiento_inteligente(db)
    resumen = plan["resumen"]
    wb = Workbook()
    ws = wb.active
    ws.title = "Plan de abastecimiento"
    ws.append(["Plan de compras sugeridas", "Corte", resumen["fecha_corte"]])
    ws.append(["Cobertura adicional (días)", resumen["cobertura_dias"]])
    ws.append(["Presupuesto conocido (PEN)", resumen["inversion_total_estimada_pen"]])
    ws.append(["Propuestas sin costo (excluidas del presupuesto)", resumen["productos_sin_costo"]])
    ws.append(["Productos sin ventas (sin pedido automático)", resumen["productos_sin_ventas"]])
    ws.append([])
    ws.append(["Prioridad", "SKU", "Producto", "Stock disponible", "ROP", "Stock de seguridad",
               "Proveedor", "Entrega (días)", "Cantidad sugerida", "Inversión PEN"])
    for celda in ws[7]:
        celda.font = Font(bold=True, color="FFFFFF")
        celda.fill = PatternFill("solid", fgColor="1D4ED8")
    for item in plan["sugerencias_compra"]:
        ws.append([item["prioridad"], item["sku"], item["producto"], item["stock_disponible"],
                   item["punto_reorden"], item["stock_seguridad"], item["proveedor"],
                   item["lead_time_dias"], item["cantidad_sugerida"],
                   item["costo_estimado_pen"] if item["costo_conocido"] else "Por confirmar"])
        for celda in ws[ws.max_row]:
            if isinstance(celda.value, str):
                celda.data_type = "s"  # Los nombres y SKU nunca son fórmulas.
        ws.cell(ws.max_row, 10).number_format = '#,##0.00'
    ws.freeze_panes = "D8"
    ws.auto_filter.ref = f"A7:J{ws.max_row}"
    for columna in ws.columns:
        ws.column_dimensions[columna[0].column_letter].width = min(48, max(16, max(len(str(c.value or '')) for c in columna) + 2))
    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    return StreamingResponse(stream, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename=plan_compras_{resumen['fecha_corte']}.xlsx"})
