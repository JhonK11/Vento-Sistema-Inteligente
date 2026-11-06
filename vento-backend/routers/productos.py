from fastapi import APIRouter, Depends, HTTPException, Request, Query
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from decimal import Decimal
import json

from database import get_db
from routers.auth import get_current_user, require_role
from schemas.productos import ProductoUpdate, StockDisponible, MovimientoInventario, ProductoCreate
from services.imagenes import ALLOWED_CONTENT_TYPES, MAX_IMAGE_BYTES, guardar_imagen, quitar_imagen

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/api/productos")
def get_productos(db: Session = Depends(get_db), almacen_id: int | None = Query(None, gt=0)):
    query = text("""
        SELECT p.id_producto, p.sku, p.codigo_barras, p.nombre, p.estado, p.activo, p.peso_kg, p.volumen_m3,
               p.imagen_url, COALESCE(um.es_fraccionable, 0) AS es_fraccionable,
               COALESCE((SELECT hp.valor FROM historial_precios hp
                         WHERE hp.id_producto=p.id_producto AND hp.tipo_precio='VENTA'
                           AND hp.fecha_fin IS NULL ORDER BY hp.id_historial_precio DESC LIMIT 1), 0) AS precio_venta,
               c.nombre as categoria, COALESCE(inv.stock_disponible, 0) AS stock_disponible
        FROM productos p
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        LEFT JOIN unidades_medida um ON um.id_unidad = p.id_unidad
        LEFT JOIN (SELECT id_producto, SUM(stock_actual-stock_reservado) AS stock_disponible
                   FROM inventario WHERE (:almacen IS NULL OR id_almacen=:almacen)
                   GROUP BY id_producto) inv ON inv.id_producto=p.id_producto
        WHERE p.activo = 1 OR p.activo IS NULL
        ORDER BY p.nombre ASC
    """)
    result = db.execute(query, {'almacen': almacen_id}).mappings().all()
    # No schema strictly needed here unless we define it, using simple return for now 
    # to avoid breaking UI that expects specific types that might be null
    return result


@router.put('/api/productos/{producto_id}/imagen', dependencies=[Depends(require_role(['ADMINISTRADOR', 'ALMACEN']))])
async def subir_imagen(producto_id: int, request: Request, db: Session = Depends(get_db)):
    if request.headers.get('content-type', '').split(';')[0].lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(415, 'Usa una imagen JPG, PNG o WebP.')
    contenido = bytearray()
    async for fragmento in request.stream():
        if len(contenido) + len(fragmento) > MAX_IMAGE_BYTES:
            raise HTTPException(413, 'La imagen no debe superar 5 MB.')
        contenido.extend(fragmento)
    return await run_in_threadpool(guardar_imagen, producto_id, bytes(contenido), db)


@router.delete('/api/productos/{producto_id}/imagen', dependencies=[Depends(require_role(['ADMINISTRADOR', 'ALMACEN']))])
def eliminar_imagen(producto_id: int, db: Session = Depends(get_db)):
    return quitar_imagen(producto_id, db)

@router.put("/api/productos/{producto_id}", dependencies=[Depends(require_role(["ADMINISTRADOR", "ALMACEN"]))])
def update_producto(producto_id: int, req: ProductoUpdate, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    usuario_id = current_user.get("user", {}).get("id_usuario")
    if not usuario_id:
        raise HTTPException(status_code=401, detail="No autorizado.")

    prod = db.execute(text("SELECT * FROM productos WHERE id_producto = :pid"), {"pid": producto_id}).fetchone()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    db.execute(text("""
        UPDATE productos 
        SET peso_kg = :peso, volumen_m3 = :vol
        WHERE id_producto = :pid
    """), {"peso": req.peso_kg, "vol": req.volumen_m3, "pid": producto_id})

    if req.precio_venta is not None:
        current_price_row = db.execute(text("""
            SELECT id_historial_precio, valor FROM historial_precios 
            WHERE id_producto = :pid AND tipo_precio = 'VENTA' AND fecha_fin IS NULL
        """), {"pid": producto_id}).fetchone()
        
        current_price = current_price_row.valor if current_price_row else None
        
        if current_price is None or Decimal(str(current_price)) != Decimal(str(req.precio_venta)):
            if current_price_row:
                db.execute(text("""
                    UPDATE historial_precios SET fecha_fin = NOW() 
                    WHERE id_historial_precio = :hp_id
                """), {"hp_id": current_price_row.id_historial_precio})
                
            db.execute(text("""
                INSERT INTO historial_precios (id_producto, tipo_precio, valor, fecha_inicio, id_usuario, motivo)
                VALUES (:pid, 'VENTA', :val, NOW(), :uid, 'Actualizacion desde panel')
            """), {"pid": producto_id, "val": req.precio_venta, "uid": usuario_id})
            
            val_ant = json.dumps({"precio_venta": float(current_price) if current_price else 0})
            val_nue = json.dumps({"precio_venta": float(req.precio_venta)})
            
            db.execute(text("""
                INSERT INTO auditoria (id_usuario, accion, tabla_afectada, id_registro, valor_anterior, valor_nuevo)
                VALUES (:uid, 'UPDATE', 'historial_precios', :pid, :ant, :nue)
            """), {"uid": usuario_id, "pid": producto_id, "ant": val_ant, "nue": val_nue})
            
    db.commit()
    return {"status": "success", "message": "Producto actualizado correctamente"}

@router.delete("/api/productos/{producto_id}", dependencies=[Depends(require_role(["ADMINISTRADOR", "ALMACEN"]))])
def delete_producto(producto_id: int, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text("UPDATE productos SET activo = 0, estado = 'DESCONTINUADO' WHERE id_producto = :pid"), {"pid": producto_id})
    db.commit()
    return {"status": "success", "message": "Producto dado de baja logicamente"}

@router.get("/api/productos/stock", response_model=List[StockDisponible])
def get_stock_disponible(db: Session = Depends(get_db)):
    query = text("""
        SELECT id_producto, sku, producto as nombre, id_almacen, almacen, 
               stock_actual, stock_reservado, stock_disponible, stock_minimo 
        FROM v_stock_disponible
        ORDER BY nombre, almacen
    """)
    result = db.execute(query).mappings().all()
    return [StockDisponible(**row) for row in result]

@router.get("/api/productos/{producto_id}/movimientos", response_model=List[MovimientoInventario], dependencies=[Depends(require_role(["ADMINISTRADOR", "GERENCIA", "ALMACEN"]))])
def get_movimientos(producto_id: int, db: Session = Depends(get_db)):
    query = text("""
        SELECT fecha, tipo_movimiento, cantidad, stock_anterior, stock_posterior, costo_unitario 
        FROM movimientos_inventario 
        WHERE id_producto = :pid 
        ORDER BY fecha DESC
    """)
    result = db.execute(query, {"pid": producto_id}).mappings().all()
    return [MovimientoInventario(**row) for row in result]

@router.post("/api/productos", dependencies=[Depends(require_role(["ADMINISTRADOR", "ALMACEN"]))])
def create_producto(req: ProductoCreate, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    usuario_id = current_user.get("user", {}).get("id_usuario")
    
    if not usuario_id:
        raise HTTPException(status_code=401, detail="No autorizado")
    try:
        result = db.execute(text("""
            INSERT INTO productos (sku, nombre, id_categoria, id_unidad, peso_kg, volumen_m3)
            VALUES (:sku, :nombre, :id_cat, :unidad, :peso, :volumen)
        """), {
            "sku": req.sku.strip(), "nombre": req.nombre.strip(), "id_cat": req.id_categoria,
            "unidad": req.id_unidad, "peso": req.peso_kg, "volumen": req.volumen_m3,
        })
        pid = result.lastrowid
        db.execute(text("""
            INSERT INTO historial_precios (id_producto, tipo_precio, valor, fecha_inicio, id_usuario, motivo)
            VALUES (:pid, 'VENTA', :val, NOW(), :uid, 'Creacion inicial')
        """), {"pid": pid, "val": req.precio_venta, "uid": usuario_id})
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"status": "success", "message": "Producto creado correctamente", "id_producto": pid}
