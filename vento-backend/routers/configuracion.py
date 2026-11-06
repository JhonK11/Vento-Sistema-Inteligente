from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from database import get_db
from routers.auth import get_current_user, require_role
from schemas.configuracion import ConfigItem, ConfigUpdate

router = APIRouter(
    prefix="/api/configuracion",
    tags=["Configuracion"],
    dependencies=[Depends(get_current_user), Depends(require_role(["ADMINISTRADOR"]))]
)

@router.get("", response_model=List[ConfigItem])
def get_configuracion(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT clave, valor, descripcion FROM configuracion")).mappings().all()
    return result

@router.put("/{clave}")
def update_configuracion(clave: str, data: ConfigUpdate, db: Session = Depends(get_db)):
    db.execute(text("UPDATE configuracion SET valor = :val WHERE clave = :clave"), {"val": data.valor, "clave": clave})
    db.commit()
    return {"status": "success", "message": "Configuración actualizada."}

