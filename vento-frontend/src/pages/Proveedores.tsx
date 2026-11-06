import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Truck, Search, Plus, Trash2, Edit2, X, Building2, 
  CheckCircle, Loader2, Globe, Phone, Mail, MapPin 
} from 'lucide-react';
import { api } from '../lib/axios';
import { apiError } from '../lib/apiError';
import { useUIStore } from '../store/uiStore';

interface Proveedor {
  id_proveedor: number;
  razon_social: string;
  pais: string;
  contacto_nombre?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  tiempo_entrega_dias_prom: number;
  moneda_preferida: string;
  condiciones_pago?: string;
  estado: number;
}

interface FormState {
  razon_social: string;
  pais: string;
  contacto_nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  moneda_preferida: string;
  tiempo_entrega_dias_prom: number;
  condiciones_pago: string;
}

const initialForm: FormState = {
  razon_social: '',
  pais: 'Perú',
  contacto_nombre: '',
  telefono: '',
  email: '',
  direccion: '',
  moneda_preferida: 'PEN',
  tiempo_entrega_dias_prom: 15,
  condiciones_pago: 'Contado'
};

export default function Proveedores() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');
  const { addToast, requestConfirm } = useUIStore();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormState>(initialForm);

  // SUNAT query state
  const [rucQuery, setRucQuery] = useState('');
  const [isSearchingSunat, setIsSearchingSunat] = useState(false);
  const [sunatStatus, setSunatStatus] = useState<{ estado: string; condicion: string } | null>(null);

  const { data: proveedores = [], isLoading } = useQuery<Proveedor[]>({
    queryKey: ['proveedores'],
    queryFn: async () => {
      const res = await api.get("/proveedores");
      return res.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      if (modalMode === 'edit' && currentId) {
        await api.put(`/proveedores/${currentId}`, data);
      } else {
        await api.post('/proveedores', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      addToast(
        modalMode === 'edit' ? "Proveedor actualizado con éxito." : "Proveedor registrado con éxito.", 
        "success"
      );
      closeModal();
    },
    onError: (err: unknown) => {
      addToast(apiError(err, "Error al procesar el proveedor."), "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/proveedores/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      addToast("Proveedor eliminado lógicamente.", "success");
    },
    onError: () => {
      addToast("Error al eliminar el proveedor.", "error");
    }
  });

  const handleOpenCreate = () => {
    setFormData(initialForm);
    setRucQuery('');
    setSunatStatus(null);
    setModalMode('create');
    setCurrentId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Proveedor) => {
    setFormData({
      razon_social: p.razon_social || '',
      pais: p.pais || 'Perú',
      contacto_nombre: p.contacto_nombre || '',
      telefono: p.telefono || '',
      email: p.email || '',
      direccion: p.direccion || '',
      moneda_preferida: p.moneda_preferida || 'PEN',
      tiempo_entrega_dias_prom: p.tiempo_entrega_dias_prom || 15,
      condiciones_pago: p.condiciones_pago || 'Contado'
    });
    setSunatStatus(null);
    setModalMode('edit');
    setCurrentId(p.id_proveedor);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData(initialForm);
    setRucQuery('');
    setSunatStatus(null);
  };

  const handleDelete = (id: number) => {
    requestConfirm(
      "Eliminar Proveedor",
      "¿Está seguro de eliminar lógicamente este proveedor?",
      () => deleteMutation.mutate(id)
    );
  };

  const handleConsultarSunat = async () => {
    const cleanRuc = rucQuery.trim();
    if (cleanRuc.length !== 11) {
      addToast("El RUC debe tener exactamente 11 dígitos.", "error");
      return;
    }

    try {
      setIsSearchingSunat(true);
      const res = await api.get(`/consultas/ruc/${cleanRuc}`);
      const data = res.data;

      setFormData(prev => ({
        ...prev,
        razon_social: data.razon_social || prev.razon_social,
        pais: 'Perú',
        direccion: data.direccion || prev.direccion
      }));

      setSunatStatus({
        estado: data.estado || 'ACTIVO',
        condicion: data.condicion || 'HABIDO'
      });

      addToast("Datos de SUNAT obtenidos correctamente.", "success");
    } catch (err: unknown) {
      addToast(
        apiError(err, "No se pudo consultar el RUC en SUNAT. Ingrese los datos manualmente."),
        "error"
      );
    } finally {
      setIsSearchingSunat(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.razon_social.trim()) {
      addToast("La Razón Social es obligatoria.", "error");
      return;
    }
    if (!formData.pais.trim()) {
      addToast("El país es obligatorio.", "error");
      return;
    }
    saveMutation.mutate(formData);
  };

  const filtered = proveedores.filter(p => {
    const matchesSearch = 
      p.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.pais.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.contacto_nombre && p.contacto_nombre.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (activeTab === 'Activos') return p.estado === 1;
    if (activeTab === 'Inactivos') return p.estado === 0;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Directorio de Proveedores</h2>
          <p className="text-sm text-slate-500">Gestión de proveedores locales e internacionales con validación SUNAT</p>
        </div>
        
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
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm text-slate-800"
              placeholder="Buscar por Razón Social o País..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus size={18} /> Nuevo Proveedor
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Cargando proveedores...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500">
            <Truck size={48} className="mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-600">No se encontraron proveedores</p>
            <p className="text-sm">Intenta con otro término o registra uno nuevo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Razón Social</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">País / Origen</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Lead Time</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Moneda</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filtered.map((prov) => (
                  <tr key={prov.id_proveedor} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-700">{prov.razon_social}</div>
                      {prov.direccion && (
                        <div className="text-xs text-slate-400 truncate max-w-xs flex items-center gap-1 mt-0.5">
                          <MapPin size={12} /> {prov.direccion}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        prov.pais.toLowerCase().includes('per')
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        <Globe size={12} />
                        {prov.pais}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <div>{prov.contacto_nombre || '-'}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        {prov.telefono && <span className="flex items-center gap-1"><Phone size={10} /> {prov.telefono}</span>}
                        {prov.email && <span className="flex items-center gap-1"><Mail size={10} /> {prov.email}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
                        {prov.tiempo_entrega_dias_prom} días
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold">
                      <span className={`px-2 py-0.5 rounded text-xs ${prov.moneda_preferida === 'USD' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                        {prov.moneda_preferida}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold border ${prov.estado === 1 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {prov.estado === 1 ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => handleOpenEdit(prov)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(prov.id_proveedor)} 
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                          title="Baja lógica"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nuevo / Editar Proveedor */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {modalMode === 'create' ? 'Registrar Nuevo Proveedor' : 'Editar Proveedor'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {modalMode === 'create' 
                      ? 'Puedes consultar con RUC en SUNAT o ingresar los datos manualmente' 
                      : 'Modifica los datos del proveedor seleccionado'}
                  </p>
                </div>
              </div>
              <button 
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Panel de Consulta Rápida SUNAT (Disponible en creación) */}
            {modalMode === 'create' && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                    <Building2 size={14} className="text-blue-600" /> Consulta Oficial SUNAT Perú
                  </span>
                  <span className="text-[11px] text-blue-600 font-medium">Autocompletado instantáneo</span>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={11}
                    value={rucQuery}
                    onChange={(e) => setRucQuery(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConsultarSunat(); } }}
                    placeholder="Ingresa RUC de 11 dígitos (Ej: 20601234567)"
                    className="flex-1 px-3 py-2 text-sm bg-white border border-blue-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleConsultarSunat}
                    disabled={isSearchingSunat}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isSearchingSunat ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Buscando...
                      </>
                    ) : (
                      <>
                        <Search size={14} /> Validar SUNAT
                      </>
                    )}
                  </button>
                </div>

                {sunatStatus && (
                  <div className="flex items-center gap-2 pt-1 text-xs text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                    <span>
                      Validado SUNAT: <strong>{sunatStatus.estado}</strong> • Condición: <strong>{sunatStatus.condicion}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Razón Social *</label>
                  <input
                    type="text"
                    required
                    value={formData.razon_social}
                    onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                    placeholder="Ej: Distribuidora Motriz S.A.C."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">País de Origen *</label>
                  <input
                    type="text"
                    required
                    value={formData.pais}
                    onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                    placeholder="Ej: Perú, China, EE.UU."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Dirección Fiscal / Ubicación</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Av. Principal #123, Lima, Perú"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Contacto (Nombre)</label>
                  <input
                    type="text"
                    value={formData.contacto_nombre}
                    onChange={(e) => setFormData({ ...formData, contacto_nombre: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Ej: +51 987654321"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ventas@proveedor.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Moneda Preferida</label>
                  <select
                    value={formData.moneda_preferida}
                    onChange={(e) => setFormData({ ...formData, moneda_preferida: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="PEN">PEN - Soles Peruanos</option>
                    <option value="USD">USD - Dólares Americanos</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Lead Time (Días Entrega) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.tiempo_entrega_dias_prom}
                    onChange={(e) => setFormData({ ...formData, tiempo_entrega_dias_prom: parseInt(e.target.value) || 0 })}
                    placeholder="15"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Condiciones de Pago</label>
                  <input
                    type="text"
                    value={formData.condiciones_pago}
                    onChange={(e) => setFormData({ ...formData, condiciones_pago: e.target.value })}
                    placeholder="Ej: Contado, Crédito 30 días"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saveMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  {modalMode === 'create' ? 'Guardar Proveedor' : 'Actualizar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
