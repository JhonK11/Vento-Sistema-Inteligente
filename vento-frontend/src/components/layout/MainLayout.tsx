import type { ReactNode } from 'react';
import { LayoutDashboard, Package, ArrowLeftRight, ShoppingCart, LogOut, ClipboardList, Truck, FileText, Users, Settings, Tag, ChevronDown, ChevronRight, Monitor, Home, Scissors, Box, BrainCircuit } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { RequireRole } from '../auth/RequireRole';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import type { User } from '../../store/authStore';
import { Banknote, FileSearch } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
  user: User;
}

export default function MainLayout({ children, user }: MainLayoutProps) {
  const logout = useAuthStore(state => state.logout);
  const location = useLocation();
  
  const [isCatalogOpen, setIsCatalogOpen] = useState(true);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
    }`;

  const isCajero = user?.rol_nombre === 'VENTAS';
  const initial = user?.nombre ? user.nombre.charAt(0).toUpperCase() : 'U';
  const roleName = user?.rol_nombre || 'Usuario';

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const res = await api.get('/categorias');
      return res.data;
    }
  });

  const { data: tipoCambio } = useQuery({
    queryKey: ['tipo-cambio-navbar'],
    queryFn: async () => {
      const res = await api.get('/consultas/tipo-cambio');
      return res.data;
    },
    staleTime: 1000 * 60 * 30
  });

  const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('tecno')) return <Monitor size={16} />;
    if (n.includes('hogar')) return <Home size={16} />;
    if (n.includes('belleza')) return <Scissors size={16} />;
    return <Box size={16} />;
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 transition-colors duration-200">
      {/* Sidebar Minimalista Corporativo */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img 
              src="/images/logo.png" 
              alt="Vento Logo" 
              className="h-10 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="flex flex-col">
              <div className="hidden flex items-center gap-1.5" id="logo-fallback">
                <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
                  <span className="text-white font-black text-lg leading-none">V</span>
                </div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
                  VENTO<span className="text-blue-600">.</span>
                </h1>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                Inventario & Logística
              </span>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          <RequireRole roles={['ADMINISTRADOR', 'GERENCIA']}>
            <NavLink to="/" className={navLinkClass}>
              <LayoutDashboard size={20} /> Dashboard
            </NavLink>
            <NavLink to="/reportes" className={navLinkClass}>
              <FileText size={20} /> Reportes
            </NavLink>
          </RequireRole>

          <RequireRole roles={['ADMINISTRADOR', 'GERENCIA', 'ALMACEN', 'COMPRAS']}>
            <NavLink to="/predicciones" className={navLinkClass}>
              <BrainCircuit size={20} className="text-amber-500" /> Pronóstico ARIMA
            </NavLink>
          </RequireRole>

          <RequireRole roles={['ADMINISTRADOR']}>
            <NavLink to="/usuarios" className={navLinkClass}>
              <Users size={20} /> Usuarios
            </NavLink>
            <NavLink to="/configuracion" className={navLinkClass}>
              <Settings size={20} /> Configuración
            </NavLink>
          </RequireRole>
          
          <RequireRole roles={['ADMINISTRADOR', 'ALMACEN', 'GERENCIA']}>
            <NavLink to="/kardex" className={navLinkClass}>
              <Package size={20} /> Kardex
            </NavLink>
          </RequireRole>

          <RequireRole roles={['ADMINISTRADOR', 'COMPRAS']}>
            <NavLink to="/proveedores" className={navLinkClass}>
              <Truck size={20} /> Proveedores
            </NavLink>
            <NavLink to="/importaciones" className={navLinkClass}>
              <ShoppingCart size={20} /> Importaciones
            </NavLink>
          </RequireRole>

          <RequireRole roles={['ADMINISTRADOR', 'ALMACEN', 'GERENCIA']}>
            <NavLink to="/movimientos" className={navLinkClass}>
              <ArrowLeftRight size={20} /> Movimientos
            </NavLink>
          </RequireRole>

          <div className="pt-4 pb-1">
            <span className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Productos</span>
          </div>

          <NavLink to="/inventario" className={navLinkClass}>
            <ClipboardList size={20} /> Stock Disponible
          </NavLink>
          
          <div>
            <button 
              onClick={() => setIsCatalogOpen(!isCatalogOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Tag size={20} />
                <span>Catálogo Visual</span>
              </div>
              {isCatalogOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            
            <AnimatePresence>
              {isCatalogOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden ml-4 pl-4 border-l border-slate-200 mt-1 space-y-1"
                >
                  <NavLink 
                    to="/catalogo" 
                    end
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive && (!location.search || location.search === '?cat=Todos') ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                  >
                    <Box size={16} /> Todos
                  </NavLink>
                  {categorias.map((cat: { id_categoria: number; nombre: string }) => (
                    <NavLink 
                      key={cat.id_categoria}
                      to={`/catalogo?cat=${encodeURIComponent(cat.nombre)}`}
                      className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive && location.search.includes(encodeURIComponent(cat.nombre)) ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      {getCategoryIcon(cat.nombre)} {cat.nombre}
                    </NavLink>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <RequireRole roles={['ADMINISTRADOR', 'VENTAS', 'GERENCIA']}>
            <div className="pt-4 pb-1">
              <span className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Ventas</span>
            </div>
            <NavLink to="/caja" className={navLinkClass}><Banknote size={20} /> Caja y arqueo</NavLink>
            <NavLink to="/ventas/historial" className={navLinkClass}><FileSearch size={20} /> Historial de ventas</NavLink>
          </RequireRole>
          <RequireRole roles={['ADMINISTRADOR', 'VENTAS']}>
            <NavLink to="/ventas/nueva" className={navLinkClass}>
              <ShoppingCart size={20} /> Nueva Venta
            </NavLink>
          </RequireRole>
        </nav>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar Superior Corporativo */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center px-8 justify-between shadow-sm z-10">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-bold text-slate-800">
              {isCajero ? 'Punto de Venta' : 'Sistema Integrado de Gestión'}
            </h2>
            {tipoCambio && (
              <div 
                className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 shadow-2xs"
                title={`Fuente: ${tipoCambio.fuente} (${tipoCambio.fecha})`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-slate-700">DÓLAR SUNAT:</span>
                </div>
                <span className="font-mono text-slate-600">Compra: <strong className="text-slate-800">S/ {tipoCambio.compra.toFixed(3)}</strong></span>
                <span className="text-slate-300">|</span>
                <span className="font-mono text-slate-600">Venta: <strong className="text-slate-800">S/ {tipoCambio.venta.toFixed(3)}</strong></span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
              <div className="text-right flex flex-col justify-center">
                <span className="text-sm font-bold text-slate-800 leading-tight">{user?.nombre || 'Usuario'}</span>
                <span className="text-xs font-medium text-slate-500 leading-tight">{roleName}</span>
              </div>
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm border-2 border-blue-100">
                {initial}
              </div>
              <button 
                onClick={logout}
                className="p-2 ml-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>
        
        {/* Contenido Dinámico con AnimatePresence */}
        <main className="flex-1 overflow-y-auto p-8 relative bg-slate-50">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname + location.search}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

