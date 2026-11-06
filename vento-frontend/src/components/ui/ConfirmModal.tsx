import { useUIStore } from '../../store/uiStore';

export default function ConfirmModal() {
  const { confirmState, closeConfirm } = useUIStore();

  if (!confirmState) return null;

  const handleConfirm = () => {
    confirmState.onConfirm();
    closeConfirm();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-slate-100 transform transition-all scale-100">
        <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmState.title}</h3>
        <p className="text-slate-600 text-sm mb-6">{confirmState.message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={closeConfirm}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
