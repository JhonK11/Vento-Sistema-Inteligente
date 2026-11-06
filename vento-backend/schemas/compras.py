from pydantic import BaseModel, Field
from typing import List, Optional
from decimal import Decimal

class CompraDetalleCreate(BaseModel):
    id_producto: int = Field(..., gt=0)
    id_lote: Optional[int] = None
    cantidad: Decimal = Field(..., gt=0)
    costo_unitario: Decimal = Field(..., ge=0)

class CompraCreate(BaseModel):
    id_proveedor: int = Field(..., gt=0)
    numero_compra: str
    id_almacen_destino: int = Field(..., gt=0)
    moneda: str
    tipo_cambio: Decimal = Field(..., gt=0)
    descuento: Decimal = Field(default=Decimal('0.00'), ge=0)
    impuesto: Decimal = Field(default=Decimal('0.00'), ge=0)
    detalle: List[CompraDetalleCreate] = Field(..., min_items=1)

