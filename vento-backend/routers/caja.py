from typing import Literal
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import get_db
from routers.auth import get_current_user, require_role
from schemas.caja import AperturaCaja, MovimientoCaja, CierreCaja
from services.caja import abrir_caja, cerrar_caja, registrar_movimiento, obtener_turno, resumen_turno

router = APIRouter(prefix='/api/caja', tags=['Caja'], dependencies=[Depends(require_role(['ADMINISTRADOR','VENTAS','GERENCIA']))])
escribir = [Depends(require_role(['ADMINISTRADOR','VENTAS']))]


@router.get('/actual')
def caja_actual(current=Depends(get_current_user), db: Session = Depends(get_db)):
    turno = db.execute(text('SELECT * FROM caja_turnos WHERE usuario_abierto=:uid'), {'uid': current['user']['id_usuario']}).mappings().first()
    return resumen_turno(db, turno) if turno else None


@router.get('/cajeros')
def listar_cajeros(current=Depends(get_current_user), db: Session = Depends(get_db)):
    sql = 'SELECT id_usuario, nombre_completo FROM usuarios WHERE estado=1'
    params = {}
    if current['user']['rol_nombre'] == 'VENTAS':
        sql += ' AND id_usuario=:uid'
        params['uid'] = current['user']['id_usuario']
    return db.execute(text(sql + ' ORDER BY nombre_completo'), params).mappings().all()


@router.get('/turnos')
def listar_turnos(estado: Literal['ABIERTO','CERRADO'] | None = None, cajero_id: int | None = Query(None, gt=0),
                  pagina: int = Query(1, ge=1), tamanio: int = Query(20, ge=1, le=100),
                  current=Depends(get_current_user), db: Session = Depends(get_db)):
    where, params = ['1=1'], {}
    uid = current['user']['id_usuario'] if current['user']['rol_nombre'] == 'VENTAS' else cajero_id
    if uid:
        where.append('t.id_usuario=:uid'); params['uid'] = uid
    if estado:
        where.append('t.estado=:estado'); params['estado'] = estado
    condicion = ' AND '.join(where)
    total = db.execute(text('SELECT COUNT(*) FROM caja_turnos t WHERE ' + condicion), params).scalar()
    filas = db.execute(text('''SELECT t.*,u.nombre_completo AS cajero,a.nombre AS almacen FROM caja_turnos t
        JOIN usuarios u ON u.id_usuario=t.id_usuario JOIN almacenes a ON a.id_almacen=t.id_almacen
        WHERE ''' + condicion + ' ORDER BY t.id_turno DESC LIMIT :limite OFFSET :offset'),
        {**params, 'limite': tamanio, 'offset': (pagina-1)*tamanio}).mappings().all()
    return {'items': filas, 'total': total, 'pagina': pagina, 'tamanio': tamanio}


@router.post('/abrir', dependencies=escribir)
def abrir(req: AperturaCaja, current=Depends(get_current_user), db: Session = Depends(get_db)):
    return abrir_caja(db, req, current['user'])


@router.get('/turnos/{tid}')
def detalle_turno(tid: int, current=Depends(get_current_user), db: Session = Depends(get_db)):
    resumen = resumen_turno(db, obtener_turno(db, tid, current['user']))
    nombres = db.execute(text('''SELECT u.nombre_completo AS cajero,a.nombre AS almacen,
        uc.nombre_completo AS cerrado_por FROM caja_turnos t JOIN usuarios u ON u.id_usuario=t.id_usuario
        JOIN almacenes a ON a.id_almacen=t.id_almacen LEFT JOIN usuarios uc ON uc.id_usuario=t.id_usuario_cierre
        WHERE t.id_turno=:tid'''), {'tid': tid}).mappings().one()
    filas = db.execute(text('''SELECT m.*,u.nombre_completo AS responsable FROM caja_movimientos m
        JOIN usuarios u ON u.id_usuario=m.id_usuario WHERE m.id_turno=:tid ORDER BY m.id_movimiento'''), {'tid': tid}).mappings().all()
    return {**resumen, **dict(nombres), 'movimientos': filas}


@router.post('/turnos/{tid}/movimientos', dependencies=escribir)
def movimiento(tid: int, req: MovimientoCaja, current=Depends(get_current_user), db: Session = Depends(get_db)):
    return registrar_movimiento(db, tid, req, current['user'])


@router.post('/turnos/{tid}/cerrar', dependencies=escribir)
def cierre(tid: int, req: CierreCaja, current=Depends(get_current_user), db: Session = Depends(get_db)):
    return cerrar_caja(db, tid, req, current['user'])
