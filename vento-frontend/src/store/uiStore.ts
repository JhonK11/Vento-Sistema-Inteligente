import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmState {
  title: string;
  message: string;
  onConfirm: () => void;
}

interface UIStore {
  toasts: ToastMessage[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: number) => void;

  confirmState: ConfirmState | null;
  requestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  closeConfirm: () => void;
}

let nextId = 0;

export const useUIStore = create<UIStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  confirmState: null,
  requestConfirm: (title, message, onConfirm) => set({ confirmState: { title, message, onConfirm } }),
  closeConfirm: () => set({ confirmState: null })
}));
