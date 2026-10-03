import { validarHorariosRecogida } from '../shared/horariosRecogida.js';

export function crearActualizadorNegocio(pool) {
  return async (_, {
    id_restaurante, nombre, tipo, latitud, longitud, imagen_url,
    radio_cobertura_km, telefono, direccion, horarios_recogida
  }, contexto) => {
    if (!contexto?.usuario || contexto.usuario.rol !== 'VENDEDOR') {
      throw new Error('Inicia sesión como vendedor para editar un local.');
    }
    if (!nombre.trim()) throw new Error('El nombre del local es obligatorio.');
    if (!['RESTAURANTE', 'SUPERMERCADO', 'FARMACIA'].includes(tipo)) {
      throw new Error('Selecciona un tipo de negocio válido.');
    }
    if (!telefono.trim()) throw new Error('El teléfono de contacto es obligatorio.');
    if (!imagen_url.trim()) throw new Error('La imagen de portada es obligatoria.');
    if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90 ||
        !Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
      throw new Error('Selecciona una ubicación válida para el local.');
    }
    if (!Number.isFinite(radio_cobertura_km) || radio_cobertura_km <= 0 || radio_cobertura_km > 500) {
      throw new Error('La distancia de reparto debe estar entre 0 y 500 kilómetros.');
    }
    const horarios = horarios_recogida == null ? null : validarHorariosRecogida(horarios_recogida);
    // La condición de propietario forma parte del UPDATE para impedir editar locales ajenos.
    const res = await pool.query(`
      UPDATE Restaurantes
      SET nombre = $1, tipo = $2, latitud = $3, longitud = $4, imagen_url = $5,
          radio_cobertura_km = $6, telefono = $7, direccion = $8, horarios_recogida = $9::jsonb
      WHERE id_restaurante = $10 AND id_usuario_dueño = $11
      RETURNING *
    `, [nombre.trim(), tipo, latitud, longitud, imagen_url, radio_cobertura_km,
        telefono.trim(), direccion?.trim() || null, horarios === null ? null : JSON.stringify(horarios),
        id_restaurante, contexto.usuario.id_usuario]);
    if (!res.rows[0]) throw new Error('El local no existe o no te pertenece.');
    return res.rows[0];
  };
}
