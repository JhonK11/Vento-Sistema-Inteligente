from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from routers.auth import get_current_user, require_role
from typing import List
import json
from schemas.compras import CompraCreate

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/api/compras", dependencies=[Depends(require_role(["ADMINISTRADOR", "COMPRAS"]))])
def registrar_compra(req: CompraCreate, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    usuario_id = current_user.get("user", {}).get("id_usuario")
    if not usuario_id:
        raise HTTPException(status_code=401, detail="No autorizado. El token no contiene un id_usuario.")
        
    try:
        detalle_dict = [d.dict() for d in req.detalle]
        detalle_json = json.dumps([{
            "id_producto": d["id_producto"],
            "id_lote": d.get("id_lote"),
            "cantidad": float(d["cantidad"]),
            "costo_unitario": float(d["costo_unitario"])
        } for d in detalle_dict])
        
        # Ejecutar Stored Procedure
        db.execute(text("""
            CALL sp_registrar_compra(
                :numero_compra, :id_proveedor, NULL, :id_usuario, :id_almacen, 
                :moneda, :tipo_cambio, :descuento, :impuesto, :detalle, @out_id_compra
            )
        """), {
            "numero_compra": req.numero_compra,
            "id_proveedor": req.id_proveedor,
            "id_usuario": usuario_id,
            "id_almacen": req.id_almacen_destino,
            "moneda": req.moneda,
            "tipo_cambio": float(req.tipo_cambio),
            "descuento": float(req.descuento),
            "impuesto": float(req.impuesto),
            "detalle": detalle_json
        })
        
        id_compra_row = db.execute(text("SELECT @out_id_compra AS id_compra")).fetchone()
        id_compra = id_compra_row.id_compra if id_compra_row else None
        
        if not id_compra:
            raise Exception("No se pudo obtener el ID de la compra (SP falló en silencio)")

        db.commit()
        return {"status": "success", "message": "Orden de Compra registrada exitosamente", "id_compra": id_compra}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
