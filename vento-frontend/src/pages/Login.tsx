import { useState } from "react";
import { api } from "../lib/axios";
import { apiError } from '../lib/apiError';
import { useAuthStore } from "../store/authStore";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, Loader2, ShieldCheck, Box, TrendingUp } from "lucide-react";

export default function Login() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });
      if (res.data.status === "success") {
        setAuth(res.data.user, res.data.access_token);
      } else {
        setError(res.data.message || "Error al iniciar sesión");
      }
    } catch (err: unknown) {
      setError(apiError(err, "Error de red. Asegúrate de que el servidor esté encendido."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Left Panel - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-blue-700 relative overflow-hidden flex-col justify-between p-12 text-white">
        {/* Background elements for visual flair */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-800 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-30 mix-blend-multiply"></div>
        
        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="flex items-center gap-3"
          >
            {/* Attempting to load physical logo, fallback to CSS Logo */}
            <div className="relative flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/20 shadow-lg">
                <img 
                src="vento-frontend/dist/images/logo.png" 
                alt="Vento Logo" 
                className="h-10 w-auto object-contain brightness-0 invert"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
                />
                <div className="hidden flex items-center gap-2">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md">
                        <span className="text-blue-700 font-black text-xl leading-none">V</span>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white">VENTO<span className="text-blue-300">.</span></h1>
                </div>
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 my-auto">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-5xl font-extrabold mb-6 leading-tight tracking-tight text-white"
          >
            Gestión logística <br/>
            <span className="text-blue-300">llevada al futuro.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-lg text-blue-100 max-w-md mb-10"
          >
            Plataforma centralizada para inventarios, punto de venta y analítica comercial con control total.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="space-y-5"
          >
            <div className="flex items-center gap-4 text-blue-50 bg-blue-800/30 p-3 rounded-xl backdrop-blur-sm border border-blue-600/30 max-w-sm">
              <div className="bg-blue-600/50 p-2 rounded-lg"><ShieldCheck size={20} /></div>
              <span className="font-medium text-sm">Seguridad de nivel corporativo</span>
            </div>
            <div className="flex items-center gap-4 text-blue-50 bg-blue-800/30 p-3 rounded-xl backdrop-blur-sm border border-blue-600/30 max-w-sm">
              <div className="bg-blue-600/50 p-2 rounded-lg"><Box size={20} /></div>
              <span className="font-medium text-sm">Control exacto de inventario local</span>
            </div>
            <div className="flex items-center gap-4 text-blue-50 bg-blue-800/30 p-3 rounded-xl backdrop-blur-sm border border-blue-600/30 max-w-sm">
              <div className="bg-blue-600/50 p-2 rounded-lg"><TrendingUp size={20} /></div>
              <span className="font-medium text-sm">Integridad financiera automatizada</span>
            </div>
          </motion.div>
        </div>
        
        <div className="relative z-10 text-blue-200/60 text-sm font-medium">
          &copy; {new Date().getFullYear()} Vento Systems. Todos los derechos reservados.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Logo fallback for mobile */}
            <div className="lg:hidden flex items-center gap-3 mb-10">
               <img 
                src="/images/logo.png" 
                alt="Vento Logo" 
                className="h-12 w-auto object-contain"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
               />
               <div className="hidden flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                        <span className="text-white font-black text-2xl leading-none">V</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800">VENTO<span className="text-blue-600">.</span></h1>
               </div>
            </div>

            <div className="mb-10">
              <h2 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">Bienvenido de nuevo</h2>
              <p className="text-slate-500 font-medium">Ingresa tus credenciales para acceder a tu panel.</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm font-semibold flex items-center gap-3 shadow-sm"
              >
                <div className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 sm:text-sm text-slate-800 transition-all font-medium"
                    placeholder="admin@vento.pe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">
                    Contraseña
                  </label>
                  <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 sm:text-sm text-slate-800 transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    Ingresar al Sistema
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-200/70">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Credenciales de Acceso Rápido</p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-slate-700 font-semibold">Admin</span>
                    </div>
                    <span className="font-mono text-slate-500 font-medium">ana.torres@vento.pe <span className="text-slate-400">(123456)</span></span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-slate-700 font-semibold">Cajero</span>
                    </div>
                    <span className="font-mono text-slate-500 font-medium">jorge.ramos@vento.pe <span className="text-slate-400">(123456)</span></span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
