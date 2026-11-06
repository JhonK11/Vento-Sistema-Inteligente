import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageSearch, Search, PackageCheck, AlertTriangle, XCircle, LayoutGrid, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { api } from '../lib/axios';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';

interface StockItem {
  id_producto: number;
  sku: string;
  nombre: string;
  id_almacen: number;
  almacen: string;
  stock_actual: number;
  stock_reservado: number;
  stock_disponible: number;
  stock_minimo: number;
}

const CATEGORIAS = [
  { id: 'TODOS', label: 'Todos', icon: LayoutGrid },
  { id: 'CON_STOCK', label: 'Con Stock', icon: PackageCheck },
  { id: 'BAJO_STOCK', label: 'Bajo Stock', icon: AlertTriangle },
  { id: 'AGOTADO', label: 'Agotado (Stockout)', icon: XCircle },
];

export default function Inventario() {
  const [globalFilter, setGlobalFilter] = useState('');
  const [categoria, setCategoria] = useState('TODOS');

  const { data: stock = [], isLoading, isError } = useQuery<StockItem[]>({
    queryKey: ['stockDisponible'],
    queryFn: async () => {
      const res = await api.get("/productos/stock");
      return res.data;
    }
  });

  const filteredStock = useMemo(() => stock.filter(item => {
    if (categoria === 'CON_STOCK') return item.stock_actual > 0;
    if (categoria === 'BAJO_STOCK') return item.stock_actual > 0 && item.stock_disponible <= item.stock_minimo;
    if (categoria === 'AGOTADO') return item.stock_actual <= 0;
    return true;
  }), [stock, categoria]);

  const columns = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        accessorKey: 'sku',
        header: 'SKU',
        cell: info => <span className="font-semibold text-slate-800">{info.getValue() as string}</span>,
      },
      {
        accessorKey: 'nombre',
        header: 'Producto',
        cell: info => {
          const item = info.row.original;
          const isLowStock = item.stock_disponible <= item.stock_minimo;
          return (
            <div className="flex items-center gap-2 font-medium">
              {info.getValue() as string}
              {isLowStock && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-600 border border-red-100">
                  Bajo Stock
                </span>
              )}
            </div>
          );
        }
      },
      {
        accessorKey: 'almacen',
        header: 'Almacén',
        cell: info => (
          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-medium">
            {info.getValue() as string}
          </span>
        )
      },
      {
        accessorKey: 'stock_actual',
        header: () => <div className="text-right">Stock Físico</div>,
        cell: info => <div className="text-right font-medium text-slate-700">{info.getValue() as number}</div>,
      },
      {
        accessorKey: 'stock_reservado',
        header: () => <div className="text-right">Reservado</div>,
        cell: info => {
          const val = info.getValue() as number;
          return <div className="text-right font-medium text-amber-600">{val > 0 ? val : '-'}</div>;
        }
      },
      {
        accessorKey: 'stock_disponible',
        header: () => <div className="text-right">Disponible</div>,
        cell: info => {
          const item = info.row.original;
          const isLowStock = item.stock_disponible <= item.stock_minimo;
          return (
            <div className={`text-right font-bold ${isLowStock ? 'text-red-600' : 'text-emerald-600'}`}>
              {info.getValue() as number}
            </div>
          );
        }
      }
    ],
    []
  );

  const table = useReactTable({
    data: filteredStock,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Stock Disponible</h2>
        
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors shadow-sm"
            placeholder="Buscar en la tabla..."
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Pestañas de Categorías */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-full overflow-x-auto shadow-inner">
        {CATEGORIAS.map((cat) => {
          const Icon = cat.icon;
          const isSelected = categoria === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoria(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                isSelected 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Icon size={16} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : isError ? (
        <p className="text-red-500 bg-red-50 p-4 rounded-xl border border-red-100">Error al cargar el inventario.</p>
      ) : filteredStock.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-slate-500">
          <PackageSearch size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-600">No se encontraron productos</p>
          <p className="text-sm">Intenta con otro término de búsqueda.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-slate-400">
                            {{
                              asc: <ChevronUp size={14} className="text-blue-600" />,
                              desc: <ChevronDown size={14} className="text-blue-600" />
                            }[header.column.getIsSorted() as string] ?? null}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/50">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-medium">
                Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              </span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={e => table.setPageSize(Number(e.target.value))}
                className="ml-2 bg-white border border-slate-200 rounded p-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {[10, 20, 30, 50].map(pageSize => (
                  <option key={pageSize} value={pageSize}>
                    Mostrar {pageSize}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsLeft size={20} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={20} />
              </button>
              <button
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
