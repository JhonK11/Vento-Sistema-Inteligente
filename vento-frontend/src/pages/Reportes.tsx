import { useState } from 'react';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';
import { api } from '../lib/axios';
import { isAxiosError } from 'axios';
import { useUIStore } from '../store/uiStore';

export default function Reportes() {
  const { addToast } = useUIStore();
  const [loadingKardex, setLoadingKardex] = useState(false);
  const [loadingInventario, setLoadingInventario] = useState(false);

  const downloadReport = async (url: string, filename: string, setLoading: (l: boolean) => void) => {
    setLoading(true);
    try {
      const response = await api.get(url, { responseType: 'blob' });
      
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      addToast(`Reporte descargado: ${filename}`, 'success');
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 403) {
        addToast("No tienes permiso para descargar este reporte.", "error");
      } else {
        addToast("Error al generar el reporte.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Centro de Reportes</h2>
      </div>
      
      <p className="text-slate-600 mb-8 max-w-3xl">
        Genera y exporta reportes detallados del sistema. Estas herramientas están reservadas para la administración y gerencia.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Tarjeta Reporte Kardex Excel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 flex-1">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center mb-4 border border-emerald-100">
              <FileSpreadsheet className="text-emerald-600" size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Reporte de Kardex (Excel)</h3>
            <p className="text-slate-600 text-sm">
              Exporta todos los movimientos de inventario (ventas, compras, devoluciones y traslados) con su costo unitario y responsable en formato .xlsx.
            </p>
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <button 
              onClick={() => downloadReport('/reportes/kardex/excel', 'reporte_kardex.xlsx', setLoadingKardex)}
              disabled={loadingKardex}
              className="w-full flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={18} />
              {loadingKardex ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>

        {/* Tarjeta Reporte Inventario PDF */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 flex-1">
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mb-4 border border-red-100">
              <FileText className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Estado de Inventario (PDF)</h3>
            <p className="text-slate-600 text-sm">
              Genera un documento PDF formal con los niveles actuales de stock físico y disponible, costo promedio y clasificación ABC.
            </p>
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <button 
              onClick={() => downloadReport('/reportes/inventario/pdf', 'reporte_inventario.pdf', setLoadingInventario)}
              disabled={loadingInventario}
              className="w-full flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={18} />
              {loadingInventario ? 'Generando...' : 'Descargar PDF'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

