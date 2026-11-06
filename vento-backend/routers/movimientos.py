from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from routers.auth import get_current_user, require_role

router = APIRouter(dependencies=[Depends(require_role(["ADMINISTRADOR", "GERENCIA", "ALMACEN"]))])

from typing import Optional

@router.get("/api/movimientos")
def get_todos_movimientos(categoria: Optional[str] = None, db: Session = Depends(get_db)):
    base_query = """
        SELECT m.fecha, p.nombre as producto, m.tipo_movimiento, m.cantidad, m.stock_anterior, m.stock_posterior, m.costo_unitario 
        FROM movimientos_inventario m
        JOIN productos p ON m.id_producto = p.id_producto
    """
    
    params = {}
    if categoria == 'VENTAS':
        base_query += " WHERE m.tipo_movimiento IN ('VENTA', 'DEVOLUCION_VENTA')"
    elif categoria == 'COMPRAS':
        base_query += " WHERE m.tipo_movimiento IN ('COMPRA', 'DEVOLUCION_COMPRA', 'ENTRADA_COMPRA')"
    elif categoria == 'TRASLADOS':
        base_query += " WHERE m.tipo_movimiento IN ('TRASLADO_ENTRADA', 'TRASLADO_SALIDA')"
    elif categoria == 'OTROS':
        base_query += " WHERE m.tipo_movimiento IN ('AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'MERMA', 'PRODUCTO_DEFECTUOSO', 'OTROS_AJUSTES')"
        
    base_query += " ORDER BY m.fecha DESC LIMIT 100"
    
    query = text(base_query)
    result = db.execute(query, params).mappings().all()
    return result
