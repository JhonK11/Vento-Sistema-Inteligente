"""Prueba explícita en una base temporal propia; no escribe en la base comercial."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path
import re
import sys
from threading import Event
import time
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import DBAPIError
from fastapi import HTTPException
from database import engine
from schemas.caja import AperturaCaja, CierreCaja
from schemas.ventas import VentaCreate
from services.caja import abrir_caja, cerrar_caja
from services.ventas import guardar_venta


def verificar():
    temporal = 'vento_test_caja_' + uuid4().hex[:12]
    assert re.fullmatch(r'vento_test_caja_[a-f0-9]{12}', temporal)
    origen = engine.url.database
    assert origen and re.fullmatch(r'[a-zA-Z0-9_]+', origen)
    creado = False
    prueba = None
    try:
        with engine.connect() as conn:
            conn.execute(text(f'CREATE DATABASE `{temporal}` CHARACTER SET utf8mb4'))
            creado = True
            for tabla in ['usuarios','almacenes','clientes','unidades_medida','productos','inventario',
                          'ventas','ventas_detalle','movimientos_inventario','caja_turnos','caja_movimientos']:
                conn.execute(text(f'CREATE TABLE `{temporal}`.`{tabla}` LIKE `{origen}`.`{tabla}`'))
            trigger = conn.execute(text('SHOW CREATE TRIGGER trg_movinv_before_insert')).mappings().one()['SQL Original Statement']
        prueba = create_engine(engine.url.set(database=temporal), pool_pre_ping=True)
        sesiones = sessionmaker(bind=prueba)
        with prueba.begin() as conn:
            trigger = re.sub(r'DEFINER\s*=\s*`[^`]+`@`[^`]+`\s*', '', trigger, count=1)
            conn.execute(text(trigger))
            conn.execute(text("INSERT INTO usuarios (id_usuario,id_rol,nombre_completo,email,password_hash) VALUES (1,1,'Cajero de prueba','caja@example.invalid','no-utilizado')"))
            conn.execute(text("INSERT INTO almacenes (id_almacen,nombre,tipo) VALUES (1,'Almacen prueba','PRINCIPAL')"))
            conn.execute(text("INSERT INTO clientes (id_cliente,tipo_documento,numero_documento,nombre_razon_social) VALUES (1,'DNI','00000000','Cliente prueba')"))
            conn.execute(text("INSERT INTO unidades_medida (id_unidad,codigo,nombre) VALUES (1,'UND','Unidad')"))
            conn.execute(text("INSERT INTO productos (id_producto,sku,nombre,id_categoria,id_unidad,costo_promedio_pen) VALUES (1,'TEST','Producto prueba',1,1,3.25)"))
            conn.execute(text('INSERT INTO inventario (id_producto,id_almacen,stock_actual,stock_reservado) VALUES (1,1,20,2)'))
        usuario = {'id_usuario':1, 'rol_nombre':'ADMINISTRADOR'}
        with sesiones() as db:
            tid = abrir_caja(db, AperturaCaja(id_almacen=1, fondo_inicial=Decimal('50')), usuario)['id_turno']
        def venta(numero, cantidad=1):
            return VentaCreate(numero_venta=numero, id_cliente=1, id_almacen=1,id_turno=tid,
                metodo_pago='EFECTIVO',monto_recibido=30,
                detalle=[{'id_producto':1,'cantidad':cantidad,'precio_unitario':10,'costo_unitario':999}])
        req = venta('MYSQL-1',2)
        with sesiones() as db:
            primera = guardar_venta(db, req, usuario)
            repetida = guardar_venta(db, req, usuario)
            assert repetida['id_venta'] == primera['id_venta'] and repetida['repetida']
            assert db.execute(text('SELECT costo_unitario FROM ventas_detalle')).scalar() == Decimal('3.2500')
            assert db.execute(text('SELECT stock_actual FROM inventario')).scalar() == Decimal('18')
        print('MySQL: costo del servidor, stock e idempotencia OK.')

        venta_lista, permitir_commit, cierre_iniciado = Event(), Event(), Event()
        def venta_pendiente():
            with sesiones() as db:
                def esperar(_):
                    venta_lista.set()
                    if not permitir_commit.wait(10):
                        raise RuntimeError('Tiempo de espera de prueba agotado')
                event.listen(db, 'before_commit', esperar, once=True)
                return guardar_venta(db, venta('MYSQL-2'), usuario)
        def cierre_simultaneo():
            with sesiones() as db:
                # Abrir el mismo snapshot que crea la dependencia de autenticación.
                db.execute(text('SELECT id_usuario FROM usuarios WHERE id_usuario=1')).first()
                cierre_iniciado.set()
                return cerrar_caja(db, tid, CierreCaja(efectivo_contado=Decimal('80')), usuario)
        with ThreadPoolExecutor(max_workers=2) as executor:
            futura_venta = executor.submit(venta_pendiente)
            assert venta_lista.wait(10)
            futuro_cierre = executor.submit(cierre_simultaneo)
            assert cierre_iniciado.wait(10)
            time.sleep(0.15)
            permitir_commit.set()
            futura_venta.result(timeout=10)
            cerrado = futuro_cierre.result(timeout=10)
        assert cerrado['efectivo_esperado_cierre'] == Decimal('80') and cerrado['diferencia'] == Decimal('0')
        with sesiones() as db:
            assert db.execute(text('SELECT COUNT(*) FROM ventas')).scalar() == 2
            assert db.execute(text('SELECT stock_actual FROM inventario')).scalar() == Decimal('17')
            try:
                guardar_venta(db, venta('MYSQL-CERRADA'), usuario)
            except HTTPException as exc:
                assert exc.status_code == 409
            else:
                raise AssertionError('Se aceptó una venta en turno cerrado')
        print('MySQL: cierre concurrente incluye la venta; turno cerrado rechaza ventas nuevas. OK.')
        with sesiones() as db:
            tid = abrir_caja(db, AperturaCaja(id_almacen=1, fondo_inicial=Decimal('0')), usuario)['id_turno']
        with prueba.begin() as conn:
            conn.execute(text("CREATE TRIGGER test_fallo_detalle BEFORE INSERT ON ventas_detalle FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fallo de prueba'"))
        with sesiones() as db:
            try:
                guardar_venta(db, venta('MYSQL-ROLLBACK'), usuario)
            except DBAPIError:
                pass
            else:
                raise AssertionError('No se produjo el fallo de prueba')
            assert db.execute(text('SELECT COUNT(*) FROM ventas')).scalar() == 2
            assert db.execute(text('SELECT COUNT(*) FROM ventas_detalle')).scalar() == 2
            assert db.execute(text('SELECT stock_actual FROM inventario')).scalar() == Decimal('17')
        print('MySQL: fallo del detalle revierte cabecera y conserva el inventario. OK.')
    finally:
        if prueba is not None:
            prueba.dispose()
        # Solo eliminar la base de nombre aleatorio creada por esta ejecución.
        if creado and re.fullmatch(r'vento_test_caja_[a-f0-9]{12}', temporal):
            with engine.connect() as conn:
                conn.execute(text(f'DROP DATABASE `{temporal}`'))
            print('Base temporal de prueba eliminada.')


if __name__ == '__main__':
    verificar()
