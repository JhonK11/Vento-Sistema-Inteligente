import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text
import bcrypt
import jwt
import time
from datetime import datetime, timedelta, timezone
from database import get_db
from schemas.auth import LoginRequest, TokenResponse
from settings import jwt_secret



router = APIRouter()
security = HTTPBearer()

SECRET_KEY = jwt_secret()
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Basic brute force protection (in-memory)
login_attempts = {}

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
        usuario_id = int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    user = db.execute(text("""
        SELECT u.id_usuario, u.id_rol, u.nombre_completo, u.email, r.nombre AS rol_nombre
        FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
        WHERE u.id_usuario = :uid AND u.estado = 1 AND r.estado = 1
    """), {"uid": usuario_id}).mappings().first()
    if not user:
        raise HTTPException(status_code=401, detail="La cuenta está desactivada o ya no tiene acceso")
    # Nunca autorizar con roles o identificadores desactualizados del JWT.
    payload["user"] = {
        "id_usuario": user["id_usuario"], "id_rol": user["id_rol"],
        "rol_nombre": user["rol_nombre"], "nombre": user["nombre_completo"], "email": user["email"],
    }
    return payload


@router.get("/api/auth/me", response_model=dict)
def sesion_actual(current_user=Depends(get_current_user)):
    return current_user["user"]

def require_role(roles: list[str]):
    def role_checker(current_user: dict = Depends(get_current_user)):
        user_data = current_user.get("user", {})
        user_role = user_data.get("rol_nombre")
        
        # Fallback para tokens antiguos generados antes de la actualizacion
        if not user_role and "id_rol" in user_data:
            role_map = {1: "ADMINISTRADOR", 2: "GERENCIA", 3: "COMPRAS", 4: "ALMACEN", 5: "VENTAS"}
            user_role = role_map.get(user_data["id_rol"])

        if not user_role or user_role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permisos suficientes para realizar esta accion")
        return current_user
    return role_checker

@router.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Rate Limiting basico
    now = time.time()
    if req.email in login_attempts:
        attempts, last_attempt = login_attempts[req.email]
        if attempts >= 5 and now - last_attempt < 300: # 5 minutos de bloqueo
            raise HTTPException(status_code=429, detail="Demasiados intentos fallidos. Intente en 5 minutos.")
        if now - last_attempt >= 300:
            login_attempts[req.email] = (0, now)
    
    query = text("""
        SELECT u.id_usuario, u.id_rol, u.nombre_completo, u.email, u.password_hash, r.nombre as rol_nombre
        FROM usuarios u
        JOIN roles r ON u.id_rol = r.id_rol
        WHERE u.email = :email AND u.estado = 1 AND r.estado = 1
    """)
    user = db.execute(query, {"email": req.email}).mappings().first()
    
    if not user or not bcrypt.checkpw(req.password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        attempts, _ = login_attempts.get(req.email, (0, 0))
        login_attempts[req.email] = (attempts + 1, now)
        raise HTTPException(status_code=401, detail="Credenciales invalidas")
        
    # Reset attempts on success
    if req.email in login_attempts:
        del login_attempts[req.email]
        
    user_data = {
        "id_usuario": user['id_usuario'],
        "id_rol": user['id_rol'],
        "rol_nombre": user['rol_nombre'],
        "nombre": user['nombre_completo'],
        "email": user['email']
    }
    
    access_token = create_access_token(
        data={"sub": str(user['id_usuario']), "user": user_data},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return TokenResponse(
        status="success",
        access_token=access_token,
        token_type="bearer",
        user=user_data
    )
