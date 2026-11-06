from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UsuarioBase(BaseModel):
    nombre_completo: str
    email: EmailStr
    id_rol: int

class UsuarioCreate(UsuarioBase):
    password: str

class UsuarioUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    email: Optional[EmailStr] = None
    id_rol: Optional[int] = None
    password: Optional[str] = None
    estado: Optional[int] = None

class UsuarioResponse(UsuarioBase):
    id_usuario: int
    estado: int
    rol_nombre: str
    fecha_creacion: datetime

    class Config:
        from_attributes = True

class RolResponse(BaseModel):
    id_rol: int
    nombre: str
    descripcion: Optional[str] = None

