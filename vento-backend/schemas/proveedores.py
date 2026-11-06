from pydantic import BaseModel, Field
from typing import Optional, List

class ProveedorCreate(BaseModel):
    razon_social: str = Field(..., min_length=2)
    pais: str = Field(..., min_length=2)
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    moneda_preferida: str = "PEN"
    tiempo_entrega_dias_prom: int = Field(..., ge=0)
    condiciones_pago: Optional[str] = None

class ProveedorResponse(BaseModel):
    id_proveedor: int
    razon_social: str
    pais: str
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    moneda_preferida: str
    tiempo_entrega_dias_prom: int
    condiciones_pago: Optional[str] = None
    estado: int

