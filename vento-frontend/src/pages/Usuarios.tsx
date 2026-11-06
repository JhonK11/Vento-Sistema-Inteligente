import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Edit2, Trash2, Shield, X } from 'lucide-react';
import { api } from '../lib/axios';
import { apiError } from '../lib/apiError';
import { useUIStore } from '../store/uiStore';

interface Rol {
  id_rol: number;
  nombre: string;
}

interface Usuario {
  id_usuario: number;
  nombre_completo: string;
  email: string;
  id_rol: number;
  rol_nombre: string;
  estado: number;
}

export default function Usuarios() {
  const queryClient = useQueryClient();
  const { addToast, requestConfirm } = useUIStore();
  const [activeTab, setActiveTab] = useState('Todos');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    nombre_completo: '',
    email: '',
    password: '',
    id_rol: 0,
    estado: 1
  });

  const { data: usuarios = [], isLoading: isLoadingUsuarios } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const res = await api.get("/usuarios");
      return res.data;
    }
  });

  const { data: roles = [] } = useQuery<Rol[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get("/roles");
      return res.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingId) {
        // Edit requires dropping password if empty
        const payload = { ...data, password: data.password || undefined };
        await api.put(`/usuarios/${editingId}`, payload);
      } else {
        await api.post(`/usuarios`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      addToast(editingId ? "Usuario actualizado correctamente" : "Usuario creado correctamente", "success");
      closeModal();
    },
    onError: (err: unknown) => {
      addToast(apiError(err, "Error al guardar el usuario"), "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/usuarios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      addToast("Usuario desactivado correctamente", "success");
    }
  });

  const openModal = (user?: Usuario) => {
    if (user) {
      setEditingId(user.id_usuario);
      setFormData({
        nombre_completo: user.nombre_completo,
        email: user.email,
        password: '',
        id_rol: user.id_rol,
        estado: user.estado
      });
    } else {
      setEditingId(null);
      setFormData({
        nombre_completo: '',
        email: '',
        password: '',
        id_rol: roles.length > 0 ? roles[0].id_rol : 0,
        estado: 1
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId && !formData.password) {
      addToast("La contraseña es obligatoria para un nuevo usuario.", "error");
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleDelete = (id: number) => {
    requestConfirm(
      "Desactivar Usuario",
      "¿Estás seguro de desactivar a este usuario? Ya no podrá acceder al sistema.",
      () => deleteMutation.mutate(id)
    );
  };

  const filteredUsuarios = usuarios.filter(u => {
    if (activeTab === 'Activos') return u.estado === 1;
    if (activeTab === 'Inactivos') return u.estado === 0;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Gestión de Usuarios</h2>
        
        <div className="flex flex-col lg:flex-row gap-3 w-full sm:w-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
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
          
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors whitespace-nowrap justify-center"
          >
            <Plus size={18} /> Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoadingUsuarios ? (
          <div className="p-8 text-center text-slate-500">Cargando usuarios...</div>
        ) : filteredUsuarios.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500">
            <Users size={48} className="mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-600">No se encontraron usuarios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre y Correo</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredUsuarios.map((u) => (
                  <tr key={u.id_usuario} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-200">
                          <span className="text-blue-700 font-bold">{u.nombre_completo.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-800">{u.nombre_completo}</div>
                          <div className="text-sm text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                        <Shield size={12} /> {u.rol_nombre}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {u.estado === 1 ? (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold border bg-emerald-50 text-emerald-600 border-emerald-100">
                          ACTIVO
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold border bg-red-50 text-red-600 border-red-100">
                          INACTIVO
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2 items-center h-full pt-6">
                      <button onClick={() => openModal(u)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <Edit2 size={18} />
                      </button>
                      {u.estado === 1 && (
                        <button onClick={() => handleDelete(u.id_usuario)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Desactivar">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[9000] backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={formData.nombre_completo}
                  onChange={e => setFormData({...formData, nombre_completo: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500" 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Correo Electrónico (Login)</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Contraseña {editingId && <span className="text-slate-400 font-normal text-xs">(Opcional)</span>}
                  </label>
                  <input 
                    type="password" 
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500" 
                    placeholder={editingId ? 'Opcional' : 'Requerido'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Rol</label>
                  <select 
                    value={formData.id_rol}
                    onChange={e => setFormData({...formData, id_rol: parseInt(e.target.value)})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500" 
                    required
                  >
                    <option value={0} disabled>Seleccione...</option>
                    {roles.map(r => (
                      <option key={r.id_rol} value={r.id_rol}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editingId !== null && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
                  <select 
                    value={formData.estado}
                    onChange={e => setFormData({...formData, estado: parseInt(e.target.value)})}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500" 
                  >
                    <option value={1}>ACTIVO</option>
                    <option value={0}>INACTIVO</option>
                  </select>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center shadow-sm">
                  {saveMutation.isPending ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Crear Usuario')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

