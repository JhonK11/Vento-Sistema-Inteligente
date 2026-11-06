from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from database import get_db
from routers.auth import get_current_user, require_role
from schemas.dashboard import DashboardKPIs, AlertaROP, ABCResumen, TendenciaVentas

router = APIRouter(dependencies=[Depends(require_role(["ADMINISTRADOR", "GERENCIA"]))])

@router.get("/api/dashboard/kpis", response_model=DashboardKPIs)
def get_dashboard_kpis(dias: int = 14, db: Session = Depends(get_db)):
    ventas_hoy = db.execute(text("SELECT SUM(ingreso_bruto) FROM v_ventas_diarias WHERE fecha = CURRENT_DATE()")).scalar() or 0
    
    # Calculate ventas for the requested period (dias)
    ventas_mes_query = text(f"SELECT SUM(ingreso_bruto) FROM v_ventas_diarias WHERE fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL :dias DAY)")
    ventas_mes = db.execute(ventas_mes_query, {"dias": dias}).scalar() or 0
    
    capital = db.execute(text("""
        SELECT SUM(v.stock_actual * p.costo_promedio_pen) 
        FROM v_stock_disponible v
        JOIN productos p ON v.id_producto = p.id_producto
        WHERE v.stock_actual > 0
    """)).scalar() or 0
    stockouts = db.execute(text("SELECT COUNT(*) FROM v_stock_disponible WHERE stock_actual <= 0")).scalar() or 0
    alertas_rop = db.execute(text("SELECT COUNT(*) FROM v_stock_disponible WHERE stock_disponible <= punto_reorden AND stock_actual > 0")).scalar() or 0

    return DashboardKPIs(
        ventas_hoy=float(ventas_hoy),
        ventas_mes=float(ventas_mes),
        capital_inmovilizado=float(capital),
        stockouts=stockouts,
        alertas_rop=alertas_rop
    )

@router.get("/api/dashboard/alertas-rop", response_model=List[AlertaROP])
def get_alertas_rop(db: Session = Depends(get_db)):
    query = text("""
        SELECT sku, producto, almacen, stock_actual, punto_reorden, 
               CASE WHEN stock_actual <= 0 THEN 'STOCKOUT' ELSE 'REORDENAR' END as estado
        FROM v_stock_disponible 
        WHERE stock_disponible <= punto_reorden
        ORDER BY estado ASC, stock_disponible ASC
        LIMIT 10
    """)
    result = db.execute(query).mappings().all()
    return [AlertaROP(**row) for row in result]

@router.get("/api/dashboard/abc-resumen", response_model=List[ABCResumen])
def get_abc_resumen(db: Session = Depends(get_db)):
    query = text("""
        SELECT categoria, COUNT(id_producto) as count 
        FROM v_clasificacion_abc_vigente 
        GROUP BY categoria
        ORDER BY categoria ASC
    """)
    result = db.execute(query).mappings().all()
    if not result:
        return [ABCResumen(categoria="A", count=0), ABCResumen(categoria="B", count=0), ABCResumen(categoria="C", count=0)]
    return [ABCResumen(**row) for row in result]

@router.get("/api/dashboard/tendencia-ventas", response_model=List[TendenciaVentas])
def get_tendencia_ventas(dias: int = 14, db: Session = Depends(get_db)):
    query = text("""
        SELECT fecha, SUM(ingreso_bruto) as total, SUM(unidades_vendidas) as unidades 
        FROM v_ventas_diarias 
        WHERE fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL :dias DAY) 
        GROUP BY fecha 
        ORDER BY fecha ASC
    """)
    result = db.execute(query, {"dias": dias}).mappings().all()
    return [TendenciaVentas(fecha=str(row['fecha']), total=float(row['total']), unidades=float(row['unidades'])) for row in result]
