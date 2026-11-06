export const soles = (valor: number | string | null | undefined) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(valor || 0));

export function fechaPeru(valor: string | null | undefined): string {
  if (!valor) return '—';
  const iso = valor.replace(' ', 'T');
  const fecha = new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + '-05:00');
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });
}
