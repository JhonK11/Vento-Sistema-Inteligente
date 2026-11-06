import { useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { api } from '../lib/axios';
import { useUIStore } from '../store/uiStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ConfigItem {
  clave: string;
  valor: string;
  descripcion: string;
}

export default function Configuracion() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: configuraciones = [], isLoading } = useQuery<ConfigItem[]>({
    queryKey: ['configuracion'],
    queryFn: async () => {
      const res = await api.get('/configuracion');
      return res.data;
    }
  });


  const updateMutation = useMutation({
    mutationFn: async (payload: { clave: string, valor: string }) => {
      await api.put(`/configuracion/${payload.clave}`, { valor: payload.valor });
    }
  });

  const handleSave = async () => {
    try {
      for (const [clave, valor] of Object.entries(formData)) {
        const original = configuraciones.find(c => c.clave === clave);
        if (original && original.valor !== valor) {
          await updateMutation.mutateAsync({ clave, valor });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['configuracion'] });
      setFormData({});
      addToast("Configuración global actualizada correctamente.", "success");
    } catch {
      addToast("Error al guardar la configuración.", "error");
    }
  };

  const handleChange = (clave: string, valor: string) => {
    setFormData(prev => ({ ...prev, [clave]: valor }));
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Cargando configuración...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="text-blue-600" /> Configuración Global
        </h2>
        <button 
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
        >
          <Save size={18} /> {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <p className="text-slate-600 mb-6">
            Estas variables afectan el comportamiento general del sistema VENTO, incluyendo los cálculos de impuestos y la presentación de los reportes.
          </p>

          <div className="space-y-6">
            {configuraciones.map(item => (
              <div key={item.clave} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                <div className="md:col-span-1">
                  <h4 className="text-sm font-bold text-slate-800">{item.clave}</h4>
                  <p className="text-xs text-slate-500 mt-1">{item.descripcion}</p>
                </div>
                <div className="md:col-span-2">
                  <input 
                    type="text" 
                    value={formData[item.clave] ?? item.valor}
                    onChange={(e) => handleChange(item.clave, e.target.value)}
                    className="w-full max-w-md bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

