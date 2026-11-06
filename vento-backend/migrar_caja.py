"""Migración aditiva: turnos, movimientos y trazabilidad de ventas nuevas."""
from sqlalchemy import inspect, text
from database import engine
from caja_tables import metadata, turnos, movimientos


def migrar():
    with engine.begin() as conn:
        metadata.create_all(conn, tables=[turnos, movimientos])
        columnas_mov = {c['name'] for c in inspect(conn).get_columns('caja_movimientos')}
        if 'referencia' not in columnas_mov:
            conn.execute(text('ALTER TABLE caja_movimientos ADD COLUMN referencia VARCHAR(36) NULL'))
        indices_mov = inspect(conn).get_indexes('caja_movimientos') + inspect(conn).get_unique_constraints('caja_movimientos')
        if not any(i['column_names'] == ['referencia'] for i in indices_mov):
            conn.execute(text('CREATE UNIQUE INDEX uq_caja_mov_referencia ON caja_movimientos (referencia)'))
        mysql = conn.dialect.name == 'mysql'
        tipo_id = 'BIGINT UNSIGNED' if mysql else 'INTEGER'
        columnas_turno = {c['name'] for c in inspect(conn).get_columns('caja_turnos')}
        if 'id_usuario_cierre' not in columnas_turno:
            conn.execute(text(f'ALTER TABLE caja_turnos ADD COLUMN id_usuario_cierre {tipo_id} NULL'))
        if mysql and not any(f['constrained_columns'] == ['id_usuario_cierre'] for f in inspect(conn).get_foreign_keys('caja_turnos')):
            conn.execute(text('ALTER TABLE caja_turnos ADD CONSTRAINT fk_turno_usuario_cierre FOREIGN KEY (id_usuario_cierre) REFERENCES usuarios(id_usuario)'))
        columnas = {c['name'] for c in inspect(conn).get_columns('ventas')}
        nuevas = {'id_turno': tipo_id, 'monto_recibido': 'DECIMAL(14,2)', 'vuelto': 'DECIMAL(14,2)',
                  'solicitud_hash': 'VARCHAR(64)', 'costo_verificado': 'BOOLEAN'}
        for nombre, tipo in nuevas.items():
            if nombre not in columnas:
                conn.execute(text(f'ALTER TABLE ventas ADD COLUMN {nombre} {tipo} NULL'))
        detalle_columnas = {c['name'] for c in inspect(conn).get_columns('ventas_detalle')}
        for nombre, tipo in {'producto_nombre': 'VARCHAR(150)', 'producto_sku': 'VARCHAR(50)'}.items():
            if nombre not in detalle_columnas:
                conn.execute(text(f'ALTER TABLE ventas_detalle ADD COLUMN {nombre} {tipo} NULL'))
        indices = {i['name'] for i in inspect(conn).get_indexes('ventas')}
        if 'ix_ventas_turno' not in indices:
            conn.execute(text('CREATE INDEX ix_ventas_turno ON ventas (id_turno)'))
        if mysql:
            claves = {f['name'] for f in inspect(conn).get_foreign_keys('ventas')}
            if 'fk_ventas_turno' not in claves:
                conn.execute(text('ALTER TABLE ventas ADD CONSTRAINT fk_ventas_turno FOREIGN KEY (id_turno) REFERENCES caja_turnos(id_turno)'))
    print('Caja instalada. Ventas históricas conservadas sin asignación de turno.')


if __name__ == '__main__':
    migrar()
