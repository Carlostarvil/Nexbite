import { coordenadasValidas } from '../shared/zonaEntrega.js';

function distanciaSQL(latitud, longitud) {
  return `(6371 * acos(LEAST(1.0, GREATEST(-1.0,
    cos(radians(${latitud})) * cos(radians(r.latitud)) * cos(radians(r.longitud) - radians(${longitud})) +
    sin(radians(${latitud})) * sin(radians(r.latitud))))))`;
}

// Todos los listados filtran antes de ordenar y limitar los resultados.
export function filtroZona(args, valores) {
  const { latitud, longitud, solo_con_entrega = false, radio_km = 50 } = args;
  if (latitud == null && longitud == null && !solo_con_entrega) return { condicion: 'TRUE', distancia: null };
  if (!coordenadasValidas(latitud, longitud)) throw new Error('Selecciona una ubicación válida.');
  valores.push(Number(latitud), Number(longitud));
  const distancia = distanciaSQL(`$${valores.length - 1}`, `$${valores.length}`);
  let limite;
  if (solo_con_entrega) {
    limite = 'r.radio_cobertura_km';
  } else {
    const radio = radio_km ?? 50;
    if (!Number.isFinite(radio) || radio <= 0 || radio > 50000) throw new Error('El radio de búsqueda no es válido.');
    valores.push(radio);
    limite = `$${valores.length}`;
  }
  return {
    distancia,
    condicion: `r.latitud BETWEEN -90 AND 90 AND r.longitud BETWEEN -180 AND 180
      ${solo_con_entrega ? 'AND r.radio_cobertura_km > 0' : ''} AND ${distancia} <= ${limite} + 0.000001`,
  };
}

export function crearConsultasZona(pool) {
  const ejecutar = async (args, valores, consulta) => {
    const filtro = filtroZona(args, valores);
    return (await pool.query(consulta(filtro), valores)).rows;
  };
  return {
    obtenerRestaurantesCercanos: (_, args) => ejecutar({ ...args, radio_km: args.radio_km ?? 50 }, [], ({ condicion, distancia }) =>
      `SELECT r.*, ${distancia} AS distancia_km FROM Restaurantes r WHERE ${condicion} ORDER BY distancia_km ASC`),
    obtenerMejoresRestaurantes: (_, args) => ejecutar(args, [], ({ condicion }) =>
      `SELECT r.*, COUNT(p.id_pedido) AS total_ventas FROM Restaurantes r LEFT JOIN Pedidos p ON r.id_restaurante = p.id_restaurante
       WHERE ${condicion} GROUP BY r.id_restaurante ORDER BY total_ventas DESC LIMIT 10`),
    buscarRestaurantes: (_, args) => !args.termino?.trim() ? [] : ejecutar(args, [`%${args.termino.trim()}%`], ({ condicion }) =>
      `SELECT r.* FROM Restaurantes r WHERE (r.nombre ILIKE $1 OR r.tipo ILIKE $1) AND ${condicion} LIMIT 6`),
    buscarPlatos: (_, args) => !args.termino?.trim() ? [] : ejecutar(args, [`%${args.termino.trim()}%`], ({ condicion }) =>
      `SELECT p.* FROM Platos p JOIN Restaurantes r ON r.id_restaurante = p.id_restaurante
       WHERE (p.nombre ILIKE $1 OR p.descripcion ILIKE $1) AND ${condicion} LIMIT 6`),
    obtenerPlatosDestacados: (_, args) => ejecutar(args, [], ({ condicion }) =>
      `SELECT p.*, r.nombre AS nombre_restaurante FROM Platos p JOIN Restaurantes r ON r.id_restaurante = p.id_restaurante
       WHERE p.disponible = true AND ${condicion} ORDER BY RANDOM() LIMIT 8`),
    obtenerFavoritos: (_, args) => ejecutar(args, [args.id_usuario], ({ condicion }) =>
      `SELECT r.* FROM Restaurantes r JOIN Favoritos f ON r.id_restaurante = f.id_restaurante WHERE f.id_usuario = $1 AND ${condicion}`),
    obtenerPlatosFavoritos: (_, args) => ejecutar(args, [args.id_usuario], ({ condicion }) =>
      `SELECT p.* FROM Platos p JOIN Platos_Favoritos f ON p.id_plato = f.id_plato JOIN Restaurantes r ON r.id_restaurante = p.id_restaurante
       WHERE f.id_usuario = $1 AND ${condicion}`),
    obtenerUltimosPedidos: (_, args) => ejecutar(args, [args.id_usuario], ({ condicion }) =>
      `SELECT pe.id_pedido, pe.id_restaurante, pe.id_plato, pe.estado, pe.metodo_pago, pe.direccion_envio, pe.fecha_programada, pe.fecha_pedido,
         pl.nombre AS nombre_plato, pl.precio AS precio_plato, pl.disponible AS plato_disponible, pl.descripcion AS descripcion_plato, pl.imagen_url AS imagen_plato,
         r.nombre AS nombre_restaurante, r.imagen_url AS imagen_restaurante, r.aceptando_pedidos AS restaurante_abierto
       FROM Pedidos pe LEFT JOIN Platos pl ON pe.id_plato = pl.id_plato LEFT JOIN Restaurantes r ON pe.id_restaurante = r.id_restaurante
       WHERE pe.id_usuario = $1 AND ${condicion} ORDER BY pe.id_pedido DESC LIMIT 3`),
  };
}
