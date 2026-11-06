from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

Dinero = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]


class AperturaCaja(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    id_almacen: int = Field(gt=0)
    fondo_inicial: Dinero
    observaciones: str | None = Field(default=None, max_length=500)


class MovimientoCaja(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    tipo: Literal['INGRESO', 'RETIRO']
    monto: Dinero = Field(gt=0)
    motivo: str = Field(min_length=3, max_length=250)
    referencia: UUID


class CierreCaja(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    efectivo_contado: Dinero
    observaciones: str | None = Field(default=None, max_length=500)
