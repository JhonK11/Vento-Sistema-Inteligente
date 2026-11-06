import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';

interface Movimiento {
 fecha: string;
 tipo_movimiento: string;
 cantidad: number;
 stock_anterior: number;
 stock_posterior: number;
 costo_unitario: number;
}

export default function ProductoDetalle() {
 const { id } = useParams();

 const { data: movimientos = [] } = useQuery<Movimiento[]>({
 queryKey: ['movimientos', id],
 queryFn: async () => {
 const res = await api.get(`/productos/${id}/movimientos`);
 return res.data;
 }
 });

 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4">
 <Link to="/kardex" className="p-2 hover:bg-slate-200 :bg-slate-700 rounded-full transition-colors text-slate-600 ">
 <ArrowLeft size={24} />
 </Link>
 <h2 className="text-2xl font-bold text-slate-800 ">Kardex de Movimientos (Producto #{id})</h2>
 </div>
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <table className="min-w-full divide-y divide-slate-200 ">
 <thead className="bg-slate-50 ">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Movimiento</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cantidad</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Stock Anterior</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Stock Posterior</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Costo Unit.</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-slate-200 ">
 {movimientos.length === 0 ? (
 <tr>
 <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">No hay movimientos registrados.</td>
 </tr>
 ) : movimientos.map((m, idx) => (
 <tr key={idx} className="hover:bg-slate-50 :bg-slate-700/50 transition-colors">
 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 ">{new Date(m.fecha).toLocaleString()}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
 <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${m.tipo_movimiento === 'COMPRA' || m.tipo_movimiento.includes('ENTRADA') ? 'bg-indigo-100 text-indigo-800 ' : 'bg-orange-100 text-orange-800 '}`}>
 {m.tipo_movimiento}
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 ">{m.cantidad}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">{m.stock_anterior}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">{m.stock_posterior}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">S/ {m.costo_unitario}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
}
