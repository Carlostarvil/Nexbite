const CONOCIMIENTO_SOPORTE = [
  { claves: ['reserva', 'reservar', 'programar', 'más tarde', 'mas tarde'], respuesta: 'Puedes reservar para una hora futura compatible con la reapertura del local y de todos los productos del carrito, incluidos los del menú. La fecha se conserva aunque el local abra antes. Con tarjeta se autoriza el importe ahora y solo se cobra al llegar la hora y estar todo disponible. La reserva debe caber en el plazo de autorización que permita tu tarjeta. Si no puede servirse en los 30 minutos siguientes, se cancela y se libera la retención. También puedes reservar con efectivo.' },
  { claves: ['pagar', 'pago', 'agotado', 'pausado', 'cerrado', 'error', 'comprar'], respuesta: 'No se aceptan compras inmediatas de productos no disponibles ni de locales cerrados. Puedes retirar esos productos del carrito o reservar para una hora posterior a su disponibilidad, si tienen una fecha de reactivación. El servidor comprueba todos los productos y el precio antes de cobrar. Si cambia algo, te pedirá revisar el carrito.' },
  { claves: ['tarda', 'tiempo', 'demora', 'cuánto', 'cuanto'], respuesta: 'La entrega depende de la distancia y de los pedidos del local. Consulta el estado en Mi perfil, en Tus pedidos anteriores.' },
  { claves: ['contacto', 'humano', 'agente', 'persona', 'teléfono', 'telefono'], respuesta: 'Abre la información del local para consultar su teléfono y contactar sobre tu pedido.' },
];

export async function procesarMensaje(mensaje, contexto, pool, compras) {
  if (!mensaje || typeof mensaje !== 'string') return 'Hola, ¿en qué puedo ayudarte con NexBite?';
  const texto = mensaje.toLowerCase().trim();
  const numero = texto.match(/\b\d+\b/)?.[0];
  const cancelar = ['cancelar', 'anular', 'eliminar'].some(p => texto.includes(p));
  const reembolso = ['reembolso', 'devolución', 'devolucion', 'dinero', 'cobro'].some(p => texto.includes(p));
  if (numero && contexto?.usuario && pool) {
    const pedido = (await pool.query('SELECT * FROM Pedidos WHERE id_pedido = $1 AND id_usuario = $2', [numero, contexto.usuario.id_usuario])).rows[0];
    if (!pedido) return 'No encuentro el pedido #' + numero + ' en tu cuenta.';
    if (cancelar || reembolso) {
      if (!compras) return 'No se puede gestionar la cancelación ahora. Inténtalo de nuevo.';
      try {
        const resultado = await compras.cancelarPedido(numero, contexto);
        return 'Pedido #' + numero + ' cancelado.' + (pedido.id_compra ? ' Se ha cancelado la compra completa de ese local.' : '') + ' ' + resultado.mensaje_pago;
      } catch (error) { return error.message; }
    }
    if (pedido.estado === 'PROGRAMADO') return 'Tu pedido #' + numero + ' está reservado' + (pedido.fecha_programada ? ' para ' + new Date(pedido.fecha_programada).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : '') + '. Solo se activa al llegar la hora y estar disponibles el local y los productos.';
    return 'Tu pedido #' + numero + ' está ' + pedido.estado.toLowerCase() + '.';
  }
  if ((cancelar || reembolso) && !contexto?.usuario) return 'Inicia sesión para consultar o cancelar tus pedidos.';
  if (cancelar || reembolso) return 'Escribe Cancelar seguido del número de pedido. La compra completa se puede cancelar mientras su preparación no haya empezado. La devolución o liberación de la autorización se confirma con la pasarela de pago.';
  for (const item of CONOCIMIENTO_SOPORTE) if (item.claves.some(p => texto.includes(p))) return item.respuesta;
  return 'Puedo explicar las reservas o consultar tus pedidos. Escribe el número de pedido o pregunta cómo reservar con un local cerrado.';
}
