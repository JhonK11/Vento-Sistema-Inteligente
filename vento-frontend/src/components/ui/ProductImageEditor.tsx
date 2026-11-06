import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2, Upload, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { apiError } from '../../lib/apiError';
import { useUIStore } from '../../store/uiStore';
import ProductImage from './ProductImage';

export default function ProductImageEditor({ producto, onClose }: {
  producto: { id_producto: number; nombre: string; imagen_url?: string | null };
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const bloqueo = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { addToast, requestConfirm } = useUIStore();

  const guardar = async (archivo: File) => {
    if (bloqueo.current) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      addToast('Selecciona una imagen JPG, PNG o WebP.', 'warning');
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      addToast('La imagen no debe superar 5 MB.', 'warning');
      return;
    }
    bloqueo.current = true;
    setBusy(true);
    try {
      await api.put(`/productos/${producto.id_producto}/imagen`, archivo, { headers: { 'Content-Type': archivo.type } });
      await queryClient.invalidateQueries({ queryKey: ['productos'] });
      addToast('Foto del producto guardada.', 'success');
      onClose();
    } catch (error) {
      addToast(apiError(error, 'No se pudo guardar la foto.'), 'error');
    } finally {
      bloqueo.current = false;
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const eliminar = async () => {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setBusy(true);
    try {
      await api.delete(`/productos/${producto.id_producto}/imagen`);
      await queryClient.invalidateQueries({ queryKey: ['productos'] });
      addToast('Foto eliminada.', 'success');
      onClose();
    } catch (error) {
      addToast(apiError(error, 'No se pudo eliminar la foto.'), 'error');
    } finally {
      bloqueo.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="foto-title" className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 id="foto-title" className="flex items-center gap-2 font-bold text-slate-800"><Camera size={20} /> Foto del producto</h3>
          <button aria-label="Cerrar" disabled={busy} onClick={onClose} className="rounded p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={20} /></button>
        </div>
        <div className="space-y-4 p-5">
          <p className="font-semibold text-slate-800">{producto.nombre}</p>
          <ProductImage src={producto.imagen_url} alt={producto.nombre} className="h-56 w-full rounded-xl border border-slate-100" />
          <p className="text-sm text-slate-500">JPG, PNG o WebP · Máximo 5 MB y 16 megapíxeles. La foto se optimiza automáticamente.</p>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            aria-label="Seleccionar foto del producto" disabled={busy}
            onChange={event => { const archivo = event.target.files?.[0]; if (archivo) void guardar(archivo); }} />
          <button disabled={busy} onClick={() => input.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {busy ? 'Procesando imagen…' : producto.imagen_url ? 'Reemplazar foto' : 'Seleccionar y subir foto'}
          </button>
          {producto.imagen_url && <button disabled={busy} onClick={() => requestConfirm('Quitar foto', `¿Quieres quitar la foto de ${producto.nombre}?`, () => void eliminar())}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"><Trash2 size={16} /> Quitar foto</button>}
        </div>
      </section>
    </div>
  );
}
