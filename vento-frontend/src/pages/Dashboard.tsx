import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, AlertCircle, PackageX, DollarSign, ArrowRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

interface KPIs {
  ventas_hoy: number;
  ventas_mes: number;
  capital_inmovilizado: number;
  stockouts: number;
  alertas_rop: number;
}

interface AlertaROP {
  sku: string;
  producto: string;
  almacen: string;
  stock_actual: number;
  punto_reorden: number;
  estado: string;
}

interface ABCData {
  categoria: string;
  count: number;
}

interface TendenciaData {
  fecha: string;
  total: number;
  unidades: number;
}

const COLORS = ['#1D4ED8', '#10B981', '#F59E0B', '#EF4444'];

export default function Dashboard() {
  const [dias, setDias] = useState<number>(14);

  const { data: kpis, isLoading: loadKPIs } = useQuery<KPIs>({
    queryKey: ['dashboardKPIs', dias],
    queryFn: async () => (await api.get(`/dashboard/kpis?dias=${dias}`)).data
  });

  const { data: alertas = [], isLoading: loadAlertas } = useQuery<AlertaROP[]>({
    queryKey: ['dashboardAlertas'],
    queryFn: async () => (await api.get("/dashboard/alertas-rop")).data
  });

  const { data: abcData = [], isLoading: loadABC } = useQuery<ABCData[]>({
    queryKey: ['dashboardABC'],
    queryFn: async () => (await api.get("/dashboard/abc-resumen")).data
  });

  const { data: tendencia = [], isLoading: loadTendencia } = useQuery<TendenciaData[]>({
    queryKey: ['dashboardTendencia', dias],
    queryFn: async () => (await api.get(`/dashboard/tendencia-ventas?dias=${dias}`)).data
  });

  const isLoading = loadKPIs || loadAlertas || loadABC || loadTendencia;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-xl leading-none">V</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 leading-tight">Panel Ejecutivo de Control</h2>
            <p className="text-sm font-medium text-slate-500">Inteligencia y Logística en tiempo real</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
          <Calendar size={16} className="text-slate-400" />
          <select 
            value={dias} 
            onChange={(e) => setDias(Number(e.target.value))}
            className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 3 meses</option>
          </select>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Top 4 KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Capital Inmovilizado</h3>
                  <p className="text-3xl font-black text-blue-700">
                    S/ {kpis?.capital_inmovilizado?.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                  </p>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={24} /></div>
              </div>
              <div className="absolute -bottom-4 -right-4 text-blue-50 opacity-50 transform group-hover:scale-110 transition-transform"><DollarSign size={100} /></div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Ventas (Periodo)</h3>
                  <p className="text-3xl font-black text-emerald-600">
                    S/ {kpis?.ventas_mes?.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                  </p>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={24} /></div>
              </div>
              <p className="text-xs font-semibold text-emerald-600 mt-2">Hoy: S/ {kpis?.ventas_hoy?.toFixed(2)}</p>
              <div className="absolute -bottom-4 -right-4 text-emerald-50 opacity-50 transform group-hover:scale-110 transition-transform"><TrendingUp size={100} /></div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Alertas ROP</h3>
                  <p className="text-3xl font-black text-amber-500">
                    {kpis?.alertas_rop ?? "0"}
                  </p>
                </div>
                <div className="p-2 bg-amber-50 text-amber-500 rounded-lg"><AlertCircle size={24} /></div>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-2">Productos en zona de reorden</p>
              <div className="absolute -bottom-4 -right-4 text-amber-50 opacity-50 transform group-hover:scale-110 transition-transform"><AlertCircle size={100} /></div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Quiebres / Stockouts</h3>
                  <p className="text-3xl font-black text-red-600">
                    {kpis?.stockouts ?? "0"}
                  </p>
                </div>
                <div className="p-2 bg-red-50 text-red-600 rounded-lg"><PackageX size={24} /></div>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-2">SKUs agotados</p>
              <div className="absolute -bottom-4 -right-4 text-red-50 opacity-50 transform group-hover:scale-110 transition-transform"><PackageX size={100} /></div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Tendencia de Ventas ({dias} días)</h3>
              <div className="h-72 w-full">
                {tendencia.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tendencia}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="fecha" stroke="#94A3B8" fontSize={12} tickMargin={10} />
                      <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(val) => `S/${val}`} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, 'Ingreso']}
                        labelStyle={{ fontWeight: 'bold', color: '#1E293B', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">Sin datos de ventas en este periodo.</div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Distribución ABC</h3>
              <div className="h-64 w-full">
                {abcData.some(d => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={abcData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="categoria"
                      >
                        {abcData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value, name) => [`${value} SKUs`, `Categoría ${name}`]}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm text-center px-4">
                    Sin clasificación ABC procesada. Los parámetros se generarán al haber más movimientos.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROP Table Row */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-[#F8FAFC]">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Alertas Operativas (ROP & Stockouts)</h3>
                <p className="text-sm text-slate-500">Productos que requieren reabastecimiento inmediato</p>
              </div>
              <Link to="/importaciones" className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-1 transition-colors">
                Ver Módulo de Compras <ArrowRight size={16} />
              </Link>
            </div>
            {alertas.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-medium">
                No hay alertas de stock. Inventario en niveles óptimos.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU / Producto</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Almacén</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Actual</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Punto Reorden</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Severidad</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-50">
                    {alertas.map((alerta, idx) => {
                      const isStockout = alerta.estado === 'STOCKOUT';
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-bold text-slate-800">{alerta.sku}</p>
                            <p className="text-xs text-slate-500 truncate w-48">{alerta.producto}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {alerta.almacen}
                            </span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-right font-black ${isStockout ? 'text-red-600' : 'text-amber-600'}`}>
                            {alerta.stock_actual}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-600">
                            {alerta.punto_reorden}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                              isStockout 
                                ? 'bg-red-50 text-red-600 border border-red-100' 
                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {alerta.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Link to="/importaciones" className="inline-flex items-center justify-center px-3 py-1.5 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors">
                              Pedir
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
