import { useState } from "react";
import { ArrowLeftRight, ShoppingCart, Truck, RefreshCw, AlertTriangle } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';

interface MovimientoG {
 fecha: string;
 producto: string;
 tipo_movimiento: string;
 cantidad: number;
 stock_anterior: number;
 stock_posterior: number;
 costo_unitario: number;
}

const CATEGORIAS = [
  { id: 'TODOS', label: 'Todos', icon: ArrowLeftRight },
  { id: 'VENTAS', label: 'Ventas', icon: ShoppingCart },
  { id: 'COMPRAS', label: 'Compras', icon: Truck },
  { id: 'TRASLADOS', label: 'Traslados', icon: RefreshCw },
  { id: 'OTROS', label: 'Mermas / Ajustes', icon: AlertTriangle },
];

export default function Movimientos() {
 const [categoria, setCategoria] = useState('TODOS');

 const { data: movimientos = [], isLoading: loading } = useQuery<MovimientoG[]>({
 queryKey: ['movimientos_global', categoria],
 queryFn: async () => {
 const params = categoria !== 'TODOS' ? { categoria } : {};
 const res = await api.get("/movimientos", { params });
 return res.data;
 }
 });

 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <h2 className="text-2xl font-bold text-slate-800 ">Registro de Movimientos</h2>
 </div>

 {/* Pestañas de Categorías */}
 <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-full overflow-x-auto">
   {CATEGORIAS.map((cat) => {
     const Icon = cat.icon;
     const isSelected = categoria === cat.id;
     return (
       <button
         key={cat.id}
         onClick={() => setCategoria(cat.id)}
         className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
           isSelected 
             ? 'bg-white text-blue-700 shadow-sm' 
             : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
         }`}
       >
         <Icon size={16} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
         {cat.label}
       </button>
     );
   })}
 </div>

 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 {loading ? (
 <div className="p-8 text-center text-slate-500">Cargando movimientos...</div>
 ) : movimientos.length === 0 ? (
 <div className="p-12 flex flex-col items-center justify-center text-slate-500 ">
 <ArrowLeftRight size={48} className="mb-4 text-slate-400 " />
 <p className="text-lg font-medium">No hay movimientos en esta categoría</p>
 <p className="text-sm">Aún no se han registrado operaciones de este tipo.</p>
 </div>
 ) : (
 <table className="min-w-full divide-y divide-slate-200 ">
 <thead className="bg-slate-50 ">
 <tr>
 <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
 <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Producto</th>
 <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
 <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cant.</th>
 <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Final</th>
 <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Costo U.</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-slate-200 ">
 {movimientos.map((m, idx) => (
 <tr key={idx} className="hover:bg-slate-50 transition-colors">
 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 ">{new Date(m.fecha).toLocaleString()}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 ">{m.producto}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm">
 <span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
 m.tipo_movimiento === 'COMPRA' || m.tipo_movimiento.includes('ENTRADA') 
 ? 'bg-indigo-100 text-indigo-800 ' 
 : m.tipo_movimiento === 'VENTA' || m.tipo_movimiento.includes('SALIDA')
 ? 'bg-orange-100 text-orange-800 '
 : 'bg-slate-100 text-slate-800 '
 }`}>
 {m.tipo_movimiento.replace('_', ' ')}
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 ">
 {m.tipo_movimiento.includes('VENTA') || m.tipo_movimiento.includes('SALIDA') ? `-${m.cantidad}` : `+${m.cantidad}`}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 ">{m.stock_posterior}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 ">S/ {m.costo_unitario}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 </div>
 );
}
