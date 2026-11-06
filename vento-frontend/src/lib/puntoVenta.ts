import type { ItemVenta, ProductoVenta } from '../types/ventas';

export function totalVenta(carrito: ItemVenta[]): number {
  // MySQL redondea el subtotal después de sumar cantidades (hasta 3 decimales).
  const milesimasDeCentimo = carrito.reduce((suma, item) =>
    suma + Math.round(item.cantidad * 1000) * Math.round(item.precio_unitario * 100), 0);
  return Math.round(milesimasDeCentimo / 1000) / 100;
}

export function cantidadEnCarrito(carrito: ItemVenta[], productoId: number): number {
  return carrito.filter(item => item.id_producto === productoId).reduce((suma, item) => suma + item.cantidad, 0);
}

export function validarCantidad(producto: ProductoVenta, cantidad: number): string | null {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 'Ingresa una cantidad mayor que cero.';
  if (!producto.es_fraccionable && !Number.isInteger(cantidad)) return 'Este producto se vende por unidades completas.';
  if (Math.abs(cantidad * 1000 - Math.round(cantidad * 1000)) > 0.00001) return 'Usa como máximo tres decimales en la cantidad.';
  if (cantidad > Number(producto.stock_disponible) + 0.000001) return `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock_disponible}.`;
  return null;
}

export function validarCarrito(carrito: ItemVenta[], productos: ProductoVenta[]): string | null {
  if (!carrito.length) return 'Agrega al menos un producto.';
  for (const item of carrito) {
    const producto = productos.find(p => p.id_producto === item.id_producto);
    if (!producto || producto.estado !== 'ACTIVO') return `${item.nombre} ya no está disponible para venta.`;
    if (!Number.isFinite(item.precio_unitario) || item.precio_unitario <= 0) return `Revisa el precio de ${item.nombre}.`;
    const error = validarCantidad(producto, item.cantidad);
    if (error) return error;
    const errorStock = validarCantidad(producto, cantidadEnCarrito(carrito, item.id_producto));
    if (errorStock) return errorStock;
  }
  return null;
}

export function vueltoEfectivo(total: number, recibido: number): number {
  return Math.max(0, Math.round(recibido * 100) - Math.round(total * 100)) / 100;
}
