import asyncio
from io import BytesIO
from pathlib import Path
import tempfile
from unittest.mock import patch

from PIL import Image
from sqlalchemy import text

from main import app
from test_confiabilidad import DatabaseFixture, request


def png(ancho=32, alto=32):
    salida = BytesIO()
    Image.new('RGBA', (ancho, alto), (255, 0, 0, 0)).save(salida, format='PNG')
    return salida.getvalue()


class ImagenTests(DatabaseFixture):
    def setUp(self):
        super().setUp()
        self.carpeta = tempfile.TemporaryDirectory(prefix='vento-imagenes-test-')
        self.addCleanup(self.carpeta.cleanup)
        self.archivos = Path(self.carpeta.name).resolve()
        self.parche = patch('services.imagenes.IMAGE_DIR', self.archivos)
        self.parche.start()
        self.addCleanup(self.parche.stop)
        media = next(r.app for r in app.routes if getattr(r, 'path', '') == '/media/productos')
        for atributo, valor in [('directory', str(self.archivos)), ('all_directories', [str(self.archivos)])]:
            parche = patch.object(media, atributo, valor)
            parche.start()
            self.addCleanup(parche.stop)
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO productos (id_producto,sku,nombre,id_categoria,id_unidad) VALUES (1,'FOTO','Producto',1,1)"))

    def subir(self, contenido=None, uid=1, tipo='image/png', producto=1):
        return asyncio.run(request('PUT', f'/api/productos/{producto}/imagen', self.token(uid),
                                   raw=contenido if contenido is not None else png(), content_type=tipo))

    def foto_guardada(self):
        with self.engine.connect() as conn:
            return conn.execute(text('SELECT imagen_url FROM productos WHERE id_producto=1')).scalar()

    def test_subida_optimiza_imagen_y_permite_mostrarla(self):
        status, result = self.subir(png(1600, 100))
        self.assertEqual(status, 200, result)
        self.assertEqual(self.foto_guardada(), result['imagen_url'])
        archivo = self.archivos / result['imagen_url'].rsplit('/', 1)[1]
        with Image.open(archivo) as foto:
            self.assertEqual(foto.format, 'WEBP')
            self.assertLessEqual(foto.width, 1200)
            self.assertEqual(len(foto.getexif()), 0)
            self.assertGreater(min(foto.convert('RGB').getpixel((0, 0))), 240)
        status, data = asyncio.run(request('GET', result['imagen_url']))
        self.assertEqual(status, 200)
        self.assertEqual(data, archivo.read_bytes())

    def test_cajero_no_puede_subir_ni_quitar_fotos(self):
        self.assertEqual(self.subir(uid=5)[0], 403)
        self.assertEqual(self.call('DELETE', '/api/productos/1/imagen', uid=5)[0], 403)
        self.assertEqual(list(self.archivos.iterdir()), [])

    def test_almacen_puede_subir(self):
        self.assertEqual(self.subir(uid=4)[0], 200)

    def test_archivo_disfrazado_de_imagen_se_rechaza(self):
        self.assertEqual(self.subir(b'<html>No soy una foto</html>')[0], 415)
        self.assertIsNone(self.foto_guardada())
        self.assertEqual(list(self.archivos.iterdir()), [])

    def test_svg_no_se_admite(self):
        self.assertEqual(self.subir(b'<svg/>', tipo='image/svg+xml')[0], 415)

    def test_limite_de_tamano(self):
        with patch('routers.productos.MAX_IMAGE_BYTES', 16):
            self.assertEqual(self.subir()[0], 413)
        self.assertIsNone(self.foto_guardada())

    def test_limite_de_resolucion(self):
        with patch('services.imagenes.MAX_IMAGE_PIXELS', 100):
            self.assertEqual(self.subir()[0], 413)

    def test_reemplazo_elimina_foto_anterior(self):
        _, primera = self.subir()
        status, segunda = self.subir()
        self.assertEqual(status, 200)
        self.assertNotEqual(primera['imagen_url'], segunda['imagen_url'])
        self.assertEqual(len(list(self.archivos.iterdir())), 1)
        self.assertEqual(self.foto_guardada(), segunda['imagen_url'])

    def test_eliminar_conserva_producto(self):
        self.subir()
        self.assertEqual(self.call('DELETE', '/api/productos/1/imagen')[0], 200)
        self.assertIsNone(self.foto_guardada())
        self.assertEqual(list(self.archivos.iterdir()), [])
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text('SELECT COUNT(*) FROM productos')).scalar(), 1)

    def test_producto_inexistente_no_deja_archivos(self):
        self.assertEqual(self.subir(producto=999)[0], 404)
        self.assertEqual(list(self.archivos.iterdir()), [])

    def test_fallo_de_base_conserva_foto_anterior(self):
        _, primera = self.subir()
        with self.engine.begin() as conn:
            conn.execute(text("CREATE TRIGGER falla_foto BEFORE UPDATE OF imagen_url ON productos BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END"))
        self.assertEqual(self.subir()[0], 500)
        self.assertEqual(self.foto_guardada(), primera['imagen_url'])
        self.assertEqual(len(list(self.archivos.iterdir())), 1)
