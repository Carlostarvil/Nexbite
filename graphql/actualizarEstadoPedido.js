const canonico = estado => ({ 'EN COCINA': 'PREPARANDO', 'EN CAMINO': 'ENVIADO', RECHAZADO: 'CANCELADO' }[estado] || estado);

export function crearActualizadorEstadoPedido(notificaciones) {
  return async (_, { id_pedido, nuevo_estado, motivo_rechazo, mensaje_personalizado }, contexto) => {
    const conexion = contexto.conexionConsulta;
    await conexion.query('BEGIN');
    let pedido;
    try {
      const anterior = (await conexion.query('SELECT * FROM Pedidos WHERE id_pedido = $1 FOR UPDATE', [id_pedido])).rows[0];
      if (!anterior || ['ENTREGADO', 'CANCELADO', 'RECHAZADO'].includes(anterior.estado)) throw new Error('El pedido ha cambiado. Actualiza la lista.');
      if (canonico(anterior.estado) === canonico(nuevo_estado)) {
        await conexion.query('COMMIT');
        return anterior;
      }
      pedido = (await conexion.query('UPDATE Pedidos SET estado = $1 WHERE id_pedido = $2 RETURNING *', [nuevo_estado, id_pedido])).rows[0];
      await notificaciones.registrar(conexion, pedido, { motivo: motivo_rechazo, mensaje: mensaje_personalizado });
      await conexion.query('COMMIT');
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    }
    notificaciones.despertar();
    return pedido;
  };
}
