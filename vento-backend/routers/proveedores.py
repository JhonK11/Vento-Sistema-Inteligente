from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from database import get_db
from routers.auth import get_current_user, require_role
from schemas.proveedores import ProveedorCreate, ProveedorResponse

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/api/proveedores", response_model=List[ProveedorResponse])
def get_proveedores(db: Session = Depends(get_db)):
    query = text("SELECT * FROM proveedores WHERE estado = 1 ORDER BY razon_social")
    result = db.execute(query).mappings().all()
    return [ProveedorResponse(**row) for row in result]

@router.post("/api/proveedores", dependencies=[Depends(require_role(["ADMINISTRADOR", "COMPRAS"]))])
def create_proveedor(req: ProveedorCreate, db: Session = Depends(get_db)):
    query = text("""
        INSERT INTO proveedores (
            razon_social, pais, contacto_nombre, telefono, email, 
            direccion, moneda_preferida, tiempo_entrega_dias_prom, condiciones_pago, estado
        ) VALUES (
            :razon, :pais, :contacto, :tel, :email, 
            :dir, :moneda, :tiempo, :condiciones, 1
        )
    """)
    db.execute(query, {
        "razon": req.razon_social, "pais": req.pais, "contacto": req.contacto_nombre,
        "tel": req.telefono, "email": req.email, "dir": req.direccion,
        "moneda": req.moneda_preferida, "tiempo": req.tiempo_entrega_dias_prom,
        "condiciones": req.condiciones_pago
    })
    db.commit()
    return {"status": "success", "message": "Proveedor creado"}

@router.put("/api/proveedores/{id_proveedor}", dependencies=[Depends(require_role(["ADMINISTRADOR", "COMPRAS"]))])
def update_proveedor(id_proveedor: int, req: ProveedorCreate, db: Session = Depends(get_db)):
    query = text("""
        UPDATE proveedores SET 
            razon_social = :razon,
            pais = :pais,
            contacto_nombre = :contacto,
            telefono = :tel,
            email = :email,
            direccion = :dir,
            moneda_preferida = :moneda,
            tiempo_entrega_dias_prom = :tiempo,
            condiciones_pago = :condiciones
        WHERE id_proveedor = :id
    """)
    db.execute(query, {
        "id": id_proveedor,
        "razon": req.razon_social, "pais": req.pais, "contacto": req.contacto_nombre,
        "tel": req.telefono, "email": req.email, "dir": req.direccion,
        "moneda": req.moneda_preferida, "tiempo": req.tiempo_entrega_dias_prom,
        "condiciones": req.condiciones_pago
    })
    db.commit()
    return {"status": "success", "message": "Proveedor actualizado"}

@router.delete("/api/proveedores/{id_proveedor}", dependencies=[Depends(require_role(["ADMINISTRADOR", "COMPRAS"]))])
def delete_proveedor(id_proveedor: int, db: Session = Depends(get_db)):
    db.execute(text("UPDATE proveedores SET estado = 0 WHERE id_proveedor = :id"), {"id": id_proveedor})
    db.commit()
    return {"status": "success", "message": "Proveedor dado de baja"}

