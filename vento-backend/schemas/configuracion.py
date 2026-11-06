from pydantic import BaseModel

class ConfigItem(BaseModel):
    clave: str
    valor: str
    descripcion: str

class ConfigUpdate(BaseModel):
    valor: str

