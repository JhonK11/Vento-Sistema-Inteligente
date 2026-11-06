"""Migración aditiva e idempotente: python migrar_imagenes.py."""
from sqlalchemy import inspect, text
from database import engine


def migrar():
    with engine.begin() as conn:
        columnas = {columna['name'] for columna in inspect(conn).get_columns('productos')}
        if 'imagen_url' not in columnas:
            conn.execute(text('ALTER TABLE productos ADD COLUMN imagen_url VARCHAR(255) NULL'))
            print('productos.imagen_url añadida; los productos existentes se conservan.')
        else:
            print('La columna de imágenes ya existe; no se requieren cambios.')


if __name__ == '__main__':
    migrar()
