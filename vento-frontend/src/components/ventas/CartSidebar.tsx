import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import type { ItemVenta } from '../../types/ventas';
import { vueltoEfectivo } from '../../lib/puntoVenta';
import ProductImage from '../ui/ProductImage';

interface Props {
  cart: ItemVenta[];
  total: number;
  metodoPago: string;
  montoPagado: string;
  setMontoPagado: (valor: string) => void;
  ocupado: boolean;
  bloqueo: string | null;
  onQuantity: (indice: number, cantidad: number) => void;
  onRemove: (indice: number) => void;
  onClear: () => void;
  onSubmit: () => void;
}

function QuantityInput({ item, disabled, onCommit }: { item: ItemVenta; disabled: boolean; onCommit: (valor: number) => void }) {
  const [borrador, setBorrador] = useState(String(item.cantidad));
  return <input aria-label={`Cantidad de ${item.nombre}`} type="number" min={item.es_fraccionable ? 0.001 : 1}
    step={item.es_fraccionable ? 0.001 : 1} disabled={disabled} value={borrador}
    onChange={event => setBorrador(event.target.value)}
    onBlur={() => { onCommit(Number(borrador)); setBorrador(String(item.cantidad)); }}
    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
    className="w-16 border-x border-slate-100 py-1 text-center text-xs font-bold text-slate-800 outline-none" />;
}

export default function CartSidebar({ cart, total, metodoPago, montoPagado, setMontoPagado, ocupado, bloqueo, onQuantity, onRemove, onClear, onSubmit }: Props) {
  const efectivo = metodoPago === 'EFECTIVO';
  const recibido = Number(montoPagado);
  const faltaPago = efectivo && (montoPagado === '' || !Number.isFinite(recibido) || Math.round(recibido * 100) < Math.round(total * 100));
  const deshabilitado = ocupado || !!bloqueo || faltaPago;

  useEffect(() => {
    const cobrar = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        if (!deshabilitado && !event.repeat) onSubmit();
      }
    };
    window.addEventListener('keydown', cobrar);
    return () => window.removeEventListener('keydown', cobrar);
  }, [deshabilitado, onSubmit]);

  return (
    <form onSubmit={e => { e.preventDefault(); if (!deshabilitado) onSubmit(); }}
      className="sticky top-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-bold text-slate-800">Venta actual <span className="ml-1 text-xs font-normal text-slate-400">{cart.length} líneas</span></h3>
        <button type="button" disabled={!cart.length || ocupado} onClick={onClear} className="text-xs font-semibold text-red-600 disabled:opacity-40">Vaciar</button>
      </div>
      <div className="max-h-[370px] min-h-28 space-y-3 overflow-y-auto pr-1">
        {!cart.length && <p className="py-8 text-center text-sm text-slate-400">Busca, escanea o pulsa un producto para empezar.</p>}
        {cart.map((item, indice) => <div key={`${item.id_producto}-${item.precio_unitario}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-start gap-2">
            <ProductImage src={item.imagen_url} alt={item.nombre} className="h-11 w-11 shrink-0 rounded-lg bg-white" />
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800" title={item.nombre}>{item.nombre}</p><p className="mt-1 text-[10px] text-slate-400">{item.sku} · S/ {item.precio_unitario.toFixed(2)}</p></div>
            <button type="button" disabled={ocupado} onClick={() => onRemove(indice)} aria-label={`Quitar ${item.nombre}`} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white">
              <button type="button" disabled={ocupado || item.cantidad <= (item.es_fraccionable ? 0.001 : 1)} aria-label={`Reducir cantidad de ${item.nombre}`} onClick={() => onQuantity(indice, Math.max(item.es_fraccionable ? 0.001 : 1, Number((item.cantidad - 1).toFixed(3))))} className="p-2 text-slate-500 disabled:opacity-30"><Minus size={13} /></button>
              <QuantityInput key={item.cantidad} item={item} disabled={ocupado} onCommit={valor => onQuantity(indice, valor)} />
              <button type="button" disabled={ocupado} aria-label={`Aumentar cantidad de ${item.nombre}`} onClick={() => onQuantity(indice, Number((item.cantidad + 1).toFixed(3)))} className="p-2 text-slate-500"><Plus size={13} /></button>
            </div>
            <strong className="text-sm text-slate-800">S/ {(Math.round(item.cantidad * item.precio_unitario * 100) / 100).toFixed(2)}</strong>
          </div>
        </div>)}
      </div>
      <div className="flex items-end justify-between border-t border-slate-100 pt-4"><span className="font-medium text-slate-500">Total a pagar</span><strong className="text-3xl font-black text-blue-700">S/ {total.toFixed(2)}</strong></div>
      {efectivo ? <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <label className="block text-xs font-bold text-slate-600"><span className="mb-2 flex items-center gap-1"><Banknote size={15} /> Efectivo recibido (S/)</span>
          <input type="number" min="0" step="0.01" disabled={ocupado} value={montoPagado} onChange={e => setMontoPagado(e.target.value)} placeholder="0.00"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={ocupado || !cart.length} onClick={() => setMontoPagado(total.toFixed(2))} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">Monto exacto</button>
          {[10, 20, 50, 100].filter(monto => monto > total).slice(0, 3).map(monto => <button key={monto} type="button" disabled={ocupado} onClick={() => setMontoPagado(String(monto))} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">S/ {monto}</button>)}
        </div>
        <div aria-live="polite" className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm"><span className="text-slate-500">Vuelto</span><strong className="text-xl text-emerald-700">S/ {vueltoEfectivo(total, Number.isFinite(recibido) ? recibido : 0).toFixed(2)}</strong></div>
        {cart.length > 0 && faltaPago && <p className="text-xs text-amber-700">Ingresa un monto suficiente para completar el cobro.</p>}
      </div> : <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Método seleccionado: {metodoPago}. Confirma el pago antes de registrar la venta.</p>}
      {bloqueo && cart.length > 0 && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{bloqueo}</p>}
      <button type="submit" disabled={deshabilitado} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-base font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
        {ocupado ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
        {ocupado ? 'Registrando venta…' : 'Cobrar · F2'}
      </button>
    </form>
  );
}
