from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime

class ProductoUpdate(BaseModel):
    precio_venta: float = Field(..., ge=0.0, description="Precio de venta mayor o igual a 0")
    peso_kg: float = Field(default=0.0, ge=0.0)
    volumen_m3: float = Field(default=0.0, ge=0.0)

class StockDisponible(BaseModel):
    id_producto: int
    sku: str
    nombre: str
    id_almacen: int
    almacen: str
    stock_actual: float
    stock_reservado: float
    stock_disponible: float
    stock_minimo: float

class MovimientoInventario(BaseModel):
    fecha: datetime
    tipo_movimiento: str
    cantidad: float
    stock_anterior: float
    stock_posterior: float
    costo_unitario: float


class CategoriaCreate(BaseModel):
    nombre: str

class ProductoCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=50, pattern=r"\S")
    nombre: str = Field(..., min_length=1, max_length=150, pattern=r"\S")
    id_categoria: int = Field(..., gt=0)
    id_unidad: int = Field(..., gt=0)
    precio_venta: float = Field(default=0.0, ge=0.0)
    peso_kg: float = Field(default=0.0, ge=0.0)
    volumen_m3: float = Field(default=0.0, ge=0.0)
