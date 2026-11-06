import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Area, ComposedChart, ReferenceLine, Legend 
} from 'recharts';
import { 
  BrainCircuit, TrendingUp, AlertTriangle, CheckCircle, Package, 
  ShoppingCart, Calendar, Sliders, ShieldAlert, Layers, ArrowUpRight, Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import type { Pronostico, ResumenAbastecimiento } from '../types/abastecimiento';
import { useUIStore } from '../store/uiStore';
import { apiError } from '../lib/apiError';

interface ProductoPredictivo {
  id_producto: number;
  sku: string;
  nombre: string;
  categoria: string;
  stock_actual: number;
  stock_disponible: number;
  tiempo_entrega_dias: number;
  proveedor_principal: string;
  total_vendido: number;
}

interface AlertaCompra {
  id_producto: number;
  sku: string;
  producto: string;
  categoria: string;
  stock_actual: number;
  punto_reorden: number;
  stock_seguridad: number;
  lead_time_dias: number;
  proveedor: string;
  cantidad_sugerida: number;
  costo_estimado_pen: number | null;
  prioridad: 'ALTA' | 'MEDIA';
  demanda_diaria_estimada: number;
  stock_disponible: number;
  id_proveedor: number | null;
  peso_kg: number;
  volumen_m3: number;
}

export default function Predicciones() {
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [diasProyeccion, setDiasProyeccion] = useState<number>(14);
  const [nivelServicio, setNivelServicio] = useState<number>(0.95);
  const [activeTab, setActiveTab] = useState<'individual' | 'global'>('individual');
  const [exportando, setExportando] = useState(false);
  const addToast = useUIStore(state => state.addToast);
  const exportarPlan = async () => {
    setExportando(true);
    try {
      const { data } = await api.get('/predicciones/plan-compras/excel', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'plan_compras.xlsx';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      addToast('Plan de compras exportado.', 'success');
    } catch (error) {
      addToast(apiError(error, 'No se pudo exportar el plan de compras.'), 'error');
    } finally {
      setExportando(false);
    }
  };
  const rol = useAuthStore(state => state.user?.rol_nombre);
  const puedeComprar = rol === 'ADMINISTRADOR' || rol === 'COMPRAS';
  const dinero = (valor: number | null) => valor === null ? 'Costo por confirmar' : `S/ ${valor.toFixed(2)}`;

  // 1. Obtener lista de productos
  const { data: productos = [], isLoading: isLoadingProductos, isError: errorProductos, refetch: recargarProductos } = useQuery<ProductoPredictivo[]>({
    queryKey: ['productos-prediccion'],
    queryFn: async () => {
      const res = await api.get('/predicciones/productos');
      return res.data;
    }
  });

  // 2. Obtener pronóstico ARIMA para el producto seleccionado
  const activeId = selectedProductId || (productos.length > 0 ? productos[0].id_producto : null);

  const { data: pronostico, isLoading: isLoadingARIMA, isError: errorARIMA, refetch: recargarARIMA } = useQuery<Pronostico>({
    queryKey: ['prediccion-arima', activeId, diasProyeccion, nivelServicio],
    queryFn: async () => {
      const res = await api.get(`/predicciones/arima/${activeId}`, {
        params: {
          dias_proyeccion: diasProyeccion,
          nivel_servicio: nivelServicio
        }
      });
      return res.data;
    },
    enabled: !!activeId && activeTab === 'individual'
  });

  // 3. Obtener resumen de alertas globales de reabastecimiento
  const { data: resumenAbastecimiento, isLoading: isLoadingResumen, isError: errorResumen, refetch: recargarResumen } = useQuery<ResumenAbastecimiento>({
    queryKey: ['resumen-abastecimiento'],
    queryFn: async () => {
      const res = await api.get('/predicciones/resumen-abastecimiento');
      return res.data;
    },
    enabled: activeTab === 'global'
  });

  const getBadgeStyle = (estado: string) => {
    switch (estado) {
      case 'SIN_DEMANDA':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'CRITICO':
      case 'AGOTADO':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'REORDEN':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SOBRESTOCK':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <BrainCircuit size={22} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Pronóstico de Demanda e Inventario Inteligente (ARIMA)
            </h1>
          </div>
          <p className="text-slate-500 text-sm max-w-3xl">
            Modelado predictivo autoregresivo (ARIMA) para estimación de ventas futuras, cálculo estocástico de Stock de Seguridad (SS) y Punto de Reorden (ROP).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'individual'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp size={16} /> Modelo ARIMA por Producto
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'global'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert size={16} /> Plan de Compras Sugeridas (ROP)
          </button>
        </div>
      </div>

      {/* TAB 1: MODELO ARIMA POR PRODUCTO */}
      {activeTab === 'individual' && (
        <div className="space-y-6">
          {/* Controles y Parámetros */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Producto a Analizar
              </label>
              <select
                value={activeId || ''}
                onChange={(e) => setSelectedProductId(Number(e.target.value))}
                disabled={isLoadingProductos}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {productos.map((p) => (
                  <option key={p.id_producto} value={p.id_producto}>
                    {p.sku} — {p.nombre} (Stock: {p.stock_actual})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} /> Días de Proyección Futura
              </label>
              <div className="flex gap-2">
                {[7, 14, 30].map((dias) => (
                  <button
                    key={dias}
                    onClick={() => setDiasProyeccion(dias)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      diasProyeccion === dias
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {dias} Días
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                <Sliders size={14} /> Nivel de Servicio (Z-Score)
              </label>
              <div className="flex gap-2">
                {[
                  { label: '90%', val: 0.90 },
                  { label: '95% (Estándar)', val: 0.95 },
                  { label: '99% (Crítico)', val: 0.99 }
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => setNivelServicio(item.val)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      nivelServicio === item.val
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {errorProductos || errorARIMA ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
              No se pudo cargar el análisis. Comprueba la conexión e inténtalo de nuevo.
              <button className="ml-3 font-bold underline" onClick={() => void (errorProductos ? recargarProductos() : recargarARIMA())}>Reintentar</button>
            </div>
          ) : isLoadingARIMA ? (
            <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center animate-pulse">
              <BrainCircuit className="mx-auto text-blue-500 animate-spin mb-3" size={36} />
              <p className="text-slate-600 font-bold">Ajustando coeficientes del modelo ARIMA...</p>
              <p className="text-slate-400 text-xs mt-1">Calculando varianza de residuos y límites de confianza</p>
            </div>
          ) : pronostico ? (
            <>
              <div className={`rounded-2xl border p-4 text-sm ${pronostico.calidad_datos.estado === 'SUFICIENTE' ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                <p className="font-bold">{pronostico.calidad_datos.estado === 'SIN_VENTAS' ? 'Sin ventas registradas: no se recomienda comprar automáticamente.' : pronostico.calidad_datos.estado === 'LIMITADO' ? 'Historial limitado: revisa la propuesta antes de comprar.' : 'Historial disponible para modelado.'}</p>
                <p className="mt-1">Corte: {pronostico.calidad_datos.fecha_corte} · {pronostico.calidad_datos.dias_historial} días de historial · {pronostico.calidad_datos.dias_con_ventas} días con ventas.</p>
                <p className="mt-1 text-xs">{pronostico.calidad_datos.advertencia}</p>
              </div>
              {/* Tarjetas de Métricas Predictivas y Logísticas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Demanda Promedio Proyectada */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Demanda Diaria (d̄)</span>
                    <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={18} /></span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">
                      {pronostico.metricas_pronostico.demanda_diaria_promedio}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">unid / día</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Total proyectado ({diasProyeccion}d): <strong className="text-slate-700">{pronostico.metricas_pronostico.demanda_total_proyectada} unid</strong>
                  </p>
                </div>

                {/* 2. Stock Actual y Cobertura */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Stock disponible</span>
                    <span className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Package size={18} /></span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">
                      {pronostico.producto.stock_disponible}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">unid</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Cobertura estimada: <strong className="text-slate-700">{pronostico.metricas_pronostico.dias_cobertura_actual === null ? 'Sin demanda estimable' : `${pronostico.metricas_pronostico.dias_cobertura_actual} días`}</strong>
                  </p>
                </div>

                {/* 3. Punto de Reorden (ROP) y Stock de Seguridad */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Punto de Reorden (ROP)</span>
                    <span className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Layers size={18} /></span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">
                      {pronostico.politica_inventario.punto_reorden}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">unid</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Stock de Seguridad (SS): <strong className="text-slate-700">{pronostico.politica_inventario.stock_seguridad} unid</strong> (Lead: {pronostico.producto.lead_time_dias}d)
                  </p>
                </div>

                {/* 4. Estado de Abastecimiento */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Estado de Abastecimiento</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${getBadgeStyle(pronostico.politica_inventario.estado)}`}>
                      {pronostico.politica_inventario.estado}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {pronostico.politica_inventario.mensaje}
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    Algoritmo: {pronostico.parametros_modelo.algoritmo}
                  </div>
                </div>
              </div>

              {/* Gráfica ARIMA Interactiva */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      Curva Temporal: Historial de Ventas vs. Pronóstico ARIMA
                    </h3>
                    <p className="text-xs text-slate-500">
                      Banda estimada al {pronostico.parametros_modelo.nivel_servicio_porcentaje}%. Método: {pronostico.parametros_modelo.algoritmo}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                      <span className="text-slate-600">Ventas Reales</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 border-t-2 border-dashed border-amber-500"></div>
                      <span className="text-slate-600">Pronóstico ARIMA</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-2 bg-amber-100 border border-amber-300 rounded-xs"></div>
                      <span className="text-slate-600">Intervalo Confianza</span>
                    </div>
                  </div>
                </div>

                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={pronostico.timeline_grafica.map(punto => ({ ...punto, intervalo: punto.limite_inferior === null ? null : [punto.limite_inferior, punto.limite_superior] }))} margin={{ top: 10, right: 30, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis 
                        dataKey="fecha" 
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        stroke="#CBD5E1"
                        tickFormatter={(f) => f.slice(5)}
                      />
                      <YAxis 
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        stroke="#CBD5E1"
                        allowDecimals={false}
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-xl text-xs space-y-1">
                                <p className="font-bold text-slate-800 border-b border-slate-100 pb-1">{label}</p>
                                {payload.map((entry, index) => (
                                  entry.value !== null && entry.value !== undefined && (
                                    <div key={index} className="flex justify-between gap-4 font-medium" style={{ color: entry.color }}>
                                      <span>{entry.name}:</span>
                                      <span className="font-bold font-mono">{Array.isArray(entry.value) ? entry.value.map(valor => Number(valor).toFixed(2)).join(' – ') : Number(entry.value).toFixed(2)} unid</span>
                                    </div>
                                  )
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />

                      {/* Intervalo de Confianza Superior / Inferior (Banda sombreada) */}
                      <Area 
                        type="monotone" 
                        dataKey="intervalo" 
                        name="Intervalo estimado" 
                        stroke="none" 
                        fill="#FDE68A" 
                        fillOpacity={0.4} 
                      />

                      {/* Ventas Reales Históricas */}
                      <Line 
                        type="monotone" 
                        dataKey="ventas_reales" 
                        name="Ventas Reales" 
                        stroke="#2563EB" 
                        strokeWidth={2.5} 
                        dot={{ r: 3, fill: '#2563EB' }}
                        activeDot={{ r: 6 }} 
                      />

                      {/* Proyección Futura ARIMA */}
                      <Line 
                        type="monotone" 
                        dataKey="pronostico" 
                        name="Proyección ARIMA" 
                        stroke="#D97706" 
                        strokeWidth={2.5} 
                        strokeDasharray="5 5" 
                        dot={{ r: 4, fill: '#D97706' }} 
                      />

                      {/* Línea de referencia: Demanda Promedio */}
                      <ReferenceLine 
                        y={pronostico.metricas_pronostico.demanda_diaria_promedio} 
                        label={{ value: 'd̄ Promedio', fill: '#94A3B8', fontSize: 10, position: 'insideTopRight' }} 
                        stroke="#94A3B8" 
                        strokeDasharray="3 3" 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Caja de Acción y Recomendación de Compra */}
              <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                    <h4 className="text-base font-bold text-slate-800">
                      Recomendación Logística para {pronostico.producto.nombre}
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 max-w-2xl">
                    {pronostico.politica_inventario.cantidad_sugerida_compra > 0 ? (
                      <>
                        El stock disponible ({pronostico.producto.stock_disponible} unid) alcanzó el Punto de Reorden ({pronostico.politica_inventario.punto_reorden} unid).
                        Se propone comprar <strong className="text-blue-700 font-black">{pronostico.politica_inventario.cantidad_sugerida_compra} unidades</strong> al proveedor <em>{pronostico.producto.proveedor}</em>. <strong>{dinero(pronostico.politica_inventario.inversion_estimada_pen)}</strong>.
                      </>
                    ) : (
                      <>
                        {pronostico.politica_inventario.mensaje} No se propone una compra automática.
                      </>
                    )}
                  </p>
                </div>

                {puedeComprar && pronostico.politica_inventario.cantidad_sugerida_compra > 0 && (
                  <Link
                    to="/importaciones"
                    state={{ sugerencia: { ...pronostico.producto, cantidad: pronostico.politica_inventario.cantidad_sugerida_compra, costo_unitario: pronostico.producto.costo_promedio_pen } }}
                    className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all whitespace-nowrap"
                  >
                    <ShoppingCart size={18} />
                    Preparar compra
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
              Selecciona un producto para visualizar el análisis predictivo.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PLAN GLOBAL DE COMPRAS SUGERIDAS (ROP) */}
      {activeTab === 'global' && (
        <div className="space-y-6">
          {errorResumen ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
              No se pudo cargar el plan de compras.
              <button className="ml-3 font-bold underline" onClick={() => void recargarResumen()}>Reintentar</button>
            </div>
          ) : isLoadingResumen ? (
            <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center animate-pulse">
              <Package className="mx-auto text-blue-500 animate-bounce mb-3" size={36} />
              <p className="text-slate-600 font-bold">Evaluando políticas de inventario de todo el catálogo...</p>
            </div>
          ) : resumenAbastecimiento ? (
            <>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                Corte: {resumenAbastecimiento.resumen.fecha_corte}. Propuesta basada en ventas de hasta 30 días completos y stock disponible de todos los almacenes.
                <p className="mt-1">{resumenAbastecimiento.resumen.productos_sin_ventas} productos sin ventas no generan pedidos automáticos. {resumenAbastecimiento.resumen.productos_sin_costo > 0 && <strong>{resumenAbastecimiento.resumen.productos_sin_costo} propuestas sin costo: el presupuesto total es parcial.</strong>}</p>
                <button onClick={() => void exportarPlan()} disabled={exportando}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                  <Download size={16} /> {exportando ? 'Exportando…' : 'Exportar plan a Excel'}
                </button>
              </div>
              {/* Tarjetas de Resumen Global */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Productos en Punto de Reorden</span>
                  <div className="mt-2 text-3xl font-black text-slate-800">
                    {resumenAbastecimiento.resumen.total_productos_en_alerta}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Requieren emisión de orden de reabastecimiento</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold uppercase text-red-500 tracking-wider">Productos Críticos / Agotados</span>
                  <div className="mt-2 text-3xl font-black text-red-600">
                    {resumenAbastecimiento.resumen.productos_criticos}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Nivel de stock por debajo del stock de seguridad</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold uppercase text-emerald-600 tracking-wider">Inversión Estimada Requerida</span>
                  <div className="mt-2 text-3xl font-black text-emerald-700">
                    S/ {resumenAbastecimiento.resumen.inversion_total_estimada_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Para alcanzar 20 días de cobertura deseada</p>
                </div>
              </div>

              {/* Tabla de Productos Sugeridos */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle className="text-emerald-500" size={18} />
                    Listado Priorizado de Adquisiciones (Reorden Automático)
                  </h3>
                  {puedeComprar && <Link
                    to="/importaciones"
                    className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Ir a Importaciones y Órdenes <ArrowUpRight size={14} />
                  </Link>}
                </div>

                {resumenAbastecimiento.sugerencias_compra.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <CheckCircle className="mx-auto text-emerald-500 mb-2" size={32} />
                    <p className="font-bold text-slate-700">Sin propuestas de compra para este período.</p>
                    <p className="text-xs text-slate-400 mt-1">Revisa por separado los productos sin ventas o con historial limitado.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3">Prioridad</th>
                          <th className="px-5 py-3">Producto / SKU</th>
                          <th className="px-5 py-3 text-right">Stock disponible</th>
                          <th className="px-5 py-3 text-right">Punto Reorden (ROP)</th>
                          <th className="px-5 py-3 text-right">Demanda Diaria</th>
                          <th className="px-5 py-3">Proveedor (Lead Time)</th>
                          <th className="px-5 py-3 text-right">Cant. Sugerida</th>
                          <th className="px-5 py-3 text-right">Inversión (S/)</th>
                          <th className="px-5 py-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {resumenAbastecimiento.sugerencias_compra.map((item: AlertaCompra) => (
                          <tr key={item.id_producto} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                                item.prioridad === 'ALTA'
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : 'bg-amber-100 text-amber-700 border border-amber-200'
                              }`}>
                                <AlertTriangle size={12} />
                                {item.prioridad}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-800">{item.producto}</div>
                              <div className="text-xs text-slate-400 font-mono">{item.sku} • {item.categoria}</div>
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                              {item.stock_disponible}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-slate-700">
                              {item.punto_reorden}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-slate-600">
                              {item.demanda_diaria_estimada} / día
                            </td>
                            <td className="px-5 py-3.5 text-slate-700">
                              <div>{item.proveedor}</div>
                              <div className="text-xs text-slate-400">{item.lead_time_dias} días de entrega</div>
                            </td>
                            <td className="px-5 py-3.5 text-right font-black text-blue-700">
                              +{item.cantidad_sugerida} unid
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-emerald-700">
                              {dinero(item.costo_estimado_pen)}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {puedeComprar && <Link
                                to="/importaciones"
                                state={{ sugerencia: { id_producto: item.id_producto, sku: item.sku, nombre: item.producto, cantidad: item.cantidad_sugerida, id_proveedor: item.id_proveedor, costo_unitario: item.costo_estimado_pen === null ? null : item.costo_estimado_pen / item.cantidad_sugerida, peso_kg: item.peso_kg, volumen_m3: item.volumen_m3 } }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all"
                              >
                                Ordenar <ArrowUpRight size={12} />
                              </Link>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
