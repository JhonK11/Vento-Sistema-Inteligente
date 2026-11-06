import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import VoucherTicket from '../components/ventas/VoucherTicket';
import type { SaleData } from '../components/ventas/VoucherTicket';
import CartSidebar from '../components/ventas/CartSidebar';
import ProductForm from '../components/ventas/ProductForm';
import HeaderForm from '../components/ventas/HeaderForm';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { api } from '../lib/axios';
import { apiError } from '../lib/apiError';
import { cantidadEnCarrito, totalVenta, validarCantidad, validarCarrito } from '../lib/puntoVenta';
import type { ItemVenta, ProductoVenta } from '../types/ventas';
import type { ResumenCaja } from '../types/caja';
import { Link } from 'react-router-dom';
import { fechaPeru } from '../lib/formato';

interface Cliente { id_cliente: number; nombre_razon_social: string }
interface Almacen { id_almacen: number; nombre: string }
const nuevoNumero = () => `VTA-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;

export default function NuevaVenta() {
  const activeUser = useAuthStore(state => state.user);
  const { addToast, requestConfirm } = useUIStore();
  const queryClient = useQueryClient();
  const [numeroVenta, setNumeroVenta] = useState(nuevoNumero);
  const [idCliente, setIdCliente] = useState('');
  const caja = useQuery<ResumenCaja | null>({ queryKey: ['caja', 'actual'], staleTime: 0,
    queryFn: async () => (await api.get('/caja/actual')).data });
  const idAlmacen = caja.data ? String(caja.data.id_almacen) : '';
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [cart, setCart] = useState<ItemVenta[]>([]);
  const [montoPagado, setMontoPagado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const [saleData, setSaleData] = useState<SaleData | null>(null);
  const clientes = useQuery<Cliente[]>({ queryKey: ['clientes'], queryFn: async () => (await api.get('/clientes')).data });
  const almacenes = useQuery<Almacen[]>({ queryKey: ['almacenes'], queryFn: async () => (await api.get('/almacenes')).data });
  const productos = useQuery<ProductoVenta[]>({
    queryKey: ['productos', 'caja', idAlmacen], enabled: !!idAlmacen, staleTime: 0,
    queryFn: async ({ signal }) => (await api.get('/productos', { params: { almacen_id: Number(idAlmacen) }, signal })).data,
  });
  const lista = productos.data || [];
  const total = totalVenta(cart);
  const bloqueo = caja.isError ? 'No se pudo verificar tu caja. Reintenta la consulta.'
    : caja.isFetching ? 'Verificando el turno de caja…' : !idAlmacen ? 'Abre tu caja antes de registrar ventas.' : productos.isFetching ? 'Actualizando existencias del almacén…'
    : productos.isError ? 'No se pudo verificar el stock. Reintenta la consulta.' : validarCarrito(cart, lista);

  const add = (producto: ProductoVenta, cantidad: number, precio: number) => {
    if (enviando.current || productos.isFetching || !idAlmacen) return;
    if (producto.estado !== 'ACTIVO') { addToast('El producto no está habilitado para venta.', 'warning'); return; }
    if (!Number.isFinite(precio) || precio <= 0) { addToast('El producto debe tener un precio válido mayor que cero.', 'warning'); return; }
    const error = validarCantidad(producto, cantidad) || validarCantidad(producto, cantidadEnCarrito(cart, producto.id_producto) + cantidad);
    if (error) { addToast(error, 'warning'); return; }
    const precioFinal = Math.round(precio * 100) / 100;
    const existente = cart.findIndex(item => item.id_producto === producto.id_producto && item.precio_unitario === precioFinal);
    setCart(anterior => existente >= 0 ? anterior.map((item, indice) => indice === existente ? { ...item, cantidad: Number((item.cantidad + cantidad).toFixed(3)) } : item)
      : [...anterior, { id_producto: producto.id_producto, nombre: producto.nombre, sku: producto.sku,
        cantidad, precio_unitario: precioFinal, imagen_url: producto.imagen_url, es_fraccionable: producto.es_fraccionable }]);
  };

  const updateQuantity = (indice: number, cantidad: number) => {
    if (enviando.current) return;
    const siguiente = cart.map((item, i) => i === indice ? { ...item, cantidad } : item);
    const error = validarCarrito(siguiente, lista);
    if (error) { addToast(error, 'warning'); return; }
    setCart(siguiente);
  };

  const cobrar = async () => {
    if (enviando.current) return;
    if (bloqueo) { addToast(bloqueo, 'warning'); return; }
    if (metodoPago === 'EFECTIVO' && (montoPagado === '' || !Number.isFinite(Number(montoPagado)) || Math.round(Number(montoPagado) * 100) < Math.round(total * 100))) {
      addToast('El efectivo recibido debe cubrir el total.', 'warning'); return;
    }
    enviando.current = true;
    setOcupado(true);
    try {
      const res = await api.post('/ventas', {
        numero_venta: numeroVenta, id_cliente: Number(idCliente) || 1, id_almacen: Number(idAlmacen), metodo_pago: metodoPago,
        id_turno: caja.data?.id_turno, monto_recibido: metodoPago === 'EFECTIVO' ? montoPagado : null,
        detalle: cart.map(item => ({ id_producto: item.id_producto, cantidad: item.cantidad, precio_unitario: item.precio_unitario })),
      });
      if (res.data.status !== 'success') throw new Error(res.data.message || 'No se pudo registrar la venta.');
      setSaleData({ id_venta: res.data.id_venta, numero_venta: numeroVenta,
        fecha: fechaPeru(res.data.fecha), cajero: activeUser?.nombre || 'Cajero',
        cliente: clientes.data?.find(c => c.id_cliente === (Number(idCliente) || 1))?.nombre_razon_social || 'Cliente General',
        metodo_pago: metodoPago, items: [...cart], total: Number(res.data.total), id_turno: res.data.id_turno, estado: 'EMITIDA',
        monto_pagado: res.data.monto_recibido === null ? undefined : Number(res.data.monto_recibido),
        vuelto: res.data.vuelto === null ? undefined : Number(res.data.vuelto),
      });
      void queryClient.invalidateQueries();
      addToast('Venta registrada con éxito.', 'success');
    } catch (error) {
      addToast(apiError(error, 'No se pudo registrar la venta. El carrito se conserva.'), 'error');
      void productos.refetch();
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  };

  const nuevaVenta = () => { setSaleData(null); setCart([]); setMontoPagado(''); setIdCliente(''); setNumeroVenta(nuevoNumero()); };
  const clienteAgregado = (cliente: Cliente) => {
    queryClient.setQueryData<Cliente[]>(['clientes'], anterior => [cliente, ...(anterior || []).filter(c => c.id_cliente !== cliente.id_cliente)]);
    setIdCliente(String(cliente.id_cliente));
    addToast('Cliente asignado a la venta.', 'success');
  };
  if (saleData) return <VoucherTicket saleData={saleData} onNewSale={nuevaVenta} />;

  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
    <div className="space-y-5 xl:col-span-2">
      <div><h2 className="text-2xl font-bold text-slate-800">Punto de venta</h2><p className="mt-1 text-sm text-slate-500">Agrega productos del almacén de tu caja y confirma el pago.</p></div>
      {caja.isError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No se pudo consultar la caja. <button onClick={() => void caja.refetch()} className="font-bold underline">Reintentar</button></div>
        : caja.isLoading ? <p role="status" className="text-sm text-slate-500">Consultando caja…</p>
        : <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-4 text-sm ${caja.data ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}><span>{caja.data ? `Turno #${caja.data.id_turno} abierto · Almacén asignado a tu caja` : 'Necesitas abrir un turno de caja para comenzar a vender.'}</span><Link to="/caja" className="font-bold underline">{caja.data ? 'Ver mi caja' : 'Abrir caja'}</Link><Link to="/ventas/historial" className="font-bold underline">Historial de ventas</Link></div>}
      {(clientes.isError || almacenes.isError) && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No se pudieron cargar clientes o almacenes. <button className="font-bold underline" onClick={() => { void clientes.refetch(); void almacenes.refetch(); }}>Reintentar</button></div>}
      <fieldset disabled={ocupado}>
        <HeaderForm numeroVenta={numeroVenta} metodoPago={metodoPago} setMetodoPago={setMetodoPago}
          idCliente={idCliente} setIdCliente={setIdCliente} idAlmacen={idAlmacen} setIdAlmacen={() => {}} almacenFijo
          clientes={clientes.data || []} almacenes={almacenes.data || []} onClienteAgregado={clienteAgregado} />
      </fieldset>
      <ProductForm productos={lista} carrito={cart} habilitado={!!idAlmacen} cargando={productos.isFetching}
        error={productos.isError} ocupado={ocupado} onRetry={() => void productos.refetch()} onAdd={add} />
    </div>
    <div className="xl:col-span-1"><CartSidebar cart={cart} total={total} metodoPago={metodoPago}
      montoPagado={montoPagado} setMontoPagado={setMontoPagado} ocupado={ocupado} bloqueo={bloqueo}
      onQuantity={updateQuantity} onRemove={indice => { if (!enviando.current) setCart(anterior => anterior.filter((_, i) => i !== indice)); }}
      onClear={() => requestConfirm('Vaciar venta', '¿Quieres retirar todos los productos de esta venta?', () => { if (!enviando.current) { setCart([]); setMontoPagado(''); } })}
      onSubmit={() => void cobrar()} /></div>
  </div>;
}
