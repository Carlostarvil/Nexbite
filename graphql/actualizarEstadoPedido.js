import { leerUnidadesPedido, estadoDelConjunto, estadoCanonico, etapasPedido, pedidoFinalizado } from './pedidosVendedor.js';

export function crearActualizadorEstadoPedido(notificaciones) {
  return async (_, { id_pedido, nuevo_estado, motivo_rechazo, mensaje_personalizado }, contexto) => {
    const conexion = contexto.conexionConsulta;
    await conexion.query('BEGIN');
    let pedido;
    try {
      const anteriores = await leerUnidadesPedido(conexion, id_pedido, true);
      const estado = estadoCanonico(nuevo_estado);
      if (!anteriores.length || anteriores.every(pedidoFinalizado)) throw new Error('El pedido ha cambiado. Actualiza la lista.');
      if (!(estado in etapasPedido) || estado === 'PROGRAMADO') throw new Error('El estado del pedido no es válido.');
      if (etapasPedido[estado] < etapasPedido[estadoDelConjunto(anteriores)]) throw new Error('Un pedido no puede volver a un estado anterior.');
      const porCambiar = anteriores.filter(p => !pedidoFinalizado(p) && etapasPedido[estadoCanonico(p.estado)] < etapasPedido[estado]);
      if (!porCambiar.length) {
        await conexion.query('COMMIT');
        return { ...anteriores[0], estado: estadoDelConjunto(anteriores) };
      }
      const cambiados = (await conexion.query('UPDATE Pedidos SET estado = $1 WHERE id_pedido = ANY($2::int[]) RETURNING *', [estado, porCambiar.map(p => p.id_pedido)])).rows;
      const porId = new Map(cambiados.map(p => [p.id_pedido, p]));
      const unidades = anteriores.map(p => porId.get(p.id_pedido) || p);
      pedido = { ...unidades[0], estado: estadoDelConjunto(unidades) };
      await notificaciones.registrar(conexion, pedido, { motivo: motivo_rechazo, mensaje: mensaje_personalizado, pedidoCompleto: Boolean(pedido.id_compra), pedidos: unidades });
      await conexion.query('COMMIT');
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    }
    notificaciones.despertar();
    return pedido;
  };
}
