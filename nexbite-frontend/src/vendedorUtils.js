export const precioVendedor = valor => Number(valor || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function fechaVendedor(valor) {
  if (!valor || String(valor).includes('Indefinido')) return 'Sin fecha de reapertura';
  const fecha = new Date(Number.isFinite(Number(valor)) ? Number(valor) : valor);
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha de reapertura';
  return fecha.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

export const categoriasLocal = tipo => String(tipo || '').split('|')[0].split(',').map(t => t.trim()).filter(Boolean);
export const textoCategoriaLocal = valor => valor.charAt(0).toUpperCase() + valor.slice(1).toLocaleLowerCase('es-ES');
