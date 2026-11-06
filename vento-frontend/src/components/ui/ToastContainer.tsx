import { useUIStore } from '../../store/uiStore';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => {
        let Icon = Info;
        let colorClasses = '';
        
        switch (toast.type) {
          case 'success':
            Icon = CheckCircle2;
            colorClasses = 'border-emerald-200 bg-white text-emerald-600 shadow-emerald-900/5';
            break;
          case 'error':
            Icon = XCircle;
            colorClasses = 'border-red-200 bg-white text-red-600 shadow-red-900/5';
            break;
          case 'warning':
            Icon = AlertTriangle;
            colorClasses = 'border-amber-200 bg-white text-amber-600 shadow-amber-900/5';
            break;
          case 'info':
            Icon = Info;
            colorClasses = 'border-blue-200 bg-white text-blue-600 shadow-blue-900/5';
            break;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-sm w-full transition-all duration-300 transform translate-y-0 opacity-100 ${colorClasses}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
