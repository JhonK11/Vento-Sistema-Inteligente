import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Search, Tag, Plus, X, Camera } from 'lucide-react';
import ProductImage from '../components/ui/ProductImage';
import ProductImageEditor from '../components/ui/ProductImageEditor';
import { api } from '../lib/axios';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';

interface Categoria {
  id_categoria: number;
  nombre: string;
}

interface Producto {
  id_producto: number;
  sku: string;
  nombre: string;
  precio_venta: number;
  categoria: string;
  estado: string;
  imagen_url: string | null;
}

export default function Catalogo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('cat') || 'Todos';
  const [searchTerm, setSearchTerm] = useState('');
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  const [productoFoto, setProductoFoto] = useState<Producto | null>(null);

  // Form states
  const [newCatName, setNewCatName] = useState('');
  const [newProd, setNewProd] = useState({
    sku: '', nombre: '', id_categoria: '', id_unidad: '', precio_venta: 0, peso_kg: 0, volumen_m3: 0
  });

  const queryClient = useQueryClient();
  const addToast = useUIStore(state => state.addToast);
  const user = useAuthStore(state => state.user);
  
  const canEdit = user?.rol_nombre === 'ADMINISTRADOR' || user?.rol_nombre === 'ALMACEN';

  const { data: categorias = [], isLoading: isLoadingCat } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: async () => {
      const res = await api.get('/categorias');
      return res.data;
    }
  });

  const { data: productos = [], isLoading: isLoadingProd } = useQuery<Producto[]>({
    queryKey: ['productos'],
    queryFn: async () => {
      const res = await api.get('/productos');
      return res.data;
    }
  });

  const { data: unidades = [] } = useQuery<{ id_unidad: number; nombre: string }[]>({
    queryKey: ['unidades-medida'],
    queryFn: async () => (await api.get('/unidades-medida')).data,
  });

  const createCatMutation = useMutation({
    mutationFn: async (nombre: string) => {
      return await api.post('/categorias', { nombre });
    },
    onSuccess: () => {
      addToast('CategorÃ­a creada exitosamente', 'success');
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setIsCatModalOpen(false);
      setNewCatName('');
    },
    onError: () => addToast('Error al crear categorÃ­a', 'error')
  });

  const createProdMutation = useMutation({
    mutationFn: async (data: typeof newProd) => {
      return await api.post('/productos', {
        ...data,
        id_categoria: Number(data.id_categoria),
        id_unidad: Number(data.id_unidad),
      });
    },
    onSuccess: () => {
      addToast('Producto creado exitosamente', 'success');
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      setIsProdModalOpen(false);
      setNewProd({ sku: '', nombre: '', id_categoria: '', id_unidad: '', precio_venta: 0, peso_kg: 0, volumen_m3: 0 });
    },
    onError: () => addToast('Error al crear producto', 'error')
  });

  const handleCreateCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    createCatMutation.mutate(newCatName);
  };

  const handleCreateProd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.sku.trim() || !newProd.nombre.trim() || !newProd.id_categoria || !newProd.id_unidad) return;
    createProdMutation.mutate(newProd);
  };

  const filteredProducts = productos.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'Todos' || p.categoria === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryTabs = ['Todos', ...categorias.map(c => c.nombre)];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShoppingBag className="text-blue-600" /> CatÃ¡logo de Productos
        </h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm text-slate-800"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {canEdit && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setIsCatModalOpen(true)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto"
              >
                <Plus size={16} /> CategorÃ­a
              </button>
              <button 
                onClick={() => setIsProdModalOpen(true)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors w-full sm:w-auto"
              >
                <Plus size={16} /> Producto
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoadingCat ? (
        <div className="animate-pulse flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-10 w-24 bg-slate-200 rounded-lg"></div>)}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categoryTabs.map(cat => (
            <button
              key={cat}
              onClick={() => setSearchParams({ cat })}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeCategory === cat 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat !== 'Todos' && <Tag size={14} className={activeCategory === cat ? "text-blue-200" : "text-slate-400"} />}
              {cat}
            </button>
          ))}
        </div>
      )}

      {isLoadingProd ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-pulse h-48"></div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-500">
          <ShoppingBag size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-600">No se encontraron productos en esta categorÃ­a</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredProducts.map(prod => (
            <div key={prod.id_producto} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
              <div className="h-32 bg-slate-50 border-b border-slate-100 flex items-center justify-center p-4 relative">
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600 uppercase tracking-wider">
                  {prod.categoria || 'Sin CategorÃ­a'}
                </span>
                <ProductImage src={prod.imagen_url} alt={prod.nombre} className="h-full w-full rounded-lg" />
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="text-xs text-slate-400 font-mono mb-1">{prod.sku}</div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight mb-2 line-clamp-2 flex-1" title={prod.nombre}>
                  {prod.nombre}
                </h3>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-lg font-black text-blue-700">S/ {Number(prod.precio_venta).toFixed(2)}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${prod.estado === 'ACTIVO' ? 'bg-emerald-500' : 'bg-red-500'}`} title={prod.estado}></span>
                </div>
                {canEdit && <button onClick={() => setProductoFoto(prod)} className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                  <Camera size={15} /> {prod.imagen_url ? 'Cambiar foto' : 'Añadir foto'}
                </button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {productoFoto && <ProductImageEditor producto={productoFoto} onClose={() => setProductoFoto(null)} />}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Nueva CategorÃ­a</h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCat} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la CategorÃ­a</label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-800"
                    placeholder="Ej. Juguetes, Herramientas..."
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCatModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={createCatMutation.isPending} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProdModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Nuevo Producto</h3>
              <button onClick={() => setIsProdModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateProd} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={newProd.sku}
                    onChange={(e) => setNewProd({...newProd, sku: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={newProd.nombre}
                    onChange={(e) => setNewProd({...newProd, nombre: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CategorÃ­a</label>
                  <select
                    required
                    value={newProd.id_categoria}
                    onChange={(e) => setNewProd({...newProd, id_categoria: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="">Selecciona una categoría</option>
                    {categorias.map(c => (
                      <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unidad de medida *</label>
                  <select required value={newProd.id_unidad}
                    onChange={(e) => setNewProd({ ...newProd, id_unidad: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white">
                    <option value="">Selecciona una unidad</option>
                    {unidades.map(unidad => <option key={unidad.id_unidad} value={unidad.id_unidad}>{unidad.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio de Venta</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProd.precio_venta}
                    onChange={(e) => setNewProd({...newProd, precio_venta: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsProdModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={createProdMutation.isPending} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

