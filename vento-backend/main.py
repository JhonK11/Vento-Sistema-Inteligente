import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from services.imagenes import IMAGE_DIR
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import re

from routers import auth, productos, ventas, movimientos, dashboard, catalogos, proveedores, compras, reportes, usuarios, configuracion, predicciones, consultas, caja

app = FastAPI(title="Vento API", description="API robusta para el sistema VENTO")
IMAGE_DIR.mkdir(parents=True, exist_ok=True)
app.mount('/media/productos', StaticFiles(directory=str(IMAGE_DIR), check_dir=False), name='imagenes-productos')

# Configuracion de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000").split(","), 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_db_error(error_msg: str):
    if "1644" in error_msg:
        if "Stock insuficiente" in error_msg:
            return 400, "Operación denegada: Stock insuficiente o dejaría el stock en negativo. Por favor, realiza un traslado de otro almacén o registra una compra."
        match = re.search(r"\(1644,\s*'(.*?)'\)", error_msg)
        if match:
            return 400, f"Imposible: {match.group(1)}"
            
    if "1062" in error_msg or "Duplicate entry" in error_msg:
        return 400, "El registro ya existe. Verifica que no haya datos duplicados."
        
    if "1451" in error_msg:
        return 400, "No se puede eliminar porque está siendo usado en otras partes del sistema."
        
    if "1452" in error_msg:
        return 400, "Referencia no válida. El registro asociado no existe."
        
    return None, None

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    status, detail = parse_db_error(str(exc.detail))
    if status:
        return JSONResponse(
            status_code=status,
            content={"status": "error", "code": status, "detail": detail},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "code": exc.status_code, "detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [{"loc": err["loc"], "msg": err["msg"], "type": err["type"]} for err in exc.errors()]
    return JSONResponse(
        status_code=422,
        content={"status": "error", "code": 422, "detail": "Error de validacion", "errors": errors},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    error_msg = str(exc)
    
    status, detail = parse_db_error(error_msg)
    if status:
        return JSONResponse(
            status_code=status,
            content={"status": "error", "code": status, "detail": detail},
        )

    return JSONResponse(
        status_code=500,
        content={"status": "error", "code": 500, "detail": error_msg},
    )

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "API de Vento ejecutandose correctamente con MySQL y Routers"}

# Registrar los Routers
app.include_router(auth.router)
app.include_router(productos.router)
app.include_router(ventas.router)
app.include_router(caja.router)
app.include_router(movimientos.router)
app.include_router(dashboard.router)
app.include_router(catalogos.router)
app.include_router(proveedores.router)
app.include_router(compras.router)
app.include_router(reportes.router)
app.include_router(usuarios.router)
app.include_router(configuracion.router)
app.include_router(predicciones.router)
app.include_router(consultas.router)
