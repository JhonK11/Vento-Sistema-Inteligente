"""Venta y caja en la misma transacción, conservando los triggers del kardex."""
from collections import defaultdict
from decimal import Decimal
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from services.caja import ahora_local, bloqueo_sql, dinero, obtener_turno


def firma_solicitud(req, usuario_id):
    detalle = sorted((i.id_producto, format(i.cantidad.normalize(), 'f'), format(i.precio_unitario.normalize(), 'f')) for i in req.detalle)
    datos = {'usuario': usuario_id, 'turno': req.id_turno, 'almacen': req.id_almacen, 'cliente': req.id_cliente,
             'numero': req.numero_venta, 'metodo': req.metodo_pago,
             'recibido': str(dinero(req.monto_recibido)) if req.metodo_pago == 'EFECTIVO' and req.monto_recibido is not None else None,
             'detalle': detalle}
    return hashlib.sha256(json.dumps(datos, sort_keys=True).encode()).hexdigest()


def respuesta_venta(venta, repetida=False):
    return {'status': 'success', 'message': 'Venta registrada exitosamente', 'id_venta': venta['id_venta'],
            'numero_venta': venta['numero_venta'], 'fecha': venta['fecha'], 'id_turno': venta['id_turno'], 'total': dinero(venta['total']),
            'monto_recibido': dinero(venta['monto_recibido']) if venta['monto_recibido'] is not None else None,
            'vuelto': dinero(venta['vuelto']) if venta['vuelto'] is not None else None,
            'costo_verificado': bool(venta['costo_verificado']), 'repetida': repetida}


def guardar_venta(db, req, usuario):
    firma = firma_solicitud(req, usuario['id_usuario'])
    try:
        # El mismo bloqueo coordina ventas, movimientos y cierre del turno.
        turno = obtener_turno(db, req.id_turno, usuario, bloquear=True)
        if turno['id_usuario'] != usuario['id_usuario']:
            raise HTTPException(403, 'Las ventas deben registrarse en tu propio turno de caja.')
        anterior = db.execute(text('SELECT * FROM ventas WHERE numero_venta=:numero' + bloqueo_sql(db)),
                              {'numero': req.numero_venta}).mappings().first()
        if anterior:
            if anterior['solicitud_hash'] != firma or anterior['id_usuario'] != usuario['id_usuario']:
                raise HTTPException(409, 'Ese número de venta ya está registrado con otros datos. Consulta el historial.')
            respuesta = respuesta_venta(anterior, repetida=True)
            db.commit()
            return respuesta
        if turno['estado'] != 'ABIERTO':
            raise HTTPException(409, 'El turno de caja está cerrado. Abre una caja antes de vender.')
        if turno['id_almacen'] != req.id_almacen:
            raise HTTPException(409, 'La venta debe usar el almacén del turno abierto.')
        cliente = db.execute(text('SELECT id_cliente FROM clientes WHERE id_cliente=:cid AND estado=1'), {'cid': req.id_cliente}).first()
        if not cliente:
            raise HTTPException(400, 'Selecciona un cliente activo.')
        cantidades = defaultdict(Decimal)
        for item in req.detalle:
            cantidades[item.id_producto] += item.cantidad
        productos = {}
        for pid in sorted(cantidades):
            prod = db.execute(text('SELECT * FROM productos WHERE id_producto=:pid' + bloqueo_sql(db)), {'pid': pid}).mappings().first()
            if not prod or not prod['activo'] or prod['estado'] != 'ACTIVO':
                raise HTTPException(409, 'Uno de los productos ya no está disponible para venta.')
            fraccionable = db.execute(text('SELECT es_fraccionable FROM unidades_medida WHERE id_unidad=:uid'), {'uid': prod['id_unidad']}).scalar()
            if not fraccionable and any(i.id_producto == pid and i.cantidad != i.cantidad.to_integral_value() for i in req.detalle):
                raise HTTPException(400, f"{prod['nombre']} se vende por unidades completas.")
            inv = db.execute(text('SELECT stock_actual, stock_reservado FROM inventario WHERE id_producto=:pid AND id_almacen=:aid' + bloqueo_sql(db)),
                             {'pid': pid, 'aid': req.id_almacen}).mappings().first()
            disponible = Decimal(str(inv['stock_actual'])) - Decimal(str(inv['stock_reservado'])) if inv else Decimal(0)
            if cantidades[pid] > disponible:
                raise HTTPException(409, f"Stock disponible insuficiente para {prod['nombre']}.")
            productos[pid] = prod
        total = dinero(sum((i.cantidad * i.precio_unitario for i in req.detalle), Decimal(0)))
        if total <= 0 or total > Decimal('999999999999.99'):
            raise HTTPException(400, 'El importe total de la venta no es válido.')
        recibido = req.monto_recibido if req.metodo_pago == 'EFECTIVO' else None
        if req.metodo_pago == 'EFECTIVO' and (recibido is None or recibido < total):
            raise HTTPException(400, 'El efectivo recibido debe cubrir el total de la venta.')
        vuelto = dinero(recibido - total) if recibido is not None else None
        verificado = all(Decimal(str(p['costo_promedio_pen'] or 0)) > 0 for p in productos.values())
        fecha = ahora_local()
        resultado = db.execute(text("""INSERT INTO ventas
            (numero_venta,id_cliente,id_usuario,id_almacen,fecha,metodo_pago,subtotal,descuento,impuesto,total,estado,
             id_turno,monto_recibido,vuelto,solicitud_hash,costo_verificado)
            VALUES (:numero,:cliente,:usuario,:almacen,:fecha,:metodo,:total,0,0,:total,'EMITIDA',:turno,:recibido,:vuelto,:firma,:verificado)"""),
            {'numero': req.numero_venta, 'cliente': req.id_cliente, 'usuario': usuario['id_usuario'], 'almacen': req.id_almacen,
             'fecha': fecha, 'metodo': req.metodo_pago, 'total': str(total), 'turno': req.id_turno,
             'recibido': str(recibido) if recibido is not None else None, 'vuelto': str(vuelto) if vuelto is not None else None,
             'firma': firma, 'verificado': int(verificado)})
        vid = resultado.lastrowid
        for item in sorted(req.detalle, key=lambda i: i.id_producto):
            prod = productos[item.id_producto]
            costo = Decimal(str(prod['costo_promedio_pen'] or 0))
            db.execute(text("""INSERT INTO ventas_detalle (id_venta,id_producto,id_lote,cantidad,precio_unitario,costo_unitario,producto_nombre,producto_sku)
                VALUES (:vid,:pid,NULL,:cantidad,:precio,:costo,:nombre,:sku)"""),
                {'vid': vid, 'pid': item.id_producto, 'cantidad': str(item.cantidad), 'precio': str(item.precio_unitario),
                 'costo': str(costo), 'nombre': prod['nombre'], 'sku': prod['sku']})
            # El trigger instalado calcula saldos y modifica inventario una sola vez.
            db.execute(text("""INSERT INTO movimientos_inventario
                (id_producto,id_almacen,id_lote,tipo_movimiento,cantidad,stock_anterior,stock_posterior,costo_unitario,
                 referencia_tipo,referencia_id,id_usuario,fecha)
                VALUES (:pid,:aid,NULL,'VENTA',:cantidad,0,0,:costo,'VENTA',:vid,:uid,:fecha)"""),
                {'pid': item.id_producto, 'aid': req.id_almacen, 'cantidad': str(item.cantidad), 'costo': str(costo),
                 'vid': vid, 'uid': usuario['id_usuario'], 'fecha': fecha})
        guardada = db.execute(text('SELECT * FROM ventas WHERE id_venta=:vid'), {'vid': vid}).mappings().one()
        respuesta = respuesta_venta(guardada)
        db.commit()
        return respuesta
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'No se pudo registrar la venta por un conflicto de datos. Revisa el historial antes de reintentar.')
    except Exception:
        db.rollback()
        raise
