export interface PropuestaCompra {
  id_producto: number;
  sku: string;
  nombre: string;
  cantidad: number;
  id_proveedor: number | null;
  costo_unitario: number | null;
  peso_kg: number;
  volumen_m3: number;
}

export interface Pronostico {
  producto: {
    id_producto: number; sku: string; nombre: string; stock_actual: number; stock_disponible: number;
    costo_promedio_pen: number | null; lead_time_dias: number; proveedor: string;
    id_proveedor: number | null; peso_kg: number; volumen_m3: number;
  };
  parametros_modelo: { algoritmo: string; nivel_servicio_porcentaje: number };
  calidad_datos: { estado: 'SIN_VENTAS' | 'LIMITADO' | 'SUFICIENTE'; dias_historial: number;
    dias_con_ventas: number; fecha_corte: string; advertencia: string };
  metricas_pronostico: { demanda_diaria_promedio: number; demanda_total_proyectada: number;
    dias_cobertura_actual: number | null };
  politica_inventario: { estado: string; mensaje: string; stock_seguridad: number; punto_reorden: number;
    cantidad_sugerida_compra: number; inversion_estimada_pen: number | null };
  timeline_grafica: { fecha: string; ventas_reales: number | null; pronostico: number | null;
    limite_inferior: number | null; limite_superior: number | null }[];
}

export interface AlertaCompra {
  id_producto: number; sku: string; producto: string; categoria: string;
  stock_actual: number; stock_disponible: number; punto_reorden: number; stock_seguridad: number;
  lead_time_dias: number; proveedor: string; id_proveedor: number | null;
  cantidad_sugerida: number; costo_estimado_pen: number | null; costo_conocido: boolean;
  prioridad: 'ALTA' | 'MEDIA'; demanda_diaria_estimada: number;
  peso_kg: number; volumen_m3: number;
}

export interface ResumenAbastecimiento {
  resumen: { total_productos_en_alerta: number; inversion_total_estimada_pen: number;
    productos_criticos: number; productos_sin_costo: number; productos_sin_ventas: number;
    fecha_corte: string; cobertura_dias: number };
  sugerencias_compra: AlertaCompra[];
}
