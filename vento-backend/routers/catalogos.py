from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from routers.auth import get_current_user, require_role

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/api/almacenes")
def get_almacenes(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT id_almacen, nombre FROM almacenes WHERE estado = 1")).mappings().all()
    return result

@router.get("/api/clientes")
def get_clientes(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT id_cliente, nombre_razon_social, numero_documento FROM clientes WHERE estado = 1")).mappings().all()
    return result

@router.get("/api/importaciones/transito")
def get_importaciones_transito(db: Session = Depends(get_db)):
    query = text("SELECT id_importacion, numero_importacion, pais_origen, fecha_pedido, estado FROM importaciones WHERE estado IN ('EN_TRANSITO', 'ADUANAS') ORDER BY fecha_pedido DESC")
    return db.execute(query).mappings().all()

@router.get("/api/categorias")
def get_categorias(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT id_categoria, nombre FROM categorias WHERE estado = 1 ORDER BY nombre ASC")).mappings().all()
    return result

from pydantic import BaseModel

class CategoriaCreate(BaseModel):
    nombre: str

@router.post("/api/categorias", dependencies=[Depends(require_role(["ADMINISTRADOR", "ALMACEN"]))])
def create_categoria(req: CategoriaCreate, db: Session = Depends(get_db)):
    db.execute(text("INSERT INTO categorias (nombre, estado) VALUES (:nombre, 1)"), {"nombre": req.nombre})
    db.commit()
    return {"status": "success", "message": "Categoría creada correctamente"}


@router.get("/api/unidades-medida")
def get_unidades_medida(db: Session = Depends(get_db)):
    return db.execute(text("SELECT id_unidad, codigo, nombre, es_fraccionable FROM unidades_medida ORDER BY nombre")).mappings().all()
