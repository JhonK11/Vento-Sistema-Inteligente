import { useState } from "react";
import { Search, Loader2, Building2, X, Check } from "lucide-react";
import { api } from "../../lib/axios";
import { apiError } from '../../lib/apiError';

interface HeaderFormProps {
  numeroVenta: string;
  metodoPago: string;
  setMetodoPago: (val: string) => void;
  idCliente: string;
  setIdCliente: (val: string) => void;
  idAlmacen: string;
  setIdAlmacen: (val: string) => void;
  almacenFijo?: boolean;
  clientes: { id_cliente: number; nombre_razon_social: string }[];
  almacenes: { id_almacen: number; nombre: string }[];
  onClienteAgregado?: (cliente: { id_cliente: number; nombre_razon_social: string }) => void;
}

export default function HeaderForm({
  numeroVenta,
  metodoPago, setMetodoPago,
  idCliente, setIdCliente,
  idAlmacen, setIdAlmacen, almacenFijo = false,
  clientes, almacenes,
  onClienteAgregado
}: HeaderFormProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [docNumero, setDocNumero] = useState("");
  const [docTipo, setDocTipo] = useState<"DNI" | "RUC">("DNI");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    numero_documento: string; nombre_razon_social: string; direccion?: string;
    estado?: string; condicion?: string;
  } | null>(null);
  const [searchError, setSearchError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConsultar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanDoc = docNumero.trim();
    if (!cleanDoc) return;

    if (docTipo === "DNI" && cleanDoc.length !== 8) {
      setSearchError("El DNI debe tener 8 dígitos numéricos");
      return;
    }
    if (docTipo === "RUC" && cleanDoc.length !== 11) {
      setSearchError("El RUC debe tener 11 dígitos numéricos");
      return;
    }

    setSearching(true);
    setSearchError("");
    setSearchResult(null);

    try {
      const endpoint = docTipo === "DNI" ? `/consultas/dni/${cleanDoc}` : `/consultas/ruc/${cleanDoc}`;
      const res = await api.get(endpoint);
      setSearchResult(res.data);
    } catch (err: unknown) {
      setSearchError(apiError(err, "No se pudo obtener información del padrón oficial."));
    } finally {
      setSearching(false);
    }
  };

  const handleAsignarCliente = async () => {
    if (!searchResult) return;
    setSaving(true);
    try {
      const res = await api.post("/consultas/clientes/guardar-o-buscar", null, {
        params: {
          tipo_documento: docTipo,
          numero_documento: searchResult.numero_documento,
          nombre_razon_social: searchResult.nombre_razon_social,
          direccion: searchResult.direccion || null
        }
      });

      const nuevoCliente = {
        id_cliente: res.data.id_cliente,
        nombre_razon_social: `${searchResult.nombre_razon_social} (${docTipo}: ${searchResult.numero_documento})`
      };

      if (onClienteAgregado) {
        onClienteAgregado(nuevoCliente);
      }
      setIdCliente(String(nuevoCliente.id_cliente));
      setIsModalOpen(false);
      setSearchResult(null);
      setDocNumero("");
    } catch (err: unknown) {
      setSearchError(apiError(err, "Error al asignar cliente."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Datos de la Cabecera</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Nº Venta</label>
          <input 
            type="text" 
            disabled 
            value={numeroVenta} 
            className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-slate-600 font-mono font-bold text-sm" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Método de Pago</label>
          <select 
            value={metodoPago} 
            onChange={e => setMetodoPago(e.target.value)} 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</label>
            <button
              type="button"
              onClick={() => { setIsModalOpen(true); setSearchError(""); setSearchResult(null); }}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
            >
              <Search size={13} /> Consultar DNI / RUC
            </button>
          </div>
          <select 
            value={idCliente} 
            onChange={e => setIdCliente(e.target.value)} 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Cliente General --</option>
            {clientes.map(c => (
              <option key={c.id_cliente} value={c.id_cliente}>{c.nombre_razon_social}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Almacén Origen</label>
          <select 
            required 
            value={idAlmacen} disabled={almacenFijo}
            onChange={e => setIdAlmacen(e.target.value)} 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccione un almacén</option>
            {almacenes.map(a => (
              <option key={a.id_almacen} value={a.id_almacen}>{a.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Modal Consulta Oficial SUNAT / RENIEC */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Building2 size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-base">Consulta Oficial en Línea</h4>
                  <p className="text-xs text-slate-500">SUNAT (RUC) & RENIEC (DNI)</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConsultar} className="p-6 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setDocTipo("DNI"); setDocNumero(""); setSearchResult(null); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                    docTipo === "DNI"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Persona Natural (DNI)
                </button>
                <button
                  type="button"
                  onClick={() => { setDocTipo("RUC"); setDocNumero(""); setSearchResult(null); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                    docTipo === "RUC"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Empresa / Jurídico (RUC)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Número de {docTipo} ({docTipo === "DNI" ? "8 dígitos" : "11 dígitos"})
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={docTipo === "DNI" ? 8 : 11}
                    value={docNumero}
                    onChange={(e) => setDocNumero(e.target.value.replace(/\D/g, ''))}
                    placeholder={docTipo === "DNI" ? "Ej. 45678912" : "Ej. 20100070970"}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={searching || !docNumero}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                  >
                    {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    Consultar
                  </button>
                </div>
              </div>

              {searchError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700">
                  {searchError}
                </div>
              )}

              {searchResult && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      Padrón Verificado
                    </span>
                    {searchResult.estado && (
                      <span className="text-[10px] font-black text-emerald-700">
                        {searchResult.estado} {searchResult.condicion ? `• ${searchResult.condicion}` : ''}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">Nombre / Razón Social:</span>
                    <strong className="text-sm text-slate-900 leading-tight block">
                      {searchResult.nombre_razon_social}
                    </strong>
                  </div>

                  {searchResult.direccion && (
                    <div>
                      <span className="text-[11px] text-slate-500 block">Dirección Fiscal:</span>
                      <span className="text-xs text-slate-700 block">
                        {searchResult.direccion}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAsignarCliente}
                    disabled={saving}
                    className="w-full mt-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Asignar este Cliente a la Venta
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
