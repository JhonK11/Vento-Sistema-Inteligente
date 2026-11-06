from pydantic import BaseModel, ConfigDict, Field
from typing import List, Literal
from decimal import Decimal

class VentaDetalleCreate(BaseModel):
    id_producto: int = Field(..., gt=0)
    cantidad: Decimal = Field(..., gt=0, max_digits=14, decimal_places=3)
    precio_unitario: Decimal = Field(..., gt=0, max_digits=14, decimal_places=4)
    # Compatibilidad con clientes previos: el servidor nunca usa este costo.
    costo_unitario: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=4)

class VentaCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    numero_venta: str = Field(min_length=1, max_length=30)
    id_cliente: int = Field(..., gt=0)
    id_almacen: int = Field(..., gt=0)
    id_turno: int = Field(gt=0)
    metodo_pago: Literal['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'OTRO']
    monto_recibido: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    detalle: List[VentaDetalleCreate] = Field(..., min_length=1, max_length=500)

