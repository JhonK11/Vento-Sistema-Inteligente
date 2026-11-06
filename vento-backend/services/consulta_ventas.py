from fastapi import HTTPException
from sqlalchemy import text


def acceso_ventas(usuario):
    if usuario['rol_nombre'] == 'VENTAS':
        return 'v.id_usuario=:visor', {'visor': usuario['id_usuario']}
    return '1=1', {}


VENTA_SELECT = '''SELECT v.*, c.nombre_razon_social AS cliente, c.tipo_documento AS cliente_tipo_doc,
    c.numero_documento AS cliente_doc, u.nombre_completo AS cajero, a.nombre AS almacen
    FROM ventas v LEFT JOIN clientes c ON c.id_cliente=v.id_cliente
    LEFT JOIN usuarios u ON u.id_usuario=v.id_usuario LEFT JOIN almacenes a ON a.id_almacen=v.id_almacen'''


def consultar_venta(db, vid, usuario):
    acceso, params = acceso_ventas(usuario)
    venta = db.execute(text(VENTA_SELECT + ' WHERE v.id_venta=:vid AND ' + acceso), {**params, 'vid': vid}).mappings().first()
    if not venta:
        raise HTTPException(404, 'Venta no encontrada.')
    detalle = db.execute(text('''SELECT vd.id_producto, vd.cantidad, vd.precio_unitario,
        COALESCE(vd.producto_nombre,p.nombre) AS nombre, COALESCE(vd.producto_sku,p.sku) AS sku,
        vd.cantidad*vd.precio_unitario AS subtotal
        FROM ventas_detalle vd JOIN productos p ON p.id_producto=vd.id_producto
        WHERE vd.id_venta=:vid ORDER BY vd.id_producto,vd.precio_unitario'''), {'vid': vid}).mappings().all()
    return {**dict(venta), 'items': detalle}
