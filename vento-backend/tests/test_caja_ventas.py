from datetime import datetime
from unittest.mock import patch
from uuid import uuid4
from sqlalchemy import text
from caja_tables import metadata, turnos, movimientos
from test_confiabilidad import DatabaseFixture


class CajaVentasTests(DatabaseFixture):
    """Flujos HTTP completos en SQLite con un trigger de inventario de prueba."""
    def setUp(self):
        super().setUp()
        self.numero = 0
        fecha = datetime(2026, 10, 17, 10, 30)
        for modulo in ['services.caja.ahora_local', 'services.ventas.ahora_local']:
            parche = patch(modulo, return_value=fecha)
            parche.start(); self.addCleanup(parche.stop)
        with self.engine.begin() as conn:
            conn.execute(text('CREATE TABLE almacenes (id_almacen INTEGER PRIMARY KEY,nombre TEXT,estado INTEGER)'))
            conn.execute(text("INSERT INTO almacenes VALUES (1,'Tienda',1),(2,'Deposito',1),(3,'Inactivo',0)"))
            conn.execute(text('CREATE TABLE clientes (id_cliente INTEGER PRIMARY KEY,nombre_razon_social TEXT,tipo_documento TEXT,numero_documento TEXT,estado INTEGER)'))
            conn.execute(text("INSERT INTO clientes VALUES (1,'Cliente & Prueba','DNI','00000001',1)"))
            conn.execute(text("INSERT INTO usuarios VALUES (6,5,'Otro cajero','otro@example.com',1)"))
            for nombre, tipo in {'numero_venta':'TEXT','id_cliente':'INTEGER','id_usuario':'INTEGER','id_almacen':'INTEGER',
                'metodo_pago':'TEXT','subtotal':'NUMERIC','descuento':'NUMERIC','impuesto':'NUMERIC','total':'NUMERIC',
                'id_turno':'INTEGER','monto_recibido':'NUMERIC','vuelto':'NUMERIC','solicitud_hash':'TEXT','costo_verificado':'INTEGER'}.items():
                conn.execute(text(f'ALTER TABLE ventas ADD COLUMN {nombre} {tipo}'))
            conn.execute(text('CREATE UNIQUE INDEX venta_numero_unique ON ventas(numero_venta)'))
            for nombre, tipo in {'id_lote':'INTEGER','precio_unitario':'NUMERIC','costo_unitario':'NUMERIC','producto_nombre':'TEXT','producto_sku':'TEXT'}.items():
                conn.execute(text(f'ALTER TABLE ventas_detalle ADD COLUMN {nombre} {tipo}'))
            conn.execute(text('''CREATE TABLE movimientos_inventario (id_movimiento INTEGER PRIMARY KEY,
                id_producto INTEGER,id_almacen INTEGER,id_lote INTEGER,tipo_movimiento TEXT,cantidad NUMERIC,
                stock_anterior NUMERIC,stock_posterior NUMERIC,costo_unitario NUMERIC,
                referencia_tipo TEXT,referencia_id INTEGER,id_usuario INTEGER,fecha TEXT)'''))
            conn.execute(text('''CREATE TRIGGER stock_venta AFTER INSERT ON movimientos_inventario BEGIN
                UPDATE movimientos_inventario SET stock_anterior=(SELECT stock_actual FROM inventario WHERE id_producto=NEW.id_producto AND id_almacen=NEW.id_almacen),
                    stock_posterior=(SELECT stock_actual-NEW.cantidad FROM inventario WHERE id_producto=NEW.id_producto AND id_almacen=NEW.id_almacen) WHERE id_movimiento=NEW.id_movimiento;
                UPDATE inventario SET stock_actual=stock_actual-NEW.cantidad WHERE id_producto=NEW.id_producto AND id_almacen=NEW.id_almacen;
                END'''))
            conn.execute(text("INSERT INTO productos (id_producto,sku,nombre,id_categoria,id_unidad,costo_promedio_pen) VALUES (1,'P1','Producto <&>',1,1,3.25)"))
            conn.execute(text('INSERT INTO inventario VALUES (1,1,20,2),(1,2,30,0)'))
            metadata.create_all(conn, tables=[turnos, movimientos])

    def abrir(self, uid=5, almacen=1, fondo='50.00'):
        status, resultado = self.call('POST', '/api/caja/abrir', uid=uid,
                                     data={'id_almacen':almacen,'fondo_inicial':fondo})
        self.assertEqual(status, 200, resultado)
        return resultado['id_turno']

    def payload(self, tid, **cambios):
        self.numero += 1
        return {'numero_venta':f'TEST-{self.numero}', 'id_cliente':1,'id_almacen':1,'id_turno':tid,
                'metodo_pago':'EFECTIVO','monto_recibido':'20.00',
                'detalle':[{'id_producto':1,'cantidad':'2','precio_unitario':'10.00','costo_unitario':'999.00'}], **cambios}

    def conteo(self, tabla):
        with self.engine.connect() as conn:
            return conn.execute(text(f'SELECT COUNT(*) FROM {tabla}')).scalar()

    def test_apertura_unica_y_reapertura_despues_del_cierre(self):
        tid = self.abrir()
        self.assertEqual(self.call('POST','/api/caja/abrir',uid=5,data={'id_almacen':1,'fondo_inicial':0})[0],409)
        self.assertEqual(self.call('POST',f'/api/caja/turnos/{tid}/cerrar',uid=5,data={'efectivo_contado':'50'})[0],200)
        self.assertNotEqual(self.abrir(), tid)

    def test_apertura_rechaza_almacen_inactivo(self):
        self.assertEqual(self.call('POST','/api/caja/abrir',uid=5,data={'id_almacen':3,'fondo_inicial':0})[0],400)
        self.assertEqual(self.conteo('caja_turnos'),0)

    def test_venta_sin_turno_o_en_turno_cerrado_no_se_registra(self):
        self.assertEqual(self.call('POST','/api/ventas',uid=5,data=self.payload(999))[0],404)
        tid = self.abrir()
        self.call('POST',f'/api/caja/turnos/{tid}/cerrar',uid=5,data={'efectivo_contado':50})
        self.assertEqual(self.call('POST','/api/ventas',uid=5,data=self.payload(tid))[0],409)
        self.assertEqual(self.conteo('ventas'),0)

    def test_venta_registra_turno_pago_y_costo_del_servidor(self):
        tid = self.abrir()
        status, venta = self.call('POST','/api/ventas',uid=5,data=self.payload(tid,monto_recibido='30.00'))
        self.assertEqual(status,200,venta)
        self.assertEqual(venta['total'],20)
        self.assertEqual(venta['vuelto'],10)
        self.assertTrue(venta['costo_verificado'])
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text('SELECT costo_unitario FROM ventas_detalle')).scalar(),3.25)
            self.assertEqual(conn.execute(text('SELECT stock_actual FROM inventario WHERE id_almacen=1')).scalar(),18)
        self.assertEqual(self.call('GET','/api/caja/actual',uid=5)[1]['efectivo_esperado'],70)

    def test_reintento_identico_no_duplica_venta_ni_stock_incluso_despues_de_cerrar(self):
        tid = self.abrir()
        payload = self.payload(tid)
        primera = self.call('POST','/api/ventas',uid=5,data=payload)[1]
        self.call('POST',f'/api/caja/turnos/{tid}/cerrar',uid=5,data={'efectivo_contado':70})
        status, segunda = self.call('POST','/api/ventas',uid=5,data=payload)
        self.assertEqual(status,200,segunda)
        self.assertEqual(segunda['id_venta'],primera['id_venta'])
        self.assertTrue(segunda['repetida'])
        self.assertEqual(self.conteo('ventas'),1)
        self.assertEqual(self.conteo('movimientos_inventario'),1)

    def test_mismo_numero_con_otro_payload_es_conflicto(self):
        tid = self.abrir()
        payload = self.payload(tid)
        self.call('POST','/api/ventas',uid=5,data=payload)
        payload['metodo_pago'] = 'TARJETA'
        self.assertEqual(self.call('POST','/api/ventas',uid=5,data=payload)[0],409)
        self.assertEqual(self.conteo('ventas'),1)

    def test_reservas_y_cantidades_acumuladas_se_validan(self):
        tid = self.abrir()
        detalle = [{'id_producto':1,'cantidad':10,'precio_unitario':1},{'id_producto':1,'cantidad':9,'precio_unitario':2}]
        self.assertEqual(self.call('POST','/api/ventas',uid=5,data=self.payload(tid,detalle=detalle,monto_recibido=40))[0],409)
        self.assertEqual(self.conteo('ventas'),0)

    def test_cantidades_fraccionarias_se_validan_en_servidor(self):
        tid = self.abrir()
        detalle = [{'id_producto':1,'cantidad':'0.5','precio_unitario':10}]
        self.assertEqual(self.call('POST','/api/ventas',uid=5,data=self.payload(tid,detalle=detalle))[0],400)

    def test_pago_insuficiente_y_otro_almacen_no_dejan_ventas(self):
        tid = self.abrir()
        self.assertEqual(self.call('POST','/api/ventas',uid=5,data=self.payload(tid,monto_recibido=19))[0],400)
        self.assertEqual(self.call('POST','/api/ventas',uid=5,data=self.payload(tid,id_almacen=2))[0],409)
        self.assertEqual(self.conteo('ventas_detalle'),0)

    def test_fallo_en_kardex_revierte_toda_la_venta(self):
        tid = self.abrir()
        with self.engine.begin() as conn:
            conn.execute(text("CREATE TRIGGER fallo_kardex BEFORE INSERT ON movimientos_inventario BEGIN SELECT RAISE(ABORT,'fallo simulado'); END"))
        self.assertEqual(self.call('POST','/api/ventas',uid=5,data=self.payload(tid))[0],409)
        self.assertEqual(self.conteo('ventas'),0)
        self.assertEqual(self.conteo('ventas_detalle'),0)
        self.assertEqual(self.call('GET','/api/caja/actual',uid=5)[1]['efectivo_esperado'],50)

    def test_arqueo_separa_efectivo_tarjeta_transferencia_y_credito(self):
        tid = self.abrir()
        for metodo, precio in [('EFECTIVO',10),('TARJETA',15),('TRANSFERENCIA',12),('CREDITO',8)]:
            payload = self.payload(tid,metodo_pago=metodo,detalle=[{'id_producto':1,'cantidad':1,'precio_unitario':precio}])
            status, resultado = self.call('POST','/api/ventas',uid=5,data=payload)
            self.assertEqual(status,200,resultado)
        resumen = self.call('GET','/api/caja/actual',uid=5)[1]
        self.assertEqual(resumen['efectivo_esperado'],60)
        self.assertEqual(resumen['ventas_total'],45)
        self.assertEqual(resumen['numero_ventas'],4)

    def test_ingreso_retiro_cierre_y_diferencia(self):
        tid = self.abrir()
        for tipo,monto in [('INGRESO',10),('RETIRO',5)]:
            self.assertEqual(self.call('POST',f'/api/caja/turnos/{tid}/movimientos',uid=5,data={'tipo':tipo,'monto':monto,'motivo':'Motivo de prueba','referencia':str(uuid4())})[0],200)
        cierre = self.call('POST',f'/api/caja/turnos/{tid}/cerrar',uid=5,data={'efectivo_contado':54})
        self.assertEqual(cierre[0],400)
        status, cerrado = self.call('POST',f'/api/caja/turnos/{tid}/cerrar',uid=5,data={'efectivo_contado':54,'observaciones':'Faltante declarado'})
        self.assertEqual(status,200,cerrado)
        self.assertEqual(cerrado['diferencia'],-1)
        self.assertEqual(cerrado['id_usuario_cierre'],5)
        self.assertEqual(cerrado['efectivo_esperado_cierre'],55)
        self.assertIsNone(self.call('GET','/api/caja/actual',uid=5)[1])
        self.assertEqual(self.call('POST',f'/api/caja/turnos/{tid}/movimientos',uid=5,data={'tipo':'INGRESO','monto':1,'motivo':'Ya cerrado','referencia':str(uuid4())})[0],409)

    def test_retiro_no_puede_superar_efectivo_disponible(self):
        tid = self.abrir()
        self.assertEqual(self.call('POST',f'/api/caja/turnos/{tid}/movimientos',uid=5,data={'tipo':'RETIRO','monto':51,'motivo':'Retiro excesivo','referencia':str(uuid4())})[0],409)
        self.assertEqual(self.conteo('caja_movimientos'),0)

    def test_reintento_de_movimiento_no_duplica_efectivo(self):
        tid = self.abrir()
        payload = {'tipo':'INGRESO','monto':'5.00','motivo':'Ingreso repetido','referencia':str(uuid4())}
        for _ in range(2):
            status, resultado = self.call('POST',f'/api/caja/turnos/{tid}/movimientos',uid=5,data=payload)
            self.assertEqual(status,200,resultado)
        self.assertEqual(self.conteo('caja_movimientos'),1)
        self.assertEqual(resultado['efectivo_esperado'],55)
        payload['monto'] = '6.00'
        self.assertEqual(self.call('POST',f'/api/caja/turnos/{tid}/movimientos',uid=5,data=payload)[0],409)
        self.assertEqual(self.conteo('caja_movimientos'),1)

    def test_roles_y_privacidad_de_turnos_y_ventas(self):
        tid = self.abrir()
        vid = self.call('POST','/api/ventas',uid=5,data=self.payload(tid))[1]['id_venta']
        self.assertEqual(self.call('GET',f'/api/caja/turnos/{tid}',uid=6)[0],404)
        self.assertEqual(self.call('GET',f'/api/ventas/{vid}',uid=6)[0],404)
        self.assertEqual(self.call('GET',f'/api/ventas/{vid}/ticket-pdf',uid=6)[0],404)
        self.assertEqual(self.call('GET','/api/ventas',uid=6)[1]['total'],0)
        self.assertEqual(self.call('GET','/api/ventas',uid=2)[1]['total'],1)
        self.assertEqual(self.call('POST',f'/api/caja/turnos/{tid}/cerrar',uid=2,data={'efectivo_contado':70})[0],403)
        self.assertEqual(self.call('GET','/api/caja/turnos',uid=3)[0],403)
        self.assertEqual(self.call('POST','/api/ventas',uid=1,data=self.payload(tid))[0],403)

    def test_historial_filtros_y_reimpresion_con_snapshot(self):
        tid = self.abrir()
        vid = self.call('POST','/api/ventas',uid=5,data=self.payload(tid))[1]['id_venta']
        with self.engine.begin() as conn:
            conn.execute(text("UPDATE productos SET nombre='Nombre cambiado' WHERE id_producto=1"))
        self.assertEqual(self.call('GET','/api/ventas?fecha_desde=2026-10-17&fecha_hasta=2026-10-17&metodo=EFECTIVO',uid=5)[1]['total'],1)
        self.assertEqual(self.call('GET','/api/ventas?metodo=TARJETA',uid=5)[1]['total'],0)
        self.assertEqual(self.call('GET',f'/api/ventas?turno_id={tid}',uid=5)[1]['total'],1)
        self.assertEqual(self.call('GET','/api/ventas?buscar=Cliente',uid=5)[1]['total'],1)
        detalle = self.call('GET',f'/api/ventas/{vid}',uid=5)[1]
        self.assertEqual(detalle['items'][0]['nombre'],'Producto <&>')
        self.assertNotIn('solicitud_hash',detalle)
        status,pdf = self.call('GET',f'/api/ventas/{vid}/ticket-pdf',uid=5)
        self.assertEqual(status,200)
        self.assertTrue(pdf.startswith(b'%PDF'))

    def test_historico_sin_turno_se_mantiene_fuera_del_arqueo(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO ventas (numero_venta,id_cliente,id_usuario,id_almacen,fecha,metodo_pago,subtotal,descuento,impuesto,total,estado) VALUES ('ANTERIOR',1,5,1,'2026-10-10','EFECTIVO',100,0,0,100,'EMITIDA')"))
        self.abrir()
        self.assertEqual(self.call('GET','/api/ventas',uid=5)[1]['resumen']['sin_turno'],1)
        self.assertEqual(self.call('GET','/api/caja/actual',uid=5)[1]['efectivo_esperado'],50)

    def test_costo_desconocido_no_se_inventa_ni_se_marca_verificado(self):
        with self.engine.begin() as conn:
            conn.execute(text('UPDATE productos SET costo_promedio_pen=0 WHERE id_producto=1'))
        tid = self.abrir()
        status,venta = self.call('POST','/api/ventas',uid=5,data=self.payload(tid))
        self.assertEqual(status,200,venta)
        self.assertFalse(venta['costo_verificado'])
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text('SELECT costo_unitario FROM ventas_detalle')).scalar(),0)

    def test_subtotal_y_vuelto_fraccionarios_coinciden_con_caja(self):
        with self.engine.begin() as conn:
            conn.execute(text('UPDATE unidades_medida SET es_fraccionable=1 WHERE id_unidad=1'))
        tid = self.abrir()
        detalle = [{'id_producto':1,'cantidad':'0.333','precio_unitario':'1'}]*2
        status,venta = self.call('POST','/api/ventas',uid=5,data=self.payload(tid,detalle=detalle,monto_recibido='1.00'))
        self.assertEqual(status,200,venta)
        self.assertEqual(venta['total'],0.67)
        self.assertEqual(venta['vuelto'],0.33)
        self.assertEqual(self.call('GET','/api/caja/actual',uid=5)[1]['efectivo_esperado'],50.67)
