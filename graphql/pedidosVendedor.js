export const estadoCanonico = estado => ({ 'EN COCINA': 'PREPARANDO', 'EN CAMINO': 'ENVIADO', RECHAZADO: 'CANCELADO' }[estado] || estado);
export const etapasPedido = { PROGRAMADO: -1, PENDIENTE: 0, PREPARANDO: 1, ENVIADO: 2, ENTREGADO: 3 };
export const pedidoFinalizado = pedido => ['ENTREGADO', 'CANCELADO'].includes(estadoCanonico(pedido.estado));

export function estadoDelConjunto(unidades) {
  const activas = unidades.filter(p => !pedidoFinalizado(p));
  if (!activas.length) return unidades.every(p => estadoCanonico(p.estado) === 'ENTREGADO') ? 'ENTREGADO' : 'CANCELADO';
  // Un pedido antiguo con estados distintos no está entregado hasta completar sus unidades.
  return activas.map(p => estadoCanonico(p.estado)).sort((a, b) => (etapasPedido[a] ?? -1) - (etapasPedido[b] ?? -1))[0];
}

export function agruparProductos(unidades) {
  const productos = new Map();
  for (const unidad of unidades) {
    const nombre = unidad.nombre_producto || unidad.nombre_plato || 'Producto retirado';
    const precio = unidad.precio_centimos == null ? null : Number(unidad.precio_centimos);
    const estado = estadoCanonico(unidad.estado);
    const clave = JSON.stringify([unidad.id_plato, nombre, precio, estado]);
    if (!productos.has(clave)) productos.set(clave, {
      id_plato: unidad.id_plato, nombre, cantidad: 0, precio_unitario: precio == null ? null : precio / 100,
      total: null, imagen_url: unidad.imagen_plato, estado,
    });
    const producto = productos.get(clave);
    producto.cantidad++;
    producto.total = precio == null ? null : precio * producto.cantidad / 100;
  }
  return [...productos.values()];
}

export async function leerUnidadesPedido(conexion, idPedido, bloquear = false) {
  const referencia = (await conexion.query('SELECT id_compra, id_restaurante, id_usuario FROM Pedidos WHERE id_pedido = $1', [idPedido])).rows[0];
  if (!referencia) return [];
  const agrupado = Boolean(referencia.id_compra);
  return (await conexion.query(`
    SELECT p.*, c.estado AS estado_compra FROM Pedidos p LEFT JOIN Compras c ON c.id_compra = p.id_compra
    WHERE ${agrupado ? 'p.id_compra = $1 AND p.id_restaurante = $2 AND p.id_usuario = $3' : 'p.id_pedido = $1'}
    ORDER BY p.id_pedido ${bloquear ? 'FOR UPDATE OF p' : ''}
  `, agrupado ? [referencia.id_compra, referencia.id_restaurante, referencia.id_usuario] : [idPedido])).rows;
}

export function crearConsultaPedidosVendedor(pool) {
  return async (_, { id_restaurante }) => {
    const unidades = (await pool.query(`
      SELECT pe.*, c.estado AS estado_pago, c.motivo AS mensaje_pago,
        c.resumen->>'envio_centimos' AS envio_centimos, c.total_centimos,
        COALESCE(pe.nombre_producto, pl.nombre) AS nombre_plato, pl.imagen_url AS imagen_plato
      FROM Pedidos pe LEFT JOIN Platos pl ON pe.id_plato = pl.id_plato
      LEFT JOIN Compras c ON c.id_compra = pe.id_compra
      WHERE pe.id_restaurante = $1 ORDER BY pe.id_pedido DESC
    `, [id_restaurante])).rows;
    const grupos = new Map();
    for (const unidad of unidades) {
      // Sin id_compra no hay una relación fiable: no se mezclan pedidos por fecha o dirección.
      const clave = unidad.id_compra ? JSON.stringify([unidad.id_compra, unidad.id_restaurante, unidad.id_usuario]) : 'pedido-' + unidad.id_pedido;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(unidad);
    }
    return [...grupos.values()].map(grupo => {
      grupo.sort((a, b) => Number(a.id_pedido) - Number(b.id_pedido));
      const referencia = grupo[0];
      const productos = agruparProductos(grupo);
      const subtotal = grupo.every(p => p.precio_centimos != null) ? grupo.reduce((suma, p) => suma + Number(p.precio_centimos), 0) / 100 : null;
      return {
        ...referencia, estado: estadoDelConjunto(grupo), productos, cantidad_total: grupo.length,
        nombre_plato: [...new Set(productos.map(p => p.nombre))].join(' · '),
        subtotal, envio: referencia.envio_centimos == null ? null : Number(referencia.envio_centimos) / 100,
        total: referencia.total_centimos == null ? subtotal : Number(referencia.total_centimos) / 100,
        estados_mixtos: new Set(grupo.map(p => estadoCanonico(p.estado))).size > 1,
      };
    });
  };
}
