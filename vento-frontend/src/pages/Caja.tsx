import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, ClipboardCheck, LockKeyhole, Plus, RefreshCw, ShoppingCart } from 'lucide-react';
import { api } from '../lib/axios';
import { apiError } from '../lib/apiError';
import { fechaPeru, soles } from '../lib/formato';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import type { PaginaTurnos, ResumenCaja, TurnoCaja } from '../types/caja';

export default function Caja() {
  const user = useAuthStore(state => state.user);
  const { addToast, requestConfirm } = useUIStore();
  const queryClient = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const [almacen, setAlmacen] = useState('');
  const [fondo, setFondo] = useState('');
  const [notaApertura, setNotaApertura] = useState('');
  const [tipo, setTipo] = useState<'INGRESO' | 'RETIRO'>('RETIRO');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [referencia, setReferencia] = useState(() => crypto.randomUUID());
  const [contado, setContado] = useState('');
  const [notaCierre, setNotaCierre] = useState('');
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState('');
  const [cajero, setCajero] = useState('');
  const supervisor = user?.rol_nombre !== 'VENTAS';
  const puedeOperar = user?.rol_nombre === 'ADMINISTRADOR' || user?.rol_nombre === 'VENTAS';
  const actual = useQuery<ResumenCaja | null>({ queryKey: ['caja', 'actual'], staleTime: 0,
    queryFn: async () => (await api.get('/caja/actual')).data });
  const almacenes = useQuery<{ id_almacen: number; nombre: string }[]>({ queryKey: ['almacenes'], queryFn: async () => (await api.get('/almacenes')).data });
  const cajeros = useQuery<{ id_usuario: number; nombre_completo: string }[]>({ queryKey: ['caja', 'cajeros'],
    queryFn: async () => (await api.get('/caja/cajeros')).data, enabled: supervisor });
  const turnos = useQuery<PaginaTurnos>({ queryKey: ['caja', 'turnos', pagina, estado, cajero],
    queryFn: async () => (await api.get('/caja/turnos', { params: { pagina, estado: estado || undefined, cajero_id: cajero || undefined } })).data });
  const tid = seleccion ?? actual.data?.id_turno;
  const detalle = useQuery<ResumenCaja>({ queryKey: ['caja', 'detalle', tid], enabled: !!tid, staleTime: 0,
    queryFn: async () => (await api.get(`/caja/turnos/${tid}`)).data });
  const resumen = detalle.data;
  const editable = resumen?.estado === 'ABIERTO' && puedeOperar && (user?.rol_nombre === 'ADMINISTRADOR' || resumen.id_usuario === user?.id_usuario);
  const diferencia = contado === '' ? null : Number((Number(contado) - Number(resumen?.efectivo_esperado || 0)).toFixed(2));

  const ejecutar = async (accion: () => Promise<unknown>, mensaje: string, despues?: () => void) => {
    if (enviando.current) return;
    enviando.current = true; setOcupado(true);
    try {
      await accion();
      await queryClient.invalidateQueries({ queryKey: ['caja'] });
      despues?.();
      addToast(mensaje, 'success');
    } catch (error) { void queryClient.invalidateQueries({ queryKey: ['caja'] }); addToast(apiError(error), 'error'); }
    finally { enviando.current = false; setOcupado(false); }
  };
  const abrir = (event: React.FormEvent) => {
    event.preventDefault();
    void ejecutar(() => api.post('/caja/abrir', { id_almacen: Number(almacen), fondo_inicial: fondo, observaciones: notaApertura || null }),
      'Caja abierta. Ya puedes registrar ventas.', () => { setSeleccion(null); setFondo(''); setNotaApertura(''); });
  };
  const mover = (event: React.FormEvent) => {
    event.preventDefault();
    void ejecutar(() => api.post(`/caja/turnos/${tid}/movimientos`, { tipo, monto, motivo, referencia }), 'Movimiento registrado.', () => { setMonto(''); setMotivo(''); setReferencia(crypto.randomUUID()); });
  };
  const cerrar = (event: React.FormEvent) => {
    event.preventDefault();
    requestConfirm('Cerrar turno de caja', `Se registrará un conteo de ${soles(contado)}. El turno quedará cerrado para nuevas ventas y movimientos.`, () => {
      void ejecutar(() => api.post(`/caja/turnos/${tid}/cerrar`, { efectivo_contado: contado, observaciones: notaCierre || null }),
        'Turno cerrado y arqueo guardado.', () => { setSeleccion(tid || null); setContado(''); setNotaCierre(''); });
    });
  };
  const elegir = (turno: TurnoCaja) => { setSeleccion(turno.id_turno); setContado(''); setNotaCierre(''); setMonto(''); setMotivo(''); setReferencia(crypto.randomUUID()); };

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800"><Banknote className="text-blue-600" /> Caja y arqueo</h1><p className="mt-1 text-sm text-slate-500">Controla el efectivo por turno, registra retiros y compara tu conteo al cerrar.</p></div>
      <div className="flex gap-2"><Link to="/ventas/historial" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Historial de ventas</Link>
        {puedeOperar && actual.data && <Link to="/ventas/nueva" className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"><ShoppingCart size={17} /> Ir a vender</Link>}</div>
    </div>
    {actual.isError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No se pudo consultar tu caja. <button onClick={() => void actual.refetch()} className="font-bold underline">Reintentar</button></div>}
    {actual.isLoading && <p role="status" className="text-sm text-slate-500">Consultando turno actual…</p>}
    {puedeOperar && !actual.isLoading && !actual.isError && !actual.data && <form onSubmit={abrir} className="space-y-4 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-bold text-slate-800"><Plus size={18} /> Abrir mi caja</h2>
      <p className="text-sm text-slate-500">Elige el almacén donde atenderás e indica el efectivo que recibes al comenzar.</p>
      <fieldset disabled={ocupado} className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold text-slate-600">Almacén<select required value={almacen} onChange={e => setAlmacen(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5"><option value="">Selecciona un almacén</option>{almacenes.data?.map(a => <option key={a.id_almacen} value={a.id_almacen}>{a.nombre}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-600">Fondo inicial (S/)<input required type="number" min="0" step="0.01" value={fondo} onChange={e => setFondo(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5" placeholder="0.00" /></label>
        <label className="text-sm font-semibold text-slate-600">Nota de apertura<input maxLength={500} value={notaApertura} onChange={e => setNotaApertura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5" placeholder="Opcional" /></label>
      </fieldset>
      {almacenes.isError && <p className="text-sm text-red-600">No se pudieron cargar los almacenes. <button type="button" onClick={() => void almacenes.refetch()} className="underline">Reintentar</button></p>}
      <button disabled={ocupado || !almacen} className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white disabled:opacity-50">{ocupado ? 'Guardando…' : 'Abrir caja'}</button>
    </form>}

    {detalle.isLoading && tid && <p role="status" className="text-sm text-slate-500">Cargando resumen del turno…</p>}
    {detalle.isError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el turno. <button onClick={() => void detalle.refetch()} className="font-bold underline">Reintentar</button></div>}
    {resumen && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-800">Turno #{resumen.id_turno} <span className={`ml-2 rounded-full px-2.5 py-1 text-xs ${resumen.estado === 'ABIERTO' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{resumen.estado}</span></h2><p className="mt-2 text-xs text-slate-500">Apertura: {fechaPeru(resumen.fecha_apertura)}{resumen.fecha_cierre && ` · Cierre: ${fechaPeru(resumen.fecha_cierre)}`}</p></div>
        <Link to={`/ventas/historial?turno=${resumen.id_turno}`} className="text-sm font-bold text-blue-600">Ver ventas del turno</Link></div>
      <p className="text-sm text-slate-600"><strong>{resumen.cajero}</strong> · {resumen.almacen}{resumen.cerrado_por && ` · Cerrado por: ${resumen.cerrado_por}`}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Fondo inicial', resumen.fondo_inicial], ['Ventas en efectivo', resumen.ventas_por_metodo.find(m => m.metodo === 'EFECTIVO')?.total || 0], ['Ingresos / retiros', `${soles(resumen.ingresos_manuales)} / ${soles(resumen.retiros)}`], ['Efectivo esperado', resumen.efectivo_esperado]].map(([nombre, valor]) => <div key={String(nombre)} className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">{nombre}</p><p className="mt-2 text-xl font-black text-slate-800">{typeof valor === 'string' ? valor : soles(valor)}</p></div>)}
      </div>
      <p className="text-xs text-slate-500">Esperado = fondo inicial + ventas en efectivo + ingresos − retiros. Tarjetas, transferencias y ventas a crédito no suman efectivo físico.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 p-4"><h3 className="mb-3 text-sm font-bold text-slate-800">Ventas por método · {resumen.numero_ventas} ventas</h3>{resumen.ventas_por_metodo.length ? resumen.ventas_por_metodo.map(m => <div key={m.metodo} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span className="text-slate-500">{m.metodo} ({m.cantidad})</span><strong>{soles(m.total)}</strong></div>) : <p className="text-sm text-slate-400">Aún no hay ventas registradas en este turno.</p>}<div className="mt-3 flex justify-between font-bold text-slate-700"><span>Total vendido</span><span>{soles(resumen.ventas_total)}</span></div></div>
        <div className="rounded-xl border border-slate-100 p-4"><h3 className="mb-3 text-sm font-bold text-slate-800">Movimientos de efectivo</h3><div className="max-h-48 space-y-3 overflow-auto">{resumen.movimientos?.map(m => <div key={m.id_movimiento} className="text-xs"><div className="flex justify-between font-bold"><span className={m.tipo === 'RETIRO' ? 'text-amber-700' : 'text-emerald-700'}>{m.tipo}</span><span>{soles(m.monto)}</span></div><p className="mt-1 text-slate-600">{m.motivo}</p><p className="text-slate-400">{fechaPeru(m.fecha)} · {m.responsable}</p></div>)}{!resumen.movimientos?.length && <p className="text-sm text-slate-400">Sin ingresos o retiros manuales.</p>}</div></div>
      </div>
      {resumen.estado === 'CERRADO' && <div className={`rounded-xl border p-4 ${Number(resumen.diferencia) === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><h3 className="flex items-center gap-2 font-bold"><ClipboardCheck size={18} /> Arqueo guardado</h3><p className="mt-2 text-sm">Contado: {soles(resumen.efectivo_contado)} · Esperado: {soles(resumen.efectivo_esperado_cierre)} · Diferencia: <strong>{soles(resumen.diferencia)}</strong></p>{resumen.observaciones_cierre && <p className="mt-2 text-sm">{resumen.observaciones_cierre}</p>}</div>}
      {editable && <div className="grid gap-5 border-t border-slate-100 pt-5 lg:grid-cols-2">
        <form onSubmit={mover} className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Registrar ingreso o retiro</h3>
          <fieldset disabled={ocupado} className="space-y-3">
            <div className="flex gap-2">
              <select aria-label="Tipo de movimiento" value={tipo} onChange={e => { setTipo(e.target.value as 'INGRESO' | 'RETIRO'); setReferencia(crypto.randomUUID()); }} className="rounded-lg border border-slate-300 bg-white p-2 text-sm"><option value="RETIRO">Retiro</option><option value="INGRESO">Ingreso</option></select>
              <input aria-label="Monto del movimiento" required type="number" min="0.01" step="0.01" value={monto} onChange={e => { setMonto(e.target.value); setReferencia(crypto.randomUUID()); }} placeholder="Monto S/" className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-sm" />
            </div>
            <input aria-label="Motivo del movimiento" required minLength={3} maxLength={250} value={motivo} onChange={e => { setMotivo(e.target.value); setReferencia(crypto.randomUUID()); }} placeholder="Motivo obligatorio" className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
            <button className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">Registrar movimiento</button>
          </fieldset>
        </form>
        <form onSubmit={cerrar} className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><LockKeyhole size={16} /> Cerrar turno</h3><fieldset disabled={ocupado} className="space-y-3"><input aria-label="Efectivo contado al cierre" required type="number" min="0" step="0.01" value={contado} onChange={e => setContado(e.target.value)} placeholder="Efectivo contado S/" className="w-full rounded-lg border border-slate-300 p-2 text-sm" />{diferencia !== null && <p className="text-xs text-slate-600">Diferencia estimada: <strong>{soles(diferencia)}</strong> {diferencia < 0 ? '(faltante)' : diferencia > 0 ? '(sobrante)' : '(cuadrado)'}</p>}<textarea aria-label="Observaciones de cierre" required={diferencia !== null && diferencia !== 0} minLength={diferencia !== 0 ? 3 : undefined} maxLength={500} value={notaCierre} onChange={e => setNotaCierre(e.target.value)} placeholder="Observaciones (obligatorias si hay diferencia)" className="w-full rounded-lg border border-slate-300 p-2 text-sm" /><button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white">Guardar cierre</button></fieldset></form>
      </div>}
    </section>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><h2 className="font-bold text-slate-800">{supervisor ? 'Turnos de caja' : 'Mis turnos'}</h2><div className="flex gap-2"><select aria-label="Estado del turno" value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }} className="rounded-lg border border-slate-200 bg-white p-2 text-sm"><option value="">Todos los estados</option><option value="ABIERTO">Abiertos</option><option value="CERRADO">Cerrados</option></select>{supervisor && <select aria-label="Filtrar por cajero" value={cajero} onChange={e => { setCajero(e.target.value); setPagina(1); }} className="rounded-lg border border-slate-200 bg-white p-2 text-sm"><option value="">Todos los cajeros</option>{cajeros.data?.map(c => <option key={c.id_usuario} value={c.id_usuario}>{c.nombre_completo}</option>)}</select>}</div></div>
      {turnos.isError ? <p role="alert" className="p-5 text-sm text-red-600">No se pudo cargar el historial. <button onClick={() => void turnos.refetch()} className="inline-flex items-center gap-1 underline"><RefreshCw size={14} /> Reintentar</button></p> : turnos.isLoading ? <p className="p-5 text-sm text-slate-500">Cargando turnos…</p> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Turno','Cajero / Almacén','Apertura','Estado','Contado','Diferencia',''].map((titulo,i) => <th key={i} className="px-5 py-3">{titulo}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{turnos.data?.items.map(t => <tr key={t.id_turno} className="text-slate-600"><td className="px-5 py-3 font-bold">#{t.id_turno}</td><td className="px-5 py-3"><div>{t.cajero}</div><div className="text-xs text-slate-400">{t.almacen}</div></td><td className="px-5 py-3">{fechaPeru(t.fecha_apertura)}</td><td className="px-5 py-3">{t.estado}</td><td className="px-5 py-3">{t.efectivo_contado === null ? '—' : soles(t.efectivo_contado)}</td><td className="px-5 py-3">{t.diferencia === null ? '—' : soles(t.diferencia)}</td><td className="px-5 py-3"><button onClick={() => elegir(t)} className="font-bold text-blue-600">Ver detalle</button></td></tr>)}{!turnos.data?.items.length && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No hay turnos con estos filtros.</td></tr>}</tbody></table></div><div className="flex items-center justify-between p-4 text-xs text-slate-500"><span>{turnos.data?.total || 0} turnos · Página {pagina}</span><div className="flex gap-2"><button disabled={pagina === 1} onClick={() => setPagina(p => p-1)} className="rounded border px-3 py-1.5 disabled:opacity-30">Anterior</button><button disabled={pagina*20 >= (turnos.data?.total || 0)} onClick={() => setPagina(p => p+1)} className="rounded border px-3 py-1.5 disabled:opacity-30">Siguiente</button></div></div></>}
    </section>
  </div>;
}
