import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { api } from './lib/axios';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import ToastContainer from './components/ui/ToastContainer';
import ConfirmModal from './components/ui/ConfirmModal';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Kardex = lazy(() => import('./pages/Kardex'));
const ProductoDetalle = lazy(() => import('./pages/ProductoDetalle'));
const Importaciones = lazy(() => import('./pages/Importaciones'));
const Movimientos = lazy(() => import('./pages/Movimientos'));
const NuevaVenta = lazy(() => import('./pages/NuevaVenta'));
const Inventario = lazy(() => import('./pages/Inventario'));
const Proveedores = lazy(() => import('./pages/Proveedores'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Catalogo = lazy(() => import('./pages/Catalogo'));
const Predicciones = lazy(() => import('./pages/Predicciones'));
const Caja = lazy(() => import('./pages/Caja'));
const HistorialVentas = lazy(() => import('./pages/HistorialVentas'));

function App() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api.get('/auth/me', { signal: controller.signal }).then(({ data }) => {
      if (useAuthStore.getState().token === token) useAuthStore.getState().setAuth(data, token);
    }).catch(() => { /* El interceptor cierra sesiones rechazadas por el servidor. */ });
    return () => controller.abort();
  }, [token]);

  if (!user || !token) {
    return (
      <>
        <Login />
        <ToastContainer />
      </>
    );
  }

  // Rutas base dependiendo del rol
  const defaultPath = ({ ADMINISTRADOR: '/', GERENCIA: '/', VENTAS: '/caja', COMPRAS: '/importaciones', ALMACEN: '/inventario' } as Record<string, string>)[user.rol_nombre] || '/inventario';

  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout user={user}>
        <Suspense fallback={<div role="status" className="p-8 text-center text-slate-500">Cargando módulo…</div>}>
        <Routes>
          {/* Dashboard y Reportes: solo ADMIN y GERENCIA */}
          <Route path="/" element={defaultPath === '/' ? <Dashboard /> : <Navigate to={defaultPath} replace />} />
          <Route element={<ProtectedRoute allowedRoles={['ADMINISTRADOR', 'GERENCIA']} />}>
            <Route path="/reportes" element={<Reportes />} />
          </Route>
          
          <Route element={<ProtectedRoute allowedRoles={['ADMINISTRADOR']} />}>
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
          
          {/* Importaciones: ADMINISTRADOR y COMPRAS */}
          <Route element={<ProtectedRoute allowedRoles={['ADMINISTRADOR', 'COMPRAS']} />}>
            <Route path="/importaciones" element={<Importaciones />} />
            <Route path="/proveedores" element={<Proveedores />} />
          </Route>

          {/* Almacen, Kardex, Movimientos: ADMIN, ALMACEN, GERENCIA */}
          <Route element={<ProtectedRoute allowedRoles={['ADMINISTRADOR', 'ALMACEN', 'GERENCIA']} />}>
            <Route path="/kardex" element={<Kardex />} />
            <Route path="/kardex/:id" element={<ProductoDetalle />} />
            <Route path="/movimientos" element={<Movimientos />} />
          </Route>

          {/* Predicciones ARIMA & ROP */}
          <Route element={<ProtectedRoute allowedRoles={['ADMINISTRADOR', 'GERENCIA', 'ALMACEN', 'COMPRAS']} />}>
            <Route path="/predicciones" element={<Predicciones />} />
          </Route>

          {/* Inventario es mas publico, quiza todos menos cajero o todos */}
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/catalogo" element={<Catalogo />} />

          {/* Ventas: ADMIN, VENTAS */}
          <Route element={<ProtectedRoute allowedRoles={['ADMINISTRADOR', 'VENTAS', 'GERENCIA']} />}>
            <Route path="/caja" element={<Caja />} />
            <Route path="/ventas/historial" element={<HistorialVentas />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['ADMINISTRADOR', 'VENTAS']} />}>
            <Route path="/ventas/nueva" element={<NuevaVenta />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to={defaultPath} />} />
        </Routes>
        </Suspense>
      </MainLayout>
      <ToastContainer />
      <ConfirmModal />
    </QueryClientProvider>
  );
}

export default App;
