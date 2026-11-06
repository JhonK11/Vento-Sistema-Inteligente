"""Regresiones de permisos, atomicidad y cálculos; nunca escribe en MySQL."""
import asyncio
from datetime import date, timedelta
import json
import unittest
from urllib.parse import urlsplit
from unittest.mock import patch

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import get_db
from main import app
from routers.auth import create_access_token
from services.abastecimiento import politica_reposicion, pronosticar, serie_diaria


async def request(method, path, token=None, data=None, raw=None, content_type='application/json'):
    """Cliente ASGI mínimo, sin servidores ni dependencias de red."""
    body = raw if raw is not None else json.dumps(data).encode() if data is not None else b""
    headers = [(b"content-type", content_type.encode())]
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    url = urlsplit(path)
    scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"},
             "http_version": "1.1", "method": method, "scheme": "http",
             "path": url.path, "raw_path": url.path.encode(), "query_string": url.query.encode(),
             "root_path": "", "headers": headers, "client": ("test", 1), "server": ("test", 80)}
    messages = []
    delivered = False

    async def receive():
        nonlocal delivered
        if not delivered:
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}
        await asyncio.Event().wait()

    async def send(message):
        messages.append(message)

    try:
        await app(scope, receive, send)
    except Exception:
        # Starlette vuelve a lanzar errores 500 después de emitir su respuesta.
        if not any(m["type"] == "http.response.start" for m in messages):
            raise
    status = next(m["status"] for m in messages if m["type"] == "http.response.start")
    payload = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    try:
        return status, json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return status, payload


class DatabaseFixture(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self.sessions = sessionmaker(bind=self.engine)
        ddl = [
            "CREATE TABLE roles (id_rol INTEGER PRIMARY KEY, nombre TEXT, estado INTEGER)",
            "CREATE TABLE usuarios (id_usuario INTEGER PRIMARY KEY, id_rol INTEGER, nombre_completo TEXT, email TEXT, estado INTEGER)",
            "CREATE TABLE categorias (id_categoria INTEGER PRIMARY KEY, nombre TEXT, estado INTEGER)",
            "CREATE TABLE unidades_medida (id_unidad INTEGER PRIMARY KEY, codigo TEXT, nombre TEXT, es_fraccionable INTEGER)",
            "CREATE TABLE productos (id_producto INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT UNIQUE, nombre TEXT, id_categoria INTEGER NOT NULL, id_unidad INTEGER NOT NULL, peso_kg REAL DEFAULT 0, volumen_m3 REAL DEFAULT 0, costo_promedio_pen REAL DEFAULT 0, fecha_creacion TEXT DEFAULT '2026-09-01 00:00:00', activo INTEGER DEFAULT 1, estado TEXT DEFAULT 'ACTIVO')",
            "CREATE TABLE historial_precios (id_historial_precio INTEGER PRIMARY KEY, id_producto INTEGER, tipo_precio TEXT, valor REAL, fecha_inicio TEXT, id_usuario INTEGER, motivo TEXT, fecha_fin TEXT)",
            "CREATE TABLE inventario (id_producto INTEGER, id_almacen INTEGER, stock_actual REAL, stock_reservado REAL DEFAULT 0)",
            "CREATE TABLE proveedores (id_proveedor INTEGER PRIMARY KEY, razon_social TEXT, estado INTEGER, tiempo_entrega_dias_prom INTEGER)",
            "CREATE TABLE producto_proveedor (id_producto INTEGER, id_proveedor INTEGER, es_principal INTEGER, tiempo_entrega_dias INTEGER)",
            "CREATE TABLE ventas (id_venta INTEGER PRIMARY KEY, fecha TEXT, estado TEXT)",
            "CREATE TABLE ventas_detalle (id_producto INTEGER, id_venta INTEGER, cantidad REAL)",
        ]
        with self.engine.begin() as conn:
            for statement in ddl:
                conn.execute(text(statement))
            conn.execute(text('ALTER TABLE productos ADD COLUMN imagen_url TEXT NULL'))
            conn.execute(text('ALTER TABLE productos ADD COLUMN codigo_barras TEXT NULL'))
            for uid, rol in enumerate(['ADMINISTRADOR', 'GERENCIA', 'COMPRAS', 'ALMACEN', 'VENTAS'], 1):
                conn.execute(text("INSERT INTO roles VALUES (:uid, :rol, 1)"), {"uid": uid, "rol": rol})
                conn.execute(text("INSERT INTO usuarios VALUES (:uid, :uid, 'Prueba', 'test@example.com', 1)"), {"uid": uid})
            conn.execute(text("INSERT INTO categorias VALUES (1, 'Prueba', 1)"))
            conn.execute(text("INSERT INTO unidades_medida VALUES (1, 'UND', 'Unidad', 0)"))

        def db_override():
            with self.sessions() as db:
                yield db
        app.dependency_overrides[get_db] = db_override

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()

    def token(self, uid=1, **claims):
        return create_access_token({"sub": str(uid), **claims}, timedelta(minutes=5))

    def call(self, method, path, uid=1, data=None, token=None):
        return asyncio.run(request(method, path, token or self.token(uid), data))

class ApiTests(DatabaseFixture):
    def test_productos_incluye_barra_imagen_y_stock_del_almacen(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO productos (id_producto,sku,nombre,id_categoria,id_unidad,codigo_barras,imagen_url) VALUES (1,'A','Producto',1,1,'7750001','/media/productos/foto.webp')"))
            conn.execute(text('INSERT INTO inventario VALUES (1,1,10,2),(1,2,20,5)'))
        status, productos = self.call('GET', '/api/productos?almacen_id=1', uid=5)
        self.assertEqual(status, 200, productos)
        self.assertEqual(productos[0]['stock_disponible'], 8)
        self.assertEqual(productos[0]['codigo_barras'], '7750001')
        self.assertEqual(productos[0]['imagen_url'], '/media/productos/foto.webp')
        self.assertEqual(self.call('GET', '/api/productos?almacen_id=2', uid=5)[1][0]['stock_disponible'], 15)
        self.assertEqual(self.call('GET', '/api/productos', uid=5)[1][0]['stock_disponible'], 23)

    def test_ventas_no_puede_invocar_operaciones_de_otros_roles(self):
        operations = [('POST', '/api/productos'), ('PUT', '/api/productos/1'),
                      ('DELETE', '/api/productos/1'), ('POST', '/api/proveedores'),
                      ('DELETE', '/api/proveedores/1'), ('POST', '/api/compras'),
                      ('POST', '/api/categorias'), ('GET', '/api/dashboard/kpis'),
                      ('GET', '/api/predicciones/productos'), ('GET', '/api/movimientos')]
        for method, path in operations:
            with self.subTest(path=path, method=method):
                self.assertEqual(self.call(method, path, uid=5, data={})[0], 403)

    def test_compras_no_puede_registrar_ventas(self):
        self.assertEqual(self.call('POST', '/api/ventas', uid=3, data={})[0], 403)

    def test_usuario_desactivado_pierde_acceso_con_token_existente(self):
        token = self.token()
        with self.engine.begin() as conn:
            conn.execute(text("UPDATE usuarios SET estado=0 WHERE id_usuario=1"))
        self.assertEqual(self.call('GET', '/api/auth/me', token=token)[0], 401)

    def test_rol_actual_prevalece_sobre_jwt(self):
        token = self.token(5, user={"id_usuario": 1, "rol_nombre": "ADMINISTRADOR"})
        self.assertEqual(self.call('DELETE', '/api/productos/1', token=token)[0], 403)
        with self.engine.begin() as conn:
            conn.execute(text("UPDATE usuarios SET id_rol=3 WHERE id_usuario=5"))
        status, payload = self.call('GET', '/api/auth/me', token=token)
        self.assertEqual(status, 200)
        self.assertEqual(payload['rol_nombre'], 'COMPRAS')
        self.assertEqual(payload['id_usuario'], 5)

    def test_token_sin_expiracion_es_rechazado(self):
        import jwt
        from routers.auth import SECRET_KEY, ALGORITHM
        token = jwt.encode({'sub': '1'}, SECRET_KEY, algorithm=ALGORITHM)
        self.assertEqual(self.call('GET', '/api/auth/me', token=token)[0], 401)

    def test_token_expirado_es_rechazado(self):
        token = create_access_token({'sub': '1'}, timedelta(minutes=-1))
        self.assertEqual(self.call('GET', '/api/auth/me', token=token)[0], 401)

    def test_peticion_sin_token_es_rechazada(self):
        self.assertEqual(asyncio.run(request('GET', '/api/auth/me'))[0], 401)

    def test_exportacion_vacia_es_un_excel_valido(self):
        from io import BytesIO
        from openpyxl import load_workbook
        status, contenido = self.call('GET', '/api/predicciones/plan-compras/excel', uid=3)
        self.assertEqual(status, 200)
        wb = load_workbook(BytesIO(contenido))
        self.assertEqual(wb.active['A7'].value, 'Prioridad')
        self.assertEqual(wb.active['B3'].value, 0)

    def test_fechas_pronosticadas_empiezan_despues_del_corte(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO productos (id_producto,sku,nombre,id_categoria,id_unidad) VALUES (1,'A','Prueba',1,1)"))
            conn.execute(text("INSERT INTO ventas VALUES (1,'2026-09-05 10:00:00','EMITIDA')"))
            conn.execute(text("INSERT INTO ventas_detalle VALUES (1,1,5)"))
        with patch('routers.predicciones.fecha_corte_local', return_value=date(2026,10,15)):
            status, result = self.call('GET', '/api/predicciones/arima/1', uid=4)
        self.assertEqual(status, 200, result)
        futuro = [p for p in result['timeline_grafica'] if p['pronostico'] is not None]
        self.assertEqual(futuro[0]['fecha'], '2026-10-16')
        self.assertEqual(len(futuro), 14)
        self.assertIsNone(result['producto']['costo_promedio_pen'])

    def test_producto_exige_unidad_y_categoria(self):
        status, _ = self.call('POST', '/api/productos', data={'sku': 'ABC', 'nombre': 'Prueba'})
        self.assertEqual(status, 422)

    def test_producto_y_precio_se_guardan_juntos(self):
        # SQLite implementa NOW mediante una función local, sin tocar MySQL.
        raw = self.engine.raw_connection()
        raw.create_function('NOW', 0, lambda: '2026-10-16 10:00:00')
        raw.close()
        status, payload = self.call('POST', '/api/productos', data={
            'sku': 'ABC', 'nombre': 'Prueba', 'id_categoria': 1, 'id_unidad': 1, 'precio_venta': 20,
        })
        self.assertEqual(status, 200, payload)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text('SELECT COUNT(*) FROM productos')).scalar(), 1)
            self.assertEqual(conn.execute(text('SELECT COUNT(*) FROM historial_precios')).scalar(), 1)

    def test_fallo_del_precio_revierte_producto(self):
        raw = self.engine.raw_connection()
        raw.create_function('NOW', 0, lambda: '2026-10-16 10:00:00')
        raw.close()
        with self.engine.begin() as conn:
            conn.execute(text("CREATE TRIGGER precio_falla BEFORE INSERT ON historial_precios BEGIN SELECT RAISE(ABORT, 'precio rechazado'); END"))
        status, _ = self.call('POST', '/api/productos', data={
            'sku': 'ABC', 'nombre': 'Prueba', 'id_categoria': 1, 'id_unidad': 1,
        })
        self.assertEqual(status, 500)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text('SELECT COUNT(*) FROM productos')).scalar(), 0)

    def test_resumen_no_duplica_ventas_por_almacen_o_proveedor(self):
        with self.engine.begin() as conn:
            for sql in [
                "INSERT INTO productos (id_producto, sku, nombre, id_categoria, id_unidad, costo_promedio_pen) VALUES (1,'A','Prueba',1,1,5)",
                "INSERT INTO inventario VALUES (1,1,0,0),(1,2,0,0)",
                "INSERT INTO proveedores VALUES (1,'Uno',1,7),(2,'Dos',1,7)",
                "INSERT INTO producto_proveedor VALUES (1,1,1,7),(1,2,1,7)",
                "INSERT INTO ventas VALUES (1,'2026-10-10 10:00:00','EMITIDA'),(2,'2026-10-11 10:00:00','ANULADA')",
                "INSERT INTO ventas_detalle VALUES (1,1,30),(1,2,900)",
            ]:
                conn.execute(text(sql))
        with patch('routers.predicciones.fecha_corte_local', return_value=date(2026,10,15)):
            status, result = self.call('GET', '/api/predicciones/resumen-abastecimiento', uid=3)
        self.assertEqual(status, 200, result)
        self.assertEqual(len(result['sugerencias_compra']), 1)
        self.assertEqual(result['sugerencias_compra'][0]['ventas_ultimos_30d'], 30)
        self.assertEqual(result['sugerencias_compra'][0]['demanda_diaria_estimada'], 1)


class PoliticaTests(unittest.TestCase):
    def test_clave_publica_anterior_no_se_admite(self):
        import os
        from settings import jwt_secret
        with patch.dict(os.environ, {'SECRET_KEY': 'vento_super_secret_key_2026_secure_32_bytes'}):
            with self.assertRaises(RuntimeError):
                jwt_secret()

    def test_dias_sin_ventas_hasta_el_corte_no_se_omiten(self):
        serie = serie_diaria([{'fecha': date(2026,10,1), 'cantidad': 10}], date(2026,10,1), date(2026,10,15))
        self.assertEqual(len(serie), 15)
        self.assertEqual(serie.sum(), 10)
        self.assertEqual(serie.iloc[-1], 0)
        modelo = pronosticar(serie, 14, 0.95)
        self.assertEqual(modelo['calidad'], 'LIMITADO')
        self.assertAlmostEqual(modelo['valores'][0], 10 / 15)

    def test_sin_ventas_no_inventa_compras(self):
        serie = serie_diaria([], date(2026,10,1), date(2026,10,15))
        modelo = pronosticar(serie, 14, 0.95)
        self.assertEqual(modelo['valores'].sum(), 0)
        politica = politica_reposicion(0, 0, 7, 0, None)
        self.assertEqual(politica['cantidad_sugerida_compra'], 0)
        self.assertIsNone(politica['dias_cobertura'])

    def test_stock_disponible_y_costos_desconocidos(self):
        sin_reservas = politica_reposicion(2, 1, 7, 40, 5)
        reservado = politica_reposicion(2, 1, 7, 0, None)
        self.assertEqual(sin_reservas['cantidad_sugerida_compra'], 0)
        self.assertGreater(reservado['cantidad_sugerida_compra'], 0)
        self.assertIsNone(reservado['inversion_estimada_pen'])
        self.assertFalse(reservado['costo_conocido'])


if __name__ == '__main__':
    unittest.main()
