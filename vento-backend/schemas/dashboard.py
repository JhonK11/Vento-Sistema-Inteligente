from pydantic import BaseModel
from typing import List

class DashboardKPIs(BaseModel):
    ventas_hoy: float
    ventas_mes: float
    capital_inmovilizado: float
    stockouts: int
    alertas_rop: int

class AlertaROP(BaseModel):
    sku: str
    producto: str
    almacen: str
    stock_actual: float
    punto_reorden: float
    estado: str

class ABCResumen(BaseModel):
    categoria: str
    count: int

class TendenciaVentas(BaseModel):
    fecha: str # Date converted to string
    total: float
    unidades: float

