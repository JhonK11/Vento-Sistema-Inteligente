import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { queryClient } from '../lib/queryClient';

export interface User {
  id_usuario: number;
  id_rol: number;
  rol_nombre: string;
  nombre: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        if (get().token !== token || get().user?.rol_nombre !== user.rol_nombre) queryClient.clear();
        set({ user, token });
      },
      logout: () => {
        queryClient.clear();
        set({ user: null, token: null });
      },
    }),
    {
      name: 'vento-auth',
    }
  )
);
