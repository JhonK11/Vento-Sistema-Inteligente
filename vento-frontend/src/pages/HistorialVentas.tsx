import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileSearch, Search, X } from 'lucide-react';
import { api } from '../lib/axios';
import { fechaPeru, soles } from '../lib/formato';
import { useAuthStore } from '../store/authStore';
import VoucherTicket from '../components/ventas/VoucherTicket';
import type { HistorialVentas as Resultado, VentaDetalle } from '../types/caja';

const inicial = { buscar: '', fecha_desde: '', fecha_hasta: '', metodo: '', estado: '', cajero_id: '' };

export default function HistorialVentas() {
  const [params, setParams] = useSearchParams();
  const turno = params.get('turno') || '';
  const [form, setForm] = useState(inicial);
  const [filtros, setFiltros] = useState(inicial);
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const supervisor = useAuthStore(state => state.user?.rol_nombre !== 'VENTAS');
  const ventas = useQuery<Resultado>({ queryKey: ['historial-ventas', filtros, turno, pagina],
    queryFn: async ({ signal }) => (await api.get('/ventas', { signal, params: {
      ...Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== '')), turno_id: turno || undefined, pagina,
    } })).data });
  const cajeros = useQuery<{ id_usuario: number; nombre_completo: string }[]>({ queryKey: ['caja', 'cajeros'],
    queryFn: async () => (await api.get('/caja/cajeros')).data, enabled: supervisor });
  const detalle = useQuery<VentaDetalle>({ queryKey: ['venta-detalle', seleccion], enabled: !!seleccion,
    queryFn: async () => (await api.get(`/ventas/${seleccion}`)).data });
  const limpiar = () => { setForm(inicial); setFiltros(inicial); setPagina(1); setParams({}); };

  if (seleccion) {
    if (detalle.isError) return <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700"><p>No se pudo cargar el comprobante.</p><button onClick={() => void detalle.refetch()} className="mr-4 font-bold underline">Reintentar</button><button onClick={() => setSeleccion(null)} className="font-bold underline">Volver al historial</button></div>;
    if (!detalle.data) return <p role="status" className="p-8 text-center text-slate-500">Cargando detalle de venta…</p>;
    const venta = detalle.data;
    return <div>{!venta.id_turno && <p className="rounded-xl bg-slate-100 p-3 text-center text-xs text-slate-600">Venta anterior al control de caja; no pertenece a un turno.</p>}
      <VoucherTicket saleData={{ id_venta: venta.id_venta, numero_venta: venta.numero_venta, fecha: fechaPeru(venta.fecha),
        cajero: venta.cajero || '—', cliente: venta.cliente || 'Cliente General', metodo_pago: venta.metodo_pago,
        total: Number(venta.total), items: venta.items.map(i => ({ nombre: i.nombre, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario) })),
        monto_pagado: venta.monto_recibido === null ? undefined : Number(venta.monto_recibido),
        vuelto: venta.vuelto === null ? undefined : Number(venta.vuelto), id_turno: venta.id_turno, estado: venta.estado,
      }} onNewSale={() => setSeleccion(null)} actionLabel="Volver al historial" />
    </div>;
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800"><FileSearch className="text-blue-600" /> Historial de ventas</h1><p className="mt-1 text-sm text-slate-500">Consulta operaciones, revisa el detalle y vuelve a imprimir sus tickets.{!supervisor && ' Solo se muestran tus ventas.'}</p></div>
    {turno && <div className="flex items-center justify-between rounded-xl bg-blue-50 p-3 text-sm text-blue-800"><span>Ventas del turno #{turno}</span><button onClick={() => { setParams({}); setPagina(1); }} className="inline-flex items-center gap-1 font-bold"><X size={15} /> Quitar filtro de turno</button></div>}
    <form onSubmit={e => { e.preventDefault(); setFiltros({ ...form }); setPagina(1); }} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold text-slate-500">Comprobante, cliente o documento<input value={form.buscar} maxLength={100} onChange={e => setForm({ ...form, buscar: e.target.value })} placeholder="Buscar venta…" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-800" /></label>
        <label className="text-xs font-semibold text-slate-500">Desde<input type="date" value={form.fecha_desde} onChange={e => setForm({ ...form, fecha_desde: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-800" /></label>
        <label className="text-xs font-semibold text-slate-500">Hasta<input type="date" value={form.fecha_hasta} min={form.fecha_desde || undefined} onChange={e => setForm({ ...form, fecha_hasta: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-800" /></label>
        <label className="text-xs font-semibold text-slate-500">Método de pago<select value={form.metodo} onChange={e => setForm({ ...form, metodo: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-800"><option value="">Todos</option>{['EFECTIVO','TARJETA','TRANSFERENCIA','CREDITO','OTRO'].map(m => <option key={m}>{m}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-500">Estado<select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-800"><option value="">Todos</option><option value="EMITIDA">Emitidas</option><option value="ANULADA">Anuladas</option></select></label>
        {supervisor && <label className="text-xs font-semibold text-slate-500">Cajero<select value={form.cajero_id} onChange={e => setForm({ ...form, cajero_id: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-800"><option value="">Todos</option>{cajeros.data?.map(c => <option key={c.id_usuario} value={c.id_usuario}>{c.nombre_completo}</option>)}</select></label>}
      </div>
      <div className="flex gap-2"><button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"><Search size={16} /> Aplicar filtros</button><button type="button" onClick={limpiar} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Limpiar</button></div>
    </form>
    {ventas.isError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el historial. Comprueba las fechas y la conexión. <button onClick={() => void ventas.refetch()} className="font-bold underline">Reintentar</button></div> : ventas.isLoading ? <p role="status" className="p-6 text-center text-slate-500">Cargando ventas…</p> : <>
      <div className="grid gap-3 sm:grid-cols-3">{[['Operaciones encontradas', String(ventas.data?.total || 0)], ['Importe de ventas emitidas', soles(ventas.data?.resumen.ventas_emitidas)], ['Ventas en efectivo', soles(ventas.data?.resumen.efectivo)]].map(([titulo, valor]) => <div key={titulo} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{titulo}</p><p className="mt-2 text-2xl font-black text-slate-800">{valor}</p></div>)}</div>
      {!!ventas.data?.resumen.sin_turno && <p className="text-xs text-slate-500">Incluye {ventas.data.resumen.sin_turno} ventas históricas sin turno. Sus importes no se asignan a las cajas nuevas.</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Comprobante / fecha','Cliente','Cajero / almacén','Método','Total','Estado',''].map((t,i) => <th key={i} className="px-4 py-3">{t}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{ventas.data?.items.map(v => <tr key={v.id_venta} className="text-slate-600"><td className="px-4 py-3"><div className="font-mono text-xs font-bold text-slate-800">{v.numero_venta}</div><div className="mt-1 text-xs text-slate-400">{fechaPeru(v.fecha)} · {v.id_turno ? `Turno #${v.id_turno}` : 'Sin turno'}</div></td><td className="px-4 py-3">{v.cliente || '—'}</td><td className="px-4 py-3"><div>{v.cajero}</div><div className="text-xs text-slate-400">{v.almacen}</div></td><td className="px-4 py-3 text-xs">{v.metodo_pago}</td><td className="px-4 py-3 font-bold text-slate-800">{soles(v.total)}{supervisor && !v.costo_verificado && <div className="mt-1 text-[10px] font-normal text-amber-700">Costo pendiente de verificar</div>}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${v.estado === 'EMITIDA' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{v.estado}</span></td><td className="px-4 py-3"><button onClick={() => setSeleccion(v.id_venta)} className="whitespace-nowrap font-bold text-blue-600">Detalle / ticket</button></td></tr>)}{!ventas.data?.items.length && <tr><td colSpan={7} className="p-10 text-center text-slate-400">No hay ventas con estos filtros.</td></tr>}</tbody></table></div>
        <div className="flex items-center justify-between p-4 text-xs text-slate-500"><span>Página {pagina} · {ventas.data?.total || 0} operaciones</span><div className="flex gap-2"><button disabled={pagina === 1} onClick={() => setPagina(p => p-1)} className="rounded border px-3 py-1.5 disabled:opacity-30">Anterior</button><button disabled={pagina*20 >= (ventas.data?.total || 0)} onClick={() => setPagina(p => p+1)} className="rounded border px-3 py-1.5 disabled:opacity-30">Siguiente</button></div></div>
      </div>
    </>}
  </div>;
}
