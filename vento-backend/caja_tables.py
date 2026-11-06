"""Tablas de caja; se crean exclusivamente mediante la migración."""
from sqlalchemy import (MetaData, Table, Column, BigInteger, Integer, String, Numeric,
                        DateTime, ForeignKey, CheckConstraint)
from sqlalchemy.dialects.mysql import BIGINT

metadata = MetaData()
identificador = BigInteger().with_variant(BIGINT(unsigned=True), 'mysql').with_variant(Integer, 'sqlite')
Table('usuarios', metadata, Column('id_usuario', identificador, primary_key=True))
Table('almacenes', metadata, Column('id_almacen', identificador, primary_key=True))

turnos = Table('caja_turnos', metadata,
    Column('id_turno', identificador, primary_key=True, autoincrement=True),
    Column('id_usuario', identificador, ForeignKey('usuarios.id_usuario'), nullable=False),
    Column('id_almacen', identificador, ForeignKey('almacenes.id_almacen'), nullable=False),
    Column('usuario_abierto', identificador, unique=True, nullable=True),
    Column('estado', String(10), nullable=False),
    Column('fondo_inicial', Numeric(14, 2), nullable=False),
    Column('fecha_apertura', DateTime, nullable=False),
    Column('fecha_cierre', DateTime),
    Column('id_usuario_cierre', identificador, ForeignKey('usuarios.id_usuario')),
    Column('efectivo_contado', Numeric(14, 2)),
    Column('efectivo_esperado_cierre', Numeric(14, 2)),
    Column('diferencia', Numeric(14, 2)),
    Column('observaciones_apertura', String(500)),
    Column('observaciones_cierre', String(500)),
    CheckConstraint("estado IN ('ABIERTO','CERRADO')", name='chk_caja_estado'),
    CheckConstraint('fondo_inicial >= 0', name='chk_caja_fondo'),
    CheckConstraint("(estado='ABIERTO' AND usuario_abierto=id_usuario AND fecha_cierre IS NULL) OR (estado='CERRADO' AND usuario_abierto IS NULL AND fecha_cierre IS NOT NULL)", name='chk_caja_abierta'),
    mysql_engine='InnoDB', mysql_charset='utf8mb4',
)

movimientos = Table('caja_movimientos', metadata,
    Column('id_movimiento', identificador, primary_key=True, autoincrement=True),
    Column('id_turno', identificador, ForeignKey('caja_turnos.id_turno'), nullable=False, index=True),
    Column('id_usuario', identificador, ForeignKey('usuarios.id_usuario'), nullable=False),
    Column('tipo', String(10), nullable=False),
    Column('monto', Numeric(14, 2), nullable=False),
    Column('motivo', String(250), nullable=False),
    Column('referencia', String(36), unique=True),
    Column('fecha', DateTime, nullable=False),
    CheckConstraint("tipo IN ('INGRESO','RETIRO')", name='chk_caja_mov_tipo'),
    CheckConstraint('monto > 0', name='chk_caja_mov_monto'),
    mysql_engine='InnoDB', mysql_charset='utf8mb4',
)
