import { useState } from "react";
import { Printer, CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { api } from "../../lib/axios";
import { useUIStore } from '../../store/uiStore';
import { apiError } from '../../lib/apiError';

interface CartItem {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export interface SaleData {
  id_venta?: number;
  numero_venta: string;
  fecha: string;
  cajero: string;
  cliente: string;
  metodo_pago: string;
  items: CartItem[];
  total: number;
  monto_pagado?: number;
  vuelto?: number;
  id_turno?: number | null;
  estado?: string;
}

interface VoucherTicketProps {
  saleData: SaleData;
  onNewSale: () => void;
  actionLabel?: string;
}

export default function VoucherTicket({ saleData, onNewSale, actionLabel = 'Nueva Venta' }: VoucherTicketProps) {
  const [downloading, setDownloading] = useState(false);
  const addToast = useUIStore(state => state.addToast);

  const printVoucher = () => {
    window.print();
  };

  const downloadPDF = async () => {
    if (!saleData.id_venta) {
      printVoucher();
      return;
    }
    setDownloading(true);
    try {
      const res = await api.get(`/ventas/${saleData.id_venta}/ticket-pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ticket_${saleData.numero_venta}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      addToast(apiError(err, 'No se pudo descargar el ticket. Puedes usar la impresión rápida.'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-8 bg-slate-50 min-h-full">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-[400px] text-black printable-voucher border border-slate-200">
        <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
          <h2 className="text-2xl font-black tracking-tight text-blue-700">VENTO S.A.C.</h2>
          <p className="text-xs text-gray-500">Jr. Comercio 450, Puno, Perú</p>
          <p className="text-xs text-gray-500">RUC: 20608974512</p>
          <div className="mt-4">
            <h3 className="font-bold text-base bg-slate-100 py-1 rounded-md">TICKET DE VENTA</h3>
            {saleData.estado === 'ANULADA' && <p className="mt-2 font-bold text-red-600">VENTA ANULADA</p>}
            <p className="font-mono text-sm font-bold text-slate-700 mt-1">{saleData.numero_venta}</p>
          </div>
        </div>

        <div className="text-xs mb-4 space-y-1 text-slate-600">
          <p><strong>Fecha:</strong> {saleData.fecha}</p>
          <p><strong>Cajero:</strong> {saleData.cajero}</p>
          <p><strong>Cliente:</strong> {saleData.cliente}</p>
          <p><strong>Método Pago:</strong> {saleData.metodo_pago}</p>
          {saleData.id_turno && <p><strong>Turno de caja:</strong> #{saleData.id_turno}</p>}
        </div>

        <table className="w-full text-xs mb-4">
          <thead className="border-y border-dashed border-gray-300 text-slate-600">
            <tr>
              <th className="py-2 text-left">Cant</th>
              <th className="py-2 text-left">Descripción</th>
              <th className="py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {saleData.items.map((item, i) => (
              <tr key={i}>
                <td className="py-2 text-left font-bold">{item.cantidad}</td>
                <td className="py-2 text-left pr-2 font-medium">{item.nombre}</td>
                <td className="py-2 text-right font-mono font-bold">S/ {(item.cantidad * item.precio_unitario).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between items-center text-lg font-black border-t-2 border-dashed border-gray-300 pt-4 mb-6">
          <span>TOTAL:</span>
          <span className="text-blue-700">S/ {saleData.total.toFixed(2)}</span>
        </div>

        {saleData.monto_pagado !== undefined && <div className="mb-5 space-y-1 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-600">
          <div className="flex justify-between"><span>Efectivo recibido</span><strong>S/ {saleData.monto_pagado.toFixed(2)}</strong></div>
          <div className="flex justify-between"><span>Vuelto</span><strong>S/ {(saleData.vuelto || 0).toFixed(2)}</strong></div>
        </div>}

        <div className="text-center text-xs text-gray-400 pb-2">
          <p className="font-semibold text-gray-600">¡Gracias por su compra en VENTO!</p>
          <p className="text-[10px] mt-0.5">Conserve este ticket para cualquier cambio o garantía</p>
        </div>
      </div>
      
      {/* Estilos para impresión nativa */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-voucher, .printable-voucher * { visibility: visible; }
          .printable-voucher { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; }
          .no-print { display: none; }
        }
      `}</style>
      
      <div className="mt-8 flex flex-wrap justify-center gap-3 no-print">
        <button 
          onClick={downloadPDF} 
          disabled={downloading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all disabled:opacity-50"
        >
          {downloading ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
          Descargar Ticket PDF
        </button>
        <button 
          onClick={printVoucher} 
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-5 rounded-xl shadow-sm transition-colors"
        >
          <Printer size={18} /> Imprimir Rápido
        </button>
        <button 
          onClick={onNewSale} 
          className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 px-5 rounded-xl shadow-sm transition-colors"
        >
          <CheckCircle2 size={18} /> {actionLabel}
        </button>
      </div>
    </div>
  );
}
