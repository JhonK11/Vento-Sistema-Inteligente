from pydantic import BaseModel, Field
from typing import Optional, List

class UserData(BaseModel):
    id_usuario: int
    id_rol: int
    rol_nombre: str
    nombre: str
    email: str

class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1)

class TokenResponse(BaseModel):
    status: str
    access_token: str
    token_type: str
    user: UserData

