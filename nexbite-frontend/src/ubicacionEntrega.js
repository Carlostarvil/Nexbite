import { coordenadasValidas } from '../../shared/zonaEntrega.js';

const clave = idUsuario => `nexbite_ubicacion_entrega_${idUsuario}`;

export function leerUbicacionEntrega(idUsuario) {
  if (!idUsuario) return null;
  try {
    const ubicacion = JSON.parse(localStorage.getItem(clave(idUsuario)));
    return typeof ubicacion?.direccion === 'string' && ubicacion.direccion.trim() &&
      typeof ubicacion.lat === 'number' && typeof ubicacion.lng === 'number' &&
      coordenadasValidas(ubicacion.lat, ubicacion.lng) ? ubicacion : null;
  } catch {
    return null;
  }
}

export function guardarUbicacionEntrega(idUsuario, ubicacion) {
  try {
    localStorage.setItem(clave(idUsuario), JSON.stringify(ubicacion));
  } catch {
    // La selección sigue funcionando si el navegador bloquea el almacenamiento.
  }
}
