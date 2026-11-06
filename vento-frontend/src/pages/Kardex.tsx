import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, X } from 'lucide-react';
import { api } from '../lib/axios';
import { useUIStore } from '../store/uiStore';
import { apiError } from '../lib/apiError';
import { RequireRole } from '../components/auth/RequireRole';

interface Producto {
 id_producto: number;
 sku: string;
 nombre: string;
 estado: string;
 activo: number;
 peso_kg: number | null;
 volumen_m3: number | null;
 precio_venta: number;
}

export default function Kardex() {
 const queryClient = useQueryClient();
 const { addToast, requestConfirm } = useUIStore();
 const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
 const [editForm, setEditForm] = useState({ peso_kg: 0, volumen_m3: 0, precio_venta: 0 });
 const [activeTab, setActiveTab] = useState('Todos');

 const { data: productos, isLoading, isError } = useQuery<Producto[]>({
 queryKey: ['productos'],
 queryFn: async () => {
 const res = await api.get("/productos");
 return res.data;
 }
 });

 const updateMutation = useMutation({
 mutationFn: async (payload: typeof editForm) => {
 await api.put(`/productos/${editingProduct?.id_producto}`, payload);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['productos'] });
 setEditingProduct(null);
 addToast("Producto actualizado y auditado correctamente.", "success");
 },
 onError: (err: unknown) => {
 addToast(apiError(err, "Error al actualizar el producto."), "error");
 }
 });

 const deleteMutation = useMutation({
 mutationFn: async (id: number) => {
 await api.delete(`/productos/${id}`);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['productos'] });
 addToast("Producto eliminado lógicamente.", "success");
 },
 onError: () => {
 addToast("Error al eliminar el producto.", "error");
 }
 });

 const handleEditClick = (p: Producto) => {
 setEditingProduct(p);
 setEditForm({
 peso_kg: p.peso_kg || 0,
 volumen_m3: p.volumen_m3 || 0,
 precio_venta: p.precio_venta || 0
 });
 };

 const handleUpdate = (e: React.FormEvent) => {
 e.preventDefault();
 updateMutation.mutate(editForm);
 };

 const handleDelete = (id: number) => {
 requestConfirm(
   "Baja Lógica de Producto",
   "¿Está seguro de dar de baja este producto? Ya no estará disponible para nuevas ventas o compras.",
   () => deleteMutation.mutate(id)
 );
 };

 return (
 <div className="space-y-6">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <h2 className="text-2xl font-bold text-slate-800">Kardex de Productos</h2>
 <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
 {['Todos', 'Activos', 'Inactivos'].map(tab => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
 activeTab === tab 
 ? 'bg-blue-600 text-white shadow-sm' 
 : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
 }`}
 >
 {tab}
 </button>
 ))}
 </div>
 </div>
 
 {isLoading ? (
 <p className="text-slate-500">Cargando productos...</p>
 ) : isError ? (
 <p className="text-red-500">Error al cargar productos.</p>
 ) : (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <table className="min-w-full divide-y divide-slate-200">
 <thead className="bg-slate-50">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">SKU</th>
 <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Nombre</th>
 <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Precio</th>
 <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
 <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-slate-100">
 {productos?.filter(p => {
 if (activeTab === 'Activos') return p.estado === 'ACTIVO';
 if (activeTab === 'Inactivos') return p.estado !== 'ACTIVO';
 return true;
 }).map(p => (
 <tr key={p.id_producto} className="hover:bg-slate-50 transition-colors">
 <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{p.sku}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">{p.nombre}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">S/ {Number(p.precio_venta).toFixed(2)}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm">
 <span className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-md ${p.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
 {p.estado}
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-3 items-center">
 <Link to={`/kardex/${p.id_producto}`} className="text-blue-600 hover:text-blue-800 mr-2 font-semibold">
 Movimientos
 </Link>
 <RequireRole roles={['ADMINISTRADOR', 'ALMACEN']}>
 <button onClick={() => handleEditClick(p)} className="text-slate-400 hover:text-blue-600" title="Editar gobernado">
 <Pencil size={18} />
 </button>
 <button onClick={() => handleDelete(p.id_producto)} className="text-slate-400 hover:text-red-600" title="Baja lógica">
 <Trash2 size={18} />
 </button>
 </RequireRole>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Modal de Edición Segura */}
 {editingProduct && (
 <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-[9000] backdrop-blur-sm">
 <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
 <div className="flex justify-between items-center p-6 border-b border-slate-100">
 <h3 className="text-xl font-bold text-slate-800">Editar: {editingProduct.nombre}</h3>
 <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
 </div>
 <form onSubmit={handleUpdate} className="p-6 space-y-5">
 {/* Bloqueo Estricto de Stock */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1">
 Stock Físico (Bloqueado)
 </label>
 <div className="flex bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-500 cursor-not-allowed text-sm font-medium">
 Protegido por Gobernanza. Modificable vía Kardex.
 </div>
 </div>
 
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1">Precio de Venta (S/)</label>
 <input type="number" step="0.01" value={editForm.precio_venta} onChange={e => setEditForm({...editForm, precio_venta: parseFloat(e.target.value)})} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500" required />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1">Peso (kg)</label>
 <input type="number" step="0.001" value={editForm.peso_kg} onChange={e => setEditForm({...editForm, peso_kg: parseFloat(e.target.value)})} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500" />
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1">Volumen (m³)</label>
 <input type="number" step="0.0001" value={editForm.volumen_m3} onChange={e => setEditForm({...editForm, volumen_m3: parseFloat(e.target.value)})} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500" />
 </div>
 </div>

 <div className="pt-4 flex justify-end gap-3">
 <button type="button" onClick={() => setEditingProduct(null)} className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
 <button type="submit" disabled={updateMutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center shadow-sm">
 {updateMutation.isPending ? 'Guardando...' : 'Guardar y Auditar'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
}
