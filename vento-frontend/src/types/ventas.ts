export interface ProductoVenta {
  id_producto: number;
  nombre: string;
  sku: string;
  codigo_barras: string | null;
  precio_venta: number;
  imagen_url: string | null;
  categoria: string | null;
  estado: string;
  stock_disponible: number;
  es_fraccionable: boolean | number;
}

export interface ItemVenta {
  id_producto: number;
  nombre: string;
  sku: string;
  cantidad: number;
  precio_unitario: number;
  imagen_url: string | null;
  es_fraccionable: boolean | number;
}
