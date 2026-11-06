from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import bcrypt

from database import get_db
from routers.auth import get_current_user, require_role
from schemas.usuarios import UsuarioCreate, UsuarioUpdate, UsuarioResponse, RolResponse

router = APIRouter(
    prefix="/api",
    tags=["Usuarios"],
    dependencies=[Depends(get_current_user), Depends(require_role(["ADMINISTRADOR"]))]
)

@router.get("/usuarios")
def get_usuarios(db: Session = Depends(get_db)):
    query = text("""
        SELECT u.id_usuario, u.nombre_completo, u.email, u.id_rol, u.estado, u.fecha_creacion, r.nombre as rol_nombre
        FROM usuarios u
        JOIN roles r ON u.id_rol = r.id_rol
        ORDER BY u.id_usuario DESC
    """)
    result = db.execute(query).mappings().all()
    return result

@router.post("/usuarios")
def create_usuario(user: UsuarioCreate, db: Session = Depends(get_db)):
    # Check if email exists
    existing = db.execute(text("SELECT id_usuario FROM usuarios WHERE email = :email"), {"email": user.email}).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado.")
        
    hashed_pw = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    db.execute(text("""
        INSERT INTO usuarios (nombre_completo, email, password_hash, id_rol, estado)
        VALUES (:nom, :email, :pw, :rol, 1)
    """), {
        "nom": user.nombre_completo,
        "email": user.email,
        "pw": hashed_pw,
        "rol": user.id_rol
    })
    db.commit()
    return {"status": "success", "message": "Usuario creado correctamente."}

@router.put("/usuarios/{usuario_id}")
def update_usuario(usuario_id: int, user: UsuarioUpdate, db: Session = Depends(get_db)):
    db_user = db.execute(text("SELECT * FROM usuarios WHERE id_usuario = :uid"), {"uid": usuario_id}).fetchone()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    updates = []
    params = {"uid": usuario_id}

    if user.nombre_completo is not None:
        updates.append("nombre_completo = :nom")
        params["nom"] = user.nombre_completo
    if user.email is not None:
        # Check if email exists in another user
        existing = db.execute(text("SELECT id_usuario FROM usuarios WHERE email = :email AND id_usuario != :uid"), {"email": user.email, "uid": usuario_id}).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="El email ya está en uso.")
        updates.append("email = :email")
        params["email"] = user.email
    if user.id_rol is not None:
        updates.append("id_rol = :rol")
        params["rol"] = user.id_rol
    if user.estado is not None:
        updates.append("estado = :est")
        params["est"] = user.estado
    if user.password:
        hashed_pw = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        updates.append("password_hash = :pw")
        params["pw"] = hashed_pw

    if updates:
        query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id_usuario = :uid"
        db.execute(text(query), params)
        db.commit()

    return {"status": "success", "message": "Usuario actualizado correctamente."}

@router.delete("/usuarios/{usuario_id}")
def delete_usuario(usuario_id: int, db: Session = Depends(get_db)):
    db.execute(text("UPDATE usuarios SET estado = 0 WHERE id_usuario = :uid"), {"uid": usuario_id})
    db.commit()
    return {"status": "success", "message": "Usuario desactivado lógicamente."}

@router.get("/roles", response_model=List[RolResponse])
def get_roles(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT id_rol, nombre, descripcion, estado FROM roles WHERE estado = 1")).mappings().all()
    return result

