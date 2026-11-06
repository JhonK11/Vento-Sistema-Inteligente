import test from 'node:test';
import assert from 'node:assert/strict';
import { totalVenta, validarCantidad, validarCarrito, vueltoEfectivo } from '../src/lib/puntoVenta.ts';

const producto = { id_producto: 1, nombre: 'Arroz', sku: 'A1', codigo_barras: '775001', precio_venta: 10,
  imagen_url: null, categoria: 'Abarrotes', estado: 'ACTIVO', stock_disponible: 3, es_fraccionable: false };
const item = { id_producto: 1, nombre: 'Arroz', sku: 'A1', cantidad: 1, precio_unitario: 10, imagen_url: null, es_fraccionable: false };

test('El total usa céntimos para evitar sumas como 0.30000000004', () => {
  assert.equal(totalVenta([{ ...item, precio_unitario: 0.1 }, { ...item, precio_unitario: 0.2 }]), 0.3);
});
test('Un producto por unidades rechaza cantidades fraccionarias', () => {
  assert.match(validarCantidad(producto, 0.5), /unidades completas/);
});
test('El subtotal fraccionario se redondea después de sumar, igual que MySQL', () => {
  assert.equal(totalVenta([{ ...item, cantidad: 0.333, precio_unitario: 1 }, { ...item, cantidad: 0.333, precio_unitario: 1 }]), 0.67);
});
test('Un producto fraccionable admite hasta tres decimales', () => {
  assert.equal(validarCantidad({ ...producto, es_fraccionable: true }, 0.125), null);
  assert.match(validarCantidad({ ...producto, es_fraccionable: true }, 0.1234), /tres decimales/);
});
test('No permite superar el stock con el mismo producto a distintos precios', () => {
  assert.match(validarCarrito([{ ...item, cantidad: 2 }, { ...item, cantidad: 2, precio_unitario: 9 }], [producto]), /Stock insuficiente/);
});
test('Cambiar a un almacén sin stock bloquea el carrito existente', () => {
  assert.match(validarCarrito([item], [{ ...producto, stock_disponible: 0 }]), /Stock insuficiente/);
});
test('No permite cobrar productos inactivos ni precios no finitos', () => {
  assert.match(validarCarrito([item], [{ ...producto, estado: 'SUSPENDIDO' }]), /no está disponible/);
  assert.match(validarCarrito([{ ...item, precio_unitario: Infinity }], [producto]), /precio/);
});
test('El vuelto se calcula en céntimos y nunca es negativo', () => {
  assert.equal(vueltoEfectivo(19.9, 20), 0.1);
  assert.equal(vueltoEfectivo(30, 20), 0);
});
