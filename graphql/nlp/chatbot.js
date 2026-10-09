const CONOCIMIENTO_SOPORTE = [
  {
    claves: ['tarda', 'tiempo', 'demora', 'cuanto', 'cuánto'],
    respuesta: 'El tiempo estimado de entrega suele situarse entre 25 y 45 minutos. Depende de la carga de pedidos del local y de la distancia.'
  },
  {
    claves: ['contacto', 'humano', 'agente', 'persona', 'telefono', 'teléfono'],
    respuesta: 'Puedes comunicarte con el equipo de soporte humano escribiendo a soporte@nexbite.com o llamando al +34 900 123 456 todos los días en horario de 12:00 a 00:00.'
  },
  // NUEVO: Conocimiento sobre cómo funcionan las reservas
  {
    claves: ['reserva', 'reservar', 'programar', 'mas tarde', 'más tarde', 'despues'],
    respuesta: '¡Las reservas programadas son muy útiles! Si un restaurante está cerrado o un plato está pausado temporalmente, no tienes que vaciar tu carrito. Puedes seleccionar "Reservar el carrito para más tarde". El sistema calculará automáticamente a qué hora vuelve a estar todo disponible y te dejará programar el pedido para cuando abran.'
  },
  // NUEVO: Conocimiento sobre bloqueos en la pasarela de pago
  {
    claves: ['pagar', 'pago', 'agotado', 'pausado', 'cerrado', 'no me deja', 'error', 'bloqueado', 'comprar'],
    respuesta: 'Si el sistema intercepta tu compra y no te deja pagar directamente, es porque el local ha cerrado o porque un producto (o un extra dentro de un menú) está pausado. Cuando esto pasa, te damos dos opciones: puedes "Eliminar agotados" y pagar el resto del pedido ahora mismo, o puedes "Reservar el carrito para más tarde" y programarlo para la hora a la que vuelva a estar disponible.'
  }
];

export async function procesarMensaje(mensaje, contexto, pool) {
  console.log("==========================================");
  console.log("🤖 MENSAJE RECIBIDO EN CHATBOT.JS:", mensaje);
  console.log("==========================================");

  if (!mensaje || typeof mensaje !== 'string') {
    return 'Hola, ¿en qué puedo orientarte hoy respecto a NexBite?';
  }

  const textoLimpio = mensaje.toLowerCase().trim();

  // Variables para detectar intenciones complejas y números
  const matchId = textoLimpio.match(/\b\d+\b/); 
  const quiereCancelar = ['cancelar', 'anular', 'eliminar'].some(c => textoLimpio.includes(c));
  const quiereReembolso = ['reembolso', 'devolucion', 'devolución', 'dinero', 'cobro'].some(c => textoLimpio.includes(c));

  // 1. LÓGICA SI EL USUARIO HA DADO UN NÚMERO DE PEDIDO
  if (matchId && pool && contexto?.usuario) {
    const idPedido = matchId[0];
    console.log("🔍 Buscando pedido número:", idPedido);
    try {
      const res = await pool.query(
        'SELECT estado FROM Pedidos WHERE id_pedido = $1 AND id_usuario = $2',
        [idPedido, contexto.usuario.id_usuario]
      );

      if (res.rows.length > 0) {
        const estado = res.rows[0].estado;
        
        // --- GESTIÓN DE REEMBOLSOS AUTOMATIZADA ---
        if (quiereReembolso) {
          if (estado === 'CANCELADO' || estado === 'RECHAZADO') {
            return `El pedido #${idPedido} ya está ${estado}. Tu reembolso ya está en trámite automático y tardará de 3 a 5 días hábiles en llegar a tu tarjeta.`;
          } else if (estado === 'PENDIENTE' || estado === 'PROGRAMADO') {
            await pool.query(
              "UPDATE Pedidos SET estado = 'CANCELADO' WHERE id_pedido = $1 AND id_usuario = $2",
              [idPedido, contexto.usuario.id_usuario]
            );
            return `✅ He CANCELADO tu pedido #${idPedido} (ya que aún no había empezado a cocinarse) y he iniciado el proceso de reembolso. El dinero volverá a tu cuenta en 3-5 días hábiles.`;
          } else if (estado === 'REEMBOLSO SOLICITADO') {
            return `Tranquilo, ya tenemos registrada tu solicitud de reembolso para el pedido #${idPedido}. Nuestro equipo lo está revisando.`;
          } else {
            await pool.query(
              "UPDATE Pedidos SET estado = 'REEMBOLSO SOLICITADO' WHERE id_pedido = $1 AND id_usuario = $2",
              [idPedido, contexto.usuario.id_usuario]
            );
            return `✅ He registrado oficialmente tu solicitud de reembolso para el pedido #${idPedido}. Nuestro equipo revisará la incidencia de inmediato y gestionará la devolución a tu tarjeta.`;
          }
        }

        // --- GESTIÓN DE CANCELACIONES ---
        if (quiereCancelar) {
          if (estado === 'PENDIENTE' || estado === 'PROGRAMADO') {
            await pool.query(
              "UPDATE Pedidos SET estado = 'CANCELADO' WHERE id_pedido = $1 AND id_usuario = $2",
              [idPedido, contexto.usuario.id_usuario]
            );
            return `✅ Hecho. Tu pedido #${idPedido} ha sido CANCELADO para que el restaurante no lo prepare. Se te reembolsará el dinero automáticamente en 3 a 5 días hábiles.`;
          } else if (estado === 'CANCELADO' || estado === 'RECHAZADO') {
            return `El pedido #${idPedido} ya se encontraba cancelado previamente.`;
          } else {
            return `Lo siento, tu pedido #${idPedido} ya está en estado "${estado}" y no se puede cancelar automáticamente porque la cocina ya lo ha aceptado. Si hubo un problema, escribe "Reembolso ${idPedido}".`;
          }
        }
        
        // --- LECTURA DE ESTADO NORMAL ---
        if (estado === 'PROGRAMADO') return `Tu pedido #${idPedido} está PROGRAMADO. 📅 El local lo recibirá cuando abra o cuando llegue la hora que elegiste. Si deseas cancelarlo, escribe "Cancelar ${idPedido}".`;
        if (estado === 'PENDIENTE') return `Tu pedido #${idPedido} está PENDIENTE de ser aceptado por el restaurante. ⏳ Si deseas cancelarlo, escribe "Cancelar ${idPedido}".`;
        if (estado === 'EN COCINA' || estado === 'PREPARANDO') return `¡Buenas noticias! Tu pedido #${idPedido} ya se está preparando en la cocina. 🍳`;
        if (estado === 'EN CAMINO' || estado === 'ENVIADO') return `¡Tu pedido #${idPedido} ya va en camino hacia tu dirección! 🛵 Prepárate para recibirlo.`;
        if (estado === 'ENTREGADO') return `Tu pedido #${idPedido} figura como ENTREGADO en nuestro sistema. ¡Esperamos que lo hayas disfrutado! ✅`;
        if (estado === 'CANCELADO' || estado === 'RECHAZADO') return `Tu pedido #${idPedido} fue CANCELADO. ❌`;
        if (estado === 'REEMBOLSO SOLICITADO') return `Tu pedido #${idPedido} está marcado con una incidencia. Estamos revisando tu solicitud de reembolso. 💳`;
        
        return `El estado de tu pedido #${idPedido} es: ${estado}.`;
      } else {
        return `No he encontrado ningún pedido con el número #${idPedido} asociado a tu cuenta. ¿Estás seguro de que lo has escrito bien?`;
      }
    } catch (error) {
      console.error("Error buscando el pedido en la BD:", error);
      return "Ha habido un problema al buscar tu pedido en la base de datos. Inténtalo de nuevo.";
    }
  }

  // 2. LÓGICA SI EL USUARIO NO HA DADO UN NÚMERO DE PEDIDO (INTERACCIONES PREVIAS)
  if (quiereReembolso && !matchId) {
    return 'Para poder procesar tu solicitud de reembolso directamente desde aquí, por favor dime **"Reembolso" seguido de tu número de pedido** (por ejemplo: "Reembolso 15").';
  }

  const preguntaPorPedido = ['donde', 'dónde', 'pedido', 'estado', 'seguimiento', 'reparto'].some(c => textoLimpio.includes(c));
  if (preguntaPorPedido && !matchId) {
    if (quiereCancelar) {
      return 'Para poder cancelar tu pedido de forma segura, por favor, dime **"Cancelar" seguido del número de tu pedido** (por ejemplo: "Cancelar 15").';
    }
    return 'Para poder revisar exactamente dónde está tu comida, por favor, **dime el número de tu pedido** (por ejemplo: "mi pedido es el 15").';
  }

  // 3. RESPUESTAS GENÉRICAS / PREGUNTAS FRECUENTES
  for (const item of CONOCIMIENTO_SOPORTE) {
    const coincide = item.claves.some((clave) => textoLimpio.includes(clave));
    if (coincide) {
      return item.respuesta;
    }
  }

  // Mensaje por defecto si no entiende la consulta
  return 'He recibido tu consulta. Si tienes un problema con un pedido, escribe la palabra clave (ej. Cancelar, Reembolso o Dónde está) seguida de tu número de pedido.';
}