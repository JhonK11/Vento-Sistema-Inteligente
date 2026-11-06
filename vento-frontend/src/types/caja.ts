export interface MovimientoCaja {
  id_movimiento: number; tipo: 'INGRESO' | 'RETIRO'; monto: number; motivo: string; fecha: string; responsable: string;
}
export interface TurnoCaja {
  id_turno: number; id_usuario: number; id_almacen: number; estado: 'ABIERTO' | 'CERRADO';
  fecha_apertura: string; fecha_cierre: string | null; fondo_inicial: number;
  efectivo_contado: number | null; efectivo_esperado_cierre: number | null; diferencia: number | null;
  observaciones_apertura: string | null; observaciones_cierre: string | null;
  cajero?: string; almacen?: string; cerrado_por?: string | null;
}
export interface ResumenCaja extends TurnoCaja {
  efectivo_esperado: number; ingresos_manuales: number; retiros: number; ventas_total: number; numero_ventas: number;
  ventas_por_metodo: { metodo: string; cantidad: number; total: number }[];
  movimientos?: MovimientoCaja[];
}
export interface PaginaTurnos { items: TurnoCaja[]; total: number; pagina: number; tamanio: number }
export interface VentaResumen {
  id_venta: number; numero_venta: string; fecha: string; metodo_pago: string; estado: 'EMITIDA' | 'ANULADA';
  cliente: string; cajero: string; almacen: string; id_usuario: number; id_turno: number | null;
  total: number; subtotal: number; descuento: number; impuesto: number;
  monto_recibido: number | null; vuelto: number | null; costo_verificado: boolean | number | null;
}
export interface VentaDetalle extends VentaResumen {
  items: { id_producto: number; nombre: string; sku: string; cantidad: number; precio_unitario: number; subtotal: number }[];
}
export interface HistorialVentas {
  items: VentaResumen[]; total: number; pagina: number; tamanio: number;
  resumen: { registros: number; ventas_emitidas: number; efectivo: number; sin_turno: number };
}
