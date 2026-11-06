from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from caja_tables import turnos, movimientos


def ahora_local():
    return datetime.now(timezone(timedelta(hours=-5))).replace(tzinfo=None)


def dinero(valor):
    return Decimal(str(valor or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def bloqueo_sql(db):
    return '' if db.get_bind().dialect.name == 'sqlite' else ' FOR UPDATE'


def verificar_acceso(turno, usuario):
    if not turno or (usuario['rol_nombre'] == 'VENTAS' and turno['id_usuario'] != usuario['id_usuario']):
        raise HTTPException(404, 'Turno de caja no encontrado.')


def obtener_turno(db, turno_id, usuario, bloquear=False):
    turno = db.execute(text('SELECT * FROM caja_turnos WHERE id_turno=:tid' + (bloqueo_sql(db) if bloquear else '')),
                       {'tid': turno_id}).mappings().first()
    verificar_acceso(turno, usuario)
    return turno


def resumen_turno(db, turno, bloquear=False):
    if bloquear:
        # Las lecturas de autorización pueden haber abierto un snapshot anterior
        # a la espera del bloqueo. Estas lecturas actuales incluyen la última venta.
        ventas = db.execute(text("SELECT metodo_pago,total FROM ventas WHERE id_turno=:tid AND estado='EMITIDA'" + bloqueo_sql(db)), {'tid': turno['id_turno']}).mappings().all()
        grupos_map = {}
        for venta in ventas:
            grupo = grupos_map.setdefault(venta['metodo_pago'], {'metodo_pago': venta['metodo_pago'], 'cantidad': 0, 'total': Decimal(0)})
            grupo['cantidad'] += 1; grupo['total'] += dinero(venta['total'])
        grupos = list(grupos_map.values())
        filas = db.execute(text('SELECT tipo,monto FROM caja_movimientos WHERE id_turno=:tid' + bloqueo_sql(db)), {'tid': turno['id_turno']}).mappings().all()
        manuales_map = {}
        for fila in filas:
            manuales_map[fila['tipo']] = manuales_map.get(fila['tipo'], Decimal(0)) + dinero(fila['monto'])
        manuales = [{'tipo': tipo, 'total': total} for tipo, total in manuales_map.items()]
    else:
        grupos = db.execute(text("""SELECT metodo_pago, COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS total
            FROM ventas WHERE id_turno=:tid AND estado='EMITIDA' GROUP BY metodo_pago"""), {'tid': turno['id_turno']}).mappings().all()
        manuales = db.execute(text("""SELECT tipo, COALESCE(SUM(monto),0) AS total FROM caja_movimientos
            WHERE id_turno=:tid GROUP BY tipo"""), {'tid': turno['id_turno']}).mappings().all()
    por_metodo = {g['metodo_pago']: dinero(g['total']) for g in grupos}
    por_tipo = {g['tipo']: dinero(g['total']) for g in manuales}
    ingresos, retiros = por_tipo.get('INGRESO', Decimal(0)), por_tipo.get('RETIRO', Decimal(0))
    esperado = dinero(turno['fondo_inicial']) + por_metodo.get('EFECTIVO', Decimal(0)) + ingresos - retiros
    if turno['estado'] == 'CERRADO':
        esperado = dinero(turno['efectivo_esperado_cierre'])
    return {**dict(turno), 'efectivo_esperado': esperado, 'ingresos_manuales': ingresos, 'retiros': retiros,
            'ventas_total': sum(por_metodo.values(), Decimal(0)), 'numero_ventas': sum(g['cantidad'] for g in grupos),
            'ventas_por_metodo': [{'metodo': g['metodo_pago'], 'cantidad': g['cantidad'], 'total': dinero(g['total'])} for g in grupos]}


def abrir_caja(db, req, usuario):
    try:
        db.execute(text('SELECT id_usuario FROM usuarios WHERE id_usuario=:uid' + bloqueo_sql(db)), {'uid': usuario['id_usuario']}).first()
        existente = db.execute(text("SELECT id_turno FROM caja_turnos WHERE usuario_abierto=:uid" + bloqueo_sql(db)), {'uid': usuario['id_usuario']}).first()
        if existente:
            raise HTTPException(409, 'Ya tienes una caja abierta. Ciérrala antes de abrir otro turno.')
        almacen = db.execute(text('SELECT id_almacen FROM almacenes WHERE id_almacen=:aid AND estado=1'), {'aid': req.id_almacen}).first()
        if not almacen:
            raise HTTPException(400, 'Selecciona un almacén activo.')
        resultado = db.execute(turnos.insert().values(id_usuario=usuario['id_usuario'], id_almacen=req.id_almacen,
            usuario_abierto=usuario['id_usuario'], estado='ABIERTO', fondo_inicial=req.fondo_inicial,
            fecha_apertura=ahora_local(), observaciones_apertura=req.observaciones))
        tid = resultado.inserted_primary_key[0]
        db.commit()
        return resumen_turno(db, obtener_turno(db, tid, usuario))
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Ya existe un turno abierto para este usuario.')
    except Exception:
        db.rollback()
        raise


def registrar_movimiento(db, tid, req, usuario):
    try:
        turno = obtener_turno(db, tid, usuario, bloquear=True)
        repetido = db.execute(text('SELECT * FROM caja_movimientos WHERE referencia=:ref' + bloqueo_sql(db)),
                              {'ref': str(req.referencia)}).mappings().first()
        if repetido:
            if (repetido['id_turno'] != tid or repetido['id_usuario'] != usuario['id_usuario'] or repetido['tipo'] != req.tipo
                or dinero(repetido['monto']) != req.monto or repetido['motivo'] != req.motivo):
                raise HTTPException(409, 'La referencia de movimiento ya se utilizó con otros datos.')
            db.commit()
            return resumen_turno(db, obtener_turno(db, tid, usuario))
        if turno['estado'] != 'ABIERTO':
            raise HTTPException(409, 'El turno está cerrado y no admite movimientos.')
        esperado = resumen_turno(db, turno, bloquear=True)['efectivo_esperado']
        if req.tipo == 'RETIRO' and req.monto > esperado:
            raise HTTPException(409, 'El retiro supera el efectivo esperado en caja.')
        db.execute(movimientos.insert().values(id_turno=tid, id_usuario=usuario['id_usuario'], tipo=req.tipo,
                   monto=req.monto, motivo=req.motivo, referencia=str(req.referencia), fecha=ahora_local()))
        db.commit()
        return resumen_turno(db, obtener_turno(db, tid, usuario))
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Este movimiento ya fue registrado. Revisa el detalle del turno.')
    except Exception:
        db.rollback()
        raise


def cerrar_caja(db, tid, req, usuario):
    try:
        turno = obtener_turno(db, tid, usuario, bloquear=True)
        if turno['estado'] != 'ABIERTO':
            raise HTTPException(409, 'Este turno ya fue cerrado.')
        esperado = resumen_turno(db, turno, bloquear=True)['efectivo_esperado']
        diferencia = req.efectivo_contado - esperado
        if diferencia != 0 and len(req.observaciones or '') < 3:
            raise HTTPException(400, 'Describe el motivo de la diferencia de caja.')
        db.execute(turnos.update().where(turnos.c.id_turno == tid).values(estado='CERRADO', usuario_abierto=None,
            fecha_cierre=ahora_local(), id_usuario_cierre=usuario['id_usuario'], efectivo_contado=req.efectivo_contado, efectivo_esperado_cierre=esperado,
            diferencia=diferencia, observaciones_cierre=req.observaciones))
        db.commit()
        return resumen_turno(db, obtener_turno(db, tid, usuario))
    except Exception:
        db.rollback()
        raise
