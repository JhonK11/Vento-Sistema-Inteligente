import sys

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # En un entorno productivo se debe ocultar exc.detail para mayor seguridad
    return JSONResponse(
        status_code=500,
        content={"status": "error", "code": 500, "detail": str(exc)},
    )'''

new = '''@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    error_msg = str(exc)
    
    if "1644" in error_msg:
        if "Stock insuficiente" in error_msg:
            mensaje_amigable = "Operación denegada: Stock insuficiente. Por favor, realiza un traslado de otro almacén o registra una compra."
            return JSONResponse(
                status_code=400,
                content={"status": "error", "code": 400, "detail": mensaje_amigable},
            )
        import re
        match = re.search(r"\(1644,\s*'(.*?)'\)", error_msg)
        if match:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "code": 400, "detail": f"Imposible: {match.group(1)}"}
            )
            
    if "1062" in error_msg or "Duplicate entry" in error_msg:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "code": 400, "detail": "El registro ya existe. Verifica que no haya datos duplicados."},
        )
        
    if "1451" in error_msg:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "code": 400, "detail": "No se puede eliminar porque está siendo usado en otras partes del sistema."},
        )
        
    if "1452" in error_msg:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "code": 400, "detail": "Referencia no válida. El registro asociado no existe."},
        )

    return JSONResponse(
        status_code=500,
        content={"status": "error", "code": 500, "detail": error_msg},
    )'''

content = content.replace(old, new)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)

