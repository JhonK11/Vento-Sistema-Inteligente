import { useEffect, useRef, useState } from 'react';
import { Barcode, Plus, RefreshCw, Search } from 'lucide-react';
import type { ItemVenta, ProductoVenta } from '../../types/ventas';
import { cantidadEnCarrito } from '../../lib/puntoVenta';
import ProductImage from '../ui/ProductImage';
import { useUIStore } from '../../store/uiStore';

interface Props {
  productos: ProductoVenta[];
  carrito: ItemVenta[];
  habilitado: boolean;
  cargando: boolean;
  error: boolean;
  ocupado: boolean;
  onRetry: () => void;
  onAdd: (producto: ProductoVenta, cantidad: number, precio: number) => void;
}

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ProductForm({ productos, carrito, habilitado, cargando, error, ocupado, onRetry, onAdd }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [seleccion, setSeleccion] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [precioEditado, setPrecioEditado] = useState<number | null>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const addToast = useUIStore(state => state.addToast);
  const categorias = [...new Set(productos.map(p => p.categoria || 'Sin categoría'))].sort();
  const producto = productos.find(p => String(p.id_producto) === seleccion);
  const precio = precioEditado ?? Number(producto?.precio_venta || 0);
  const disponible = (p: ProductoVenta) => Math.max(0, Number(p.stock_disponible) - cantidadEnCarrito(carrito, p.id_producto));
  const texto = normalizar(busqueda.trim());
  const encontrados = productos.filter(p =>
    (categoria === 'Todas' || (p.categoria || 'Sin categoría') === categoria) &&
    normalizar(`${p.nombre} ${p.sku} ${p.codigo_barras || ''}`).includes(texto));

  useEffect(() => {
    const enfocar = (event: KeyboardEvent) => {
      if (event.key === 'F4') { event.preventDefault(); buscador.current?.focus(); buscador.current?.select(); }
    };
    window.addEventListener('keydown', enfocar);
    return () => window.removeEventListener('keydown', enfocar);
  }, []);

  const escanear = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !busqueda.trim() || ocupado || !habilitado || cargando) return;
    event.preventDefault();
    const exacto = productos.find(p => p.sku.toLowerCase() === busqueda.trim().toLowerCase() || p.codigo_barras === busqueda.trim());
    const elegido = exacto || (encontrados.length === 1 ? encontrados[0] : undefined);
    if (elegido) { onAdd(elegido, 1, Number(elegido.precio_venta)); setBusqueda(''); }
    else addToast(encontrados.length > 1 ? 'Hay varios resultados. Selecciona el producto de la lista.' : 'No se encontró un producto con ese nombre o código.', 'warning');
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800">Productos para la venta</h3>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">F4 Buscar · Enter Agregar</span>
      </div>
      <div className="relative">
        <Search size={19} className="absolute left-3 top-3 text-slate-400" />
        <input ref={buscador} value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyDown={escanear}
          disabled={ocupado} aria-label="Buscar producto o escanear código de barras"
          placeholder="Nombre, SKU o código de barras…"
          className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
        <Barcode size={20} className="absolute right-3 top-3 text-slate-400" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['Todas', ...categorias].map(cat => <button type="button" key={cat} disabled={ocupado} onClick={() => setCategoria(cat)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${categoria === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{cat}</button>)}
      </div>
      {!habilitado ? <p className="rounded-xl bg-blue-50 p-6 text-center text-sm text-blue-800">Selecciona un almacén para ver sus productos y existencias.</p>
        : error ? <div role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">No se pudieron cargar los productos. <button type="button" onClick={onRetry} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RefreshCw size={14} /> Reintentar</button></div>
        : cargando ? <p role="status" className="animate-pulse py-12 text-center text-sm text-slate-500">Consultando stock del almacén…</p>
        : <>
          <div className="grid max-h-[430px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {encontrados.slice(0, 60).map(p => {
              const saldo = disponible(p);
              const bloqueado = ocupado || saldo <= 0 || Number(p.precio_venta) <= 0 || p.estado !== 'ACTIVO';
              return <button key={p.id_producto} type="button" disabled={bloqueado}
                onClick={() => onAdd(p, 1, Number(p.precio_venta))}
                aria-label={`Agregar ${p.nombre}`} title={`${p.nombre} · ${p.sku}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                <ProductImage src={p.imagen_url} alt={p.nombre} className="h-24 w-full bg-slate-50 p-2" />
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <span className="text-[10px] font-mono text-slate-400">{p.sku}</span>
                  <span className="line-clamp-2 flex-1 text-xs font-bold text-slate-800">{p.nombre}</span>
                  <strong className="mt-1 text-sm text-blue-700">S/ {Number(p.precio_venta).toFixed(2)}</strong>
                  <span className={`text-[10px] font-semibold ${saldo > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{p.estado !== 'ACTIVO' ? 'Venta suspendida' : saldo <= 0 ? 'Sin stock disponible' : Number(p.precio_venta) <= 0 ? 'Precio pendiente' : `Disponible: ${Number(saldo.toFixed(3))}`}</span>
                </div>
              </button>;
            })}
          </div>
          {!encontrados.length && <p className="py-8 text-center text-sm text-slate-500">No hay productos que coincidan con la búsqueda.</p>}
          {encontrados.length > 60 && <p className="text-xs text-slate-500">Mostrando 60 de {encontrados.length} productos. Afina la búsqueda para encontrar otros.</p>}
        </>}

      <fieldset disabled={ocupado || !habilitado || cargando || error} className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
        <label className="col-span-2 text-xs font-semibold text-slate-500 sm:col-span-4">Agregar una cantidad o precio específico</label>
        <label className="col-span-2 text-xs text-slate-500">Producto
          <select value={seleccion} onChange={e => { setSeleccion(e.target.value); setPrecioEditado(null); setCantidad(1); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800">
            <option value="">Selecciona un producto</option>
            {encontrados.map(p => <option key={p.id_producto} value={p.id_producto}>{p.nombre} ({p.sku})</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Cantidad
          <input type="number" min={producto?.es_fraccionable ? 0.001 : 1} step={producto?.es_fraccionable ? 0.001 : 1} value={cantidad}
            onChange={e => setCantidad(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm text-slate-800" />
        </label>
        <label className="text-xs text-slate-500">Precio S/
          <input type="number" min="0.01" step="0.01" value={precio} onChange={e => setPrecioEditado(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm text-slate-800" />
        </label>
        <button type="button" disabled={!producto} onClick={() => { if (producto) onAdd(producto, cantidad, precio); }}
          className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-blue-50 p-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 sm:col-span-4"><Plus size={18} /> Añadir al carrito</button>
      </fieldset>
    </section>
  );
}
