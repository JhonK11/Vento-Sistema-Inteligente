import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import type { PropuestaCompra } from '../types/abastecimiento';
import { apiError } from '../lib/apiError';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

interface Proveedor {
  id_proveedor: number;
  razon_social: string;
  tiempo_entrega_dias_prom: number;
  moneda_preferida: string;
}

interface Almacen {
  id_almacen: number;
  nombre: string;
}

interface Producto {
  id_producto: number;
  sku: string;
  nombre: string;
  peso_kg: number;
  volumen_m3: number;
}

interface CompraItem {
  producto: Producto | null;
  cantidad: number;
  costo_unitario: number;
}

export default function Importaciones() {
  const user = useAuthStore(state => state.user);
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();
  const location = useLocation();
  const sugerencia = (location.state as { sugerencia?: PropuestaCompra } | null)?.sugerencia;
  
  const [proveedorId, setProveedorId] = useState<number | ''>(() => sugerencia?.id_proveedor || '');
  const [almacenId, setAlmacenId] = useState<number | ''>('');
  const [numeroCompra, setNumeroCompra] = useState('');
  const [moneda, setMoneda] = useState('PEN');
  const [tipoCambio, setTipoCambio] = useState<number>(1);
  const [items, setItems] = useState<CompraItem[]>(() => sugerencia ? [{
    producto: { id_producto: sugerencia.id_producto, sku: sugerencia.sku, nombre: sugerencia.nombre,
      peso_kg: sugerencia.peso_kg || 0, volumen_m3: sugerencia.volumen_m3 || 0 },
    cantidad: sugerencia.cantidad, costo_unitario: sugerencia.costo_unitario ?? 0,
  }] : []);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: proveedores = [] } = useQuery<Proveedor[]>({
    queryKey: ['proveedores'],
    queryFn: async () => (await api.get("/proveedores")).data
  });

  const { data: almacenes = [] } = useQuery<Almacen[]>({
    queryKey: ['almacenes'],
    queryFn: async () => (await api.get("/almacenes")).data
  });

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ['productos'],
    queryFn: async () => (await api.get("/productos")).data
  });

  const { data: tipoCambioSunat } = useQuery({
    queryKey: ['tipo-cambio-sunat'],
    queryFn: async () => (await api.get("/consultas/tipo-cambio")).data,
    staleTime: 1000 * 60 * 30
  });

  const handleMonedaChange = (newMoneda: string) => {
    setMoneda(newMoneda);
    if (newMoneda === 'USD') {
      if (tipoCambioSunat?.venta) {
        setTipoCambio(tipoCambioSunat.venta);
        addToast(`Dólar SUNAT aplicado: S/ ${tipoCambioSunat.venta.toFixed(3)}`, 'info');
      } else {
        setTipoCambio(3.75);
      }
    } else {
      setTipoCambio(1);
    }
  };

  const selectedProveedor = proveedores.find(p => p.id_proveedor === Number(proveedorId));

  const addProducto = (prod: Producto) => {
    if (items.find(i => i.producto?.id_producto === prod.id_producto)) return;
    setItems([...items, { producto: prod, cantidad: 1, costo_unitario: 0 }]);
    setSearchTerm('');
  };

  const updateItem = (index: number, field: keyof CompraItem, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const filteredProductos = productos.filter(p => 
    searchTerm && (p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  ).slice(0, 5);

  const totales = useMemo(() => {
    return items.reduce((acc, item) => {
      acc.subtotal += item.cantidad * item.costo_unitario;
      acc.peso += item.cantidad * (item.producto?.peso_kg || 0);
      acc.volumen += item.cantidad * (item.producto?.volumen_m3 || 0);
      return acc;
    }, { subtotal: 0, peso: 0, volumen: 0 });
  }, [items]);

  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!proveedorId || !almacenId || !numeroCompra || items.length === 0) {
        throw new Error("Complete los campos requeridos y agregue al menos un producto.");
      }
      
      const idUsuarioSeguro = Number(user?.id_usuario || 1);
      
      const payload = {
        id_proveedor: Number(proveedorId),
        numero_compra: numeroCompra,
        id_almacen_destino: Number(almacenId),
        id_usuario: idUsuarioSeguro,
        moneda,
        tipo_cambio: tipoCambio,
        descuento: 0,
        impuesto: 0,
        detalle: items.map(i => ({
          id_producto: i.producto!.id_producto,
          cantidad: i.cantidad,
          costo_unitario: i.costo_unitario
        }))
      };
      await api.post("/compras", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      addToast("Orden de Compra registrada exitosamente.", "success");
      setItems([]);
      setNumeroCompra('');
    },
    onError: (err: unknown) => {
      const serverMsg = apiError(err);
      addToast(`Error al registrar orden: ${serverMsg}`, "error");
    }
  });

  // Autocompletar moneda al elegir proveedor
  const handleProveedorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setProveedorId(val ? Number(val) : '');
    const prov = proveedores.find(p => p.id_proveedor === Number(val));
    if (prov) {
      handleMonedaChange(prov.moneda_preferida);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Orden de Compra / Importación</h2>
      </div>

      {sugerencia && (
        <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">Propuesta de abastecimiento: {sugerencia.nombre}</p>
          <p className="mt-1">Producto, cantidad y proveedor precargados. Revisa costo, moneda y almacén antes de registrar la compra.</p>
          {sugerencia.costo_unitario === null && <p className="mt-1 font-bold">Costo pendiente de confirmar con el proveedor.</p>}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Cabecera de la Orden</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Proveedor</label>
            <div className="flex gap-2 items-center">
              <select 
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                value={proveedorId} onChange={handleProveedorChange}
              >
                <option value="">Seleccione un Proveedor...</option>
                {proveedores.map(p => <option key={p.id_proveedor} value={p.id_proveedor}>{p.razon_social}</option>)}
              </select>
              {selectedProveedor && (
                <span className="inline-flex whitespace-nowrap px-3 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-md text-xs font-bold" title="Lead Time (Tiempo de Entrega Promedio)">
                  {selectedProveedor.tiempo_entrega_dias_prom} DÍAS (LT)
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Almacén de Destino</label>
            <select 
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
              value={almacenId} onChange={e => setAlmacenId(Number(e.target.value))}
            >
              <option value="">Seleccione Almacén...</option>
              {almacenes.map(a => <option key={a.id_almacen} value={a.id_almacen}>{a.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nº Comprobante / PO</label>
            <input 
              type="text" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 uppercase"
              placeholder="PO-2026-001" value={numeroCompra} onChange={e => setNumeroCompra(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Moneda Pactada</label>
            <select 
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 font-medium"
              value={moneda} onChange={e => handleMonedaChange(e.target.value)}
            >
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-semibold text-slate-700">Tipo de Cambio</label>
              {moneda === 'USD' && tipoCambioSunat && (
                <button
                  type="button"
                  onClick={() => {
                    setTipoCambio(tipoCambioSunat.venta);
                    addToast(`Sincronizado con SUNAT: S/ ${tipoCambioSunat.venta.toFixed(3)}`, 'success');
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
                  title="Recargar Dólar SUNAT"
                >
                  SUNAT: S/ {tipoCambioSunat.venta.toFixed(3)}
                </button>
              )}
            </div>
            <input 
              type="number" step="0.001" className={`w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono font-bold focus:ring-2 focus:ring-blue-500 ${moneda === 'PEN' ? 'bg-slate-50 text-slate-400' : ''}`}
              value={tipoCambio} onChange={e => setTipoCambio(parseFloat(e.target.value) || 1)} disabled={moneda === 'PEN'}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col lg:flex-row">
        {/* Sidebar Buscador Productos */}
        <div className="w-full lg:w-1/3 border-r border-slate-200 p-6 bg-[#F8FAFC]">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Agregar Ítems</h3>
          <input
            type="text"
            placeholder="Buscar por SKU o Nombre..."
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 mb-4"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="space-y-2">
            {filteredProductos.map(p => (
              <div key={p.id_producto} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center hover:border-blue-300 transition-colors cursor-pointer" onClick={() => addProducto(p)}>
                <div>
                  <p className="text-sm font-bold text-blue-700">{p.sku}</p>
                  <p className="text-xs text-slate-600 line-clamp-1">{p.nombre}</p>
                </div>
                <button className="text-emerald-600 p-1 bg-emerald-50 rounded hover:bg-emerald-100"><Plus size={18}/></button>
              </div>
            ))}
            {searchTerm && filteredProductos.length === 0 && <p className="text-xs text-slate-500 text-center mt-4">No se encontraron productos.</p>}
          </div>
        </div>

        {/* Tabla Detalle */}
        <div className="w-full lg:w-2/3 p-6 flex flex-col">
          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 mb-4">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Producto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase w-24">Cantidad</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase w-32">Costo Unit.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Subtotal</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400 text-sm">No hay ítems en la orden. Busque y agregue productos.</td></tr>
                ) : items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-slate-800">{item.producto?.sku}</p>
                      <p className="text-xs text-slate-500 truncate w-48">{item.producto?.nombre}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input type="number" min="1" className="w-20 bg-white border border-slate-300 rounded p-1 text-right text-sm focus:ring-2 focus:ring-blue-500" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input type="number" min="0" step="0.01" className="w-24 bg-white border border-slate-300 rounded p-1 text-right text-sm focus:ring-2 focus:ring-blue-500" value={item.costo_unitario} onChange={e => updateItem(idx, 'costo_unitario', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">
                      {(item.cantidad * item.costo_unitario).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="block text-slate-500 font-semibold mb-0.5">Peso Total</span>
                <span className="font-bold text-slate-800">{totales.peso.toFixed(2)} kg</span>
              </div>
              <div>
                <span className="block text-slate-500 font-semibold mb-0.5">Volumen Total</span>
                <span className="font-bold text-slate-800">{totales.volumen.toFixed(4)} m³</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="block text-slate-500 font-semibold mb-0.5">Total de la Orden</span>
                <span className="text-2xl font-black text-emerald-600">{moneda === 'USD' ? '$' : 'S/'} {totales.subtotal.toFixed(2)}</span>
              </div>
              <button 
                onClick={() => registrarMutation.mutate()} 
                disabled={registrarMutation.isPending || items.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {registrarMutation.isPending ? 'Guardando...' : <><CheckCircle size={20}/> Registrar Orden</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
