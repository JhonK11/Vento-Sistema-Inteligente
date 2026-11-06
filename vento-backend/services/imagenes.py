"""Almacenamiento de fotografías normalizadas; nunca conserva el archivo original."""
from io import BytesIO
import os
from pathlib import Path
import re
from uuid import uuid4
import warnings

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import text

BASE_DIR = Path(__file__).resolve().parents[1]
IMAGE_DIR = Path(os.getenv('PRODUCT_IMAGES_DIR', str(BASE_DIR / 'uploads' / 'productos'))).resolve()
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_000_000
ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp'}


def normalizar_imagen(contenido: bytes) -> bytes:
    if not contenido:
        raise HTTPException(400, 'Selecciona una imagen.')
    if len(contenido) > MAX_IMAGE_BYTES:
        raise HTTPException(413, 'La imagen no debe superar 5 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(contenido)) as imagen:
                if imagen.format not in {'JPEG', 'PNG', 'WEBP'}:
                    raise HTTPException(415, 'Usa una imagen JPG, PNG o WebP.')
                if imagen.width * imagen.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(413, 'La imagen supera 16 megapíxeles; reduce su resolución.')
                imagen.load()
                orientada = ImageOps.exif_transpose(imagen)
                orientada.thumbnail((1200, 1200))
                # Fondo blanco para transparencias; no conservar metadatos EXIF.
                rgba = orientada.convert('RGBA')
                fondo = Image.new('RGB', rgba.size, 'white')
                fondo.paste(rgba, mask=rgba.getchannel('A'))
                salida = BytesIO()
                fondo.save(salida, format='WEBP', quality=85)
                return salida.getvalue()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise HTTPException(415, 'El archivo no es una imagen válida o está dañado.')


def eliminar_archivo(url: str | None):
    # Eliminar únicamente archivos propios, sin aceptar rutas del usuario.
    if not url or not re.fullmatch(r'/media/productos/[a-f0-9]{32}\.webp', url):
        return
    try:
        (IMAGE_DIR / url.rsplit('/', 1)[1]).unlink(missing_ok=True)
    except OSError:
        pass  # Un archivo huérfano no debe revertir un cambio ya confirmado.


def guardar_imagen(producto_id: int, contenido: bytes, db):
    normalizada = normalizar_imagen(contenido)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    nombre = uuid4().hex + '.webp'
    url = '/media/productos/' + nombre
    try:
        bloqueo = '' if db.get_bind().dialect.name == 'sqlite' else ' FOR UPDATE'
        producto = db.execute(text('SELECT imagen_url FROM productos WHERE id_producto=:pid' + bloqueo),
                              {'pid': producto_id}).mappings().first()
        if not producto:
            raise HTTPException(404, 'Producto no encontrado.')
        anterior = producto['imagen_url']
        (IMAGE_DIR / nombre).write_bytes(normalizada)
        db.execute(text('UPDATE productos SET imagen_url=:url WHERE id_producto=:pid'),
                   {'url': url, 'pid': producto_id})
        db.commit()
    except Exception:
        db.rollback()
        eliminar_archivo(url)
        raise
    eliminar_archivo(anterior)
    return {'status': 'success', 'imagen_url': url}


def quitar_imagen(producto_id: int, db):
    try:
        bloqueo = '' if db.get_bind().dialect.name == 'sqlite' else ' FOR UPDATE'
        producto = db.execute(text('SELECT imagen_url FROM productos WHERE id_producto=:pid' + bloqueo),
                              {'pid': producto_id}).mappings().first()
        if not producto:
            raise HTTPException(404, 'Producto no encontrado.')
        anterior = producto['imagen_url']
        db.execute(text('UPDATE productos SET imagen_url=NULL WHERE id_producto=:pid'), {'pid': producto_id})
        db.commit()
    except Exception:
        db.rollback()
        raise
    eliminar_archivo(anterior)
    return {'status': 'success', 'imagen_url': None}
