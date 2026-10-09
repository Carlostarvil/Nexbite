import { GraphQLError } from 'graphql';
import { centimos, costeEnvio } from '../shared/preciosCompra.js';
import { recogidaDisponible, validarFechaRecogida } from '../shared/horariosRecogida.js';
import { validarZonaEntrega } from '../shared/zonaEntrega.js';
import { exigirUsuario, exigirLocalPropio } from './permisos.js';

const errorCompra = (mensaje, code = 'COMPRA_NO_VALIDA') => new GraphQLError(mensaje, { extensions: { code } });
const fechaISO = fecha => fecha ? new Date(fecha).toISOString() : null;
const idStripe = valor => typeof valor === 'string' ? valor : valor?.id;
const finales = new Set(['CANCELADA', 'REEMBOLSADA', 'REEMBOLSO_FALLIDO']);

export function normalizarSolicitud(input) {
  if (!input || !/^[a-zA-Z0-9-]{16,64}$/.test(input.clave)) throw errorCompra('El identificador de la compra no es válido.');
  if (!/^[1-9]\d*$/.test(String(input.id_restaurante))) throw errorCompra('Selecciona un local válido.');
  if (!['TARJETA', 'EFECTIVO'].includes(input.metodo_pago) || !['DOMICILIO', 'RECOGIDA'].includes(input.tipo_entrega)) throw errorCompra('Selecciona el método de pago y la entrega.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50) throw errorCompra('El carrito está vacío o contiene demasiados productos.');
  const cantidades = new Map();
  for (const item of input.items) {
    if (!/^[1-9]\d*$/.test(String(item.id_plato)) || !Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 100) throw errorCompra('La cantidad de productos no es válida.');
    cantidades.set(String(item.id_plato), (cantidades.get(String(item.id_plato)) || 0) + item.cantidad);
  }
  if ([...cantidades.values()].reduce((a, b) => a + b, 0) > 100) throw errorCompra('Puedes pedir hasta 100 unidades por compra.');
  let fecha = null;
  if (input.fecha_programada) {
    const instante = new Date(input.fecha_programada);
    if (Number.isNaN(instante.getTime())) throw errorCompra('Selecciona una fecha válida para la reserva.');
    fecha = instante.toISOString();
  }
  return {
    clave: input.clave, id_restaurante: String(input.id_restaurante),
    items: [...cantidades].sort((a, b) => Number(a[0]) - Number(b[0])).map(([id_plato, cantidad]) => ({ id_plato, cantidad })),
    metodo_pago: input.metodo_pago, id_tarjeta: input.metodo_pago === 'TARJETA' ? input.id_tarjeta || null : null,
    tipo_entrega: input.tipo_entrega,
    direccion_envio: input.tipo_entrega === 'RECOGIDA' ? 'RECOGIDA EN LOCAL' : String(input.direccion_envio || '').trim(),
    latitud_cliente: input.tipo_entrega === 'DOMICILIO' ? input.latitud_cliente ?? null : null,
    longitud_cliente: input.tipo_entrega === 'DOMICILIO' ? input.longitud_cliente ?? null : null,
    fecha_programada: fecha,
  };
}

// Una clave identifica una compra completa. Los bloqueos e idempotencia evitan
// duplicados incluso cuando el navegador reintenta o el servidor se reinicia.
export function crearServicioCompras(pool, stripe, { ahora = () => new Date(), notificar = async () => {} } = {}) {
  async function conBloqueo(clave, accion) {
    const conexion = await pool.connect();
    let bloqueado = false;
    try {
      bloqueado = (await conexion.query('SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS bloqueado', ['compra:' + clave])).rows[0].bloqueado;
      if (!bloqueado) throw errorCompra('Esta compra se está procesando. Espera unos segundos y vuelve a comprobarla.', 'COMPRA_EN_PROCESO');
      return await accion(conexion);
    } finally {
      try { if (bloqueado) await conexion.query('SELECT pg_advisory_unlock(hashtext($1)::bigint)', ['compra:' + clave]); }
      finally { conexion.release(); }
    }
  }

  const leer = async (cx, clave) => (await cx.query('SELECT * FROM Compras WHERE id_compra = $1', [clave])).rows[0];
  const cambiar = async (cx, compra, estado, motivo = null) => {
    const res = await cx.query("UPDATE Compras SET estado = $2, motivo = $3, actualizada = NOW(), notificada = CASE WHEN estado = 'RESERVADA' THEN FALSE ELSE notificada END WHERE id_compra = $1 RETURNING *", [compra.id_compra, estado, motivo]);
    return res.rows[0];
  };

  async function cotizar(cx, solicitud, fase = 'preparar') {
    const momento = ahora();
    await cx.query(`UPDATE Restaurantes SET aceptando_pedidos = TRUE, tiempo_reactivacion = NULL WHERE id_restaurante = $1 AND aceptando_pedidos = FALSE AND NULLIF(tiempo_reactivacion::text, '')::timestamptz <= $2::timestamptz`, [solicitud.id_restaurante, momento]);
    await cx.query(`UPDATE Platos SET disponible = TRUE, tiempo_disponible = NULL WHERE id_restaurante = $1 AND disponible = FALSE AND NULLIF(tiempo_disponible::text, '')::timestamptz <= $2::timestamptz`, [solicitud.id_restaurante, momento]);
    const local = (await cx.query('SELECT * FROM Restaurantes WHERE id_restaurante = $1 FOR SHARE', [solicitud.id_restaurante])).rows[0];
    if (!local) throw errorCompra('El local ya no está disponible.');
    const ids = solicitud.items.map(item => item.id_plato);
    // UNION evita ciclos en menús antiguos; también se comprueban sus componentes.
    const productos = (await cx.query(`
      WITH RECURSIVE componentes(id) AS (
        SELECT unnest($1::int[])
        UNION SELECT mp.id_plato_incluido FROM Menu_Platos mp JOIN componentes c ON mp.id_menu = c.id
      )
      SELECT p.* FROM Platos p WHERE p.id_plato IN (SELECT id FROM componentes)
      ORDER BY p.id_plato FOR SHARE
    `, [ids])).rows;
    if (productos.some(p => String(p.id_restaurante) !== solicitud.id_restaurante) || ids.some(id => !productos.some(p => String(p.id_plato) === id))) throw errorCompra('Selecciona productos existentes de este mismo local.');
    const composicion_menu = (await cx.query('SELECT id_menu, id_plato_incluido FROM Menu_Platos WHERE id_menu = ANY($1::int[]) ORDER BY id_menu, id_plato_incluido FOR SHARE', [productos.map(p => p.id_plato)])).rows.map(v => [v.id_menu, v.id_plato_incluido]);
    const programada = solicitud.fecha_programada ? new Date(solicitud.fecha_programada) : null;
    const activando = fase.startsWith('activar');
    if (programada && !activando) {
      const minimo = fase === 'preparar' ? 15 * 60_000 : 0;
      if (programada.getTime() < momento.getTime() + minimo || programada.getTime() > momento.getTime() + 7 * 86400_000) throw errorCompra('Elige una hora futura: entre 15 minutos y 7 días al reservar.');
    }
    const objetivo = programada && !activando ? programada : momento;
    const comprobar = (disponible, reactivacion, nombre) => {
      if (disponible !== false) return;
      if (!reactivacion || new Date(reactivacion) > objetivo) throw errorCompra(`${nombre} no estará disponible a esa hora. Elige otra hora o retira el producto del carrito.`, 'NO_DISPONIBLE');
    };
    comprobar(local.aceptando_pedidos, local.tiempo_reactivacion, 'El local');
    for (const producto of productos) comprobar(producto.disponible, producto.tiempo_disponible, '«' + producto.nombre + '»');
    const recogida = solicitud.tipo_entrega === 'RECOGIDA';
    let distancia = 0;
    if (recogida) {
      if (programada && !activando) {
        // La confirmación conserva el margen validado al preparar la compra.
        const referencia = fase === 'preparar' ? momento : new Date(Math.min(momento.getTime(), programada.getTime() - 15 * 60_000));
        validarFechaRecogida(local.horarios_recogida, solicitud.fecha_programada, referencia);
      } else if (!recogidaDisponible(local.horarios_recogida, momento)) throw errorCompra('La recogida no está disponible ahora.', 'NO_DISPONIBLE');
    } else if (fase !== 'activar-antiguo') {
      if (!solicitud.direccion_envio || solicitud.direccion_envio.length > 1000) throw errorCompra('Introduce una dirección de entrega válida.');
      distancia = validarZonaEntrega(local, solicitud.latitud_cliente, solicitud.longitud_cliente);
    }
    const items = solicitud.items.map(item => {
      const producto = productos.find(p => String(p.id_plato) === item.id_plato);
      const precio_centimos = centimos(producto.precio);
      return { ...item, nombre: producto.nombre, precio_centimos, precio: precio_centimos / 100 };
    });
    const subtotal_centimos = items.reduce((suma, item) => suma + item.precio_centimos * item.cantidad, 0);
    const envio_centimos = costeEnvio(subtotal_centimos, local.tipo, distancia, recogida);
    const total_centimos = subtotal_centimos + envio_centimos;
    if (total_centimos > 99999999 || solicitud.metodo_pago === 'TARJETA' && total_centimos < 50) throw errorCompra('El importe de la compra no es válido.');
    return { items, subtotal_centimos, envio_centimos, total_centimos, composicion_menu, nombre_restaurante: local.nombre };
  }

  async function recuperarIntencion(compra) {
    if (!compra.payment_intent_id) return null;
    return stripe.paymentIntents.retrieve(compra.payment_intent_id, { expand: ['latest_charge'] });
  }

  function comprobarIntencion(compra, intencion) {
    if (intencion.id !== compra.payment_intent_id || intencion.amount !== compra.total_centimos || intencion.currency !== 'eur' || intencion.capture_method !== 'manual' || idStripe(intencion.payment_method) !== compra.solicitud.id_tarjeta || intencion.metadata?.id_compra !== compra.id_compra || intencion.metadata?.id_usuario !== String(compra.id_usuario)) throw errorCompra('No se ha podido verificar el pago de esta compra.', 'PAGO_NO_VERIFICADO');
  }

  async function resultado(cx, compra, intencion = null) {
    const pedidos = (await cx.query('SELECT * FROM Pedidos WHERE id_compra = $1 ORDER BY id_pedido', [compra.id_compra])).rows;
    const mensajes = {
      BORRADOR: 'Revisa el importe y confirma la compra.',
      AUTORIZADA: 'El pedido completo está guardado. Estamos confirmando el pago; no vuelvas a pagar.',
      RESERVADA: compra.solicitud.metodo_pago === 'TARJETA' ? 'Reserva confirmada. El banco retiene el importe; se cobrará a la hora reservada, cuando todo esté disponible. Si no lo está en los 30 minutos siguientes, cancelaremos la reserva y liberaremos la retención.' : 'Reserva confirmada. Se enviará al local a la hora elegida, cuando todo esté disponible. Si no lo está en los 30 minutos siguientes, se cancelará.',
      CONFIRMADA: 'El local ha recibido tu pedido completo.',
      CANCELANDO: 'Compra cancelada. Estamos liberando la autorización de tu tarjeta.',
      CANCELADA: 'Compra cancelada. No se ha efectuado ningún cobro.',
      REEMBOLSO_PENDIENTE: 'Compra cancelada. Estamos tramitando la devolución del pago.',
      REEMBOLSADA: 'La devolución se ha tramitado. Tu banco determina cuándo aparece en tu cuenta.',
      REEMBOLSO_FALLIDO: 'El banco no ha completado la devolución. Contacta con el local para resolverla.',
    };
    return {
      id_compra: compra.id_compra, estado: compra.estado, subtotal: compra.resumen.subtotal_centimos / 100,
      envio: compra.resumen.envio_centimos / 100, total: compra.total_centimos / 100,
      client_secret: compra.estado === 'BORRADOR' ? intencion?.client_secret || null : null,
      fecha_programada: compra.solicitud.fecha_programada, autorizacion_hasta: fechaISO(compra.autorizacion_hasta),
      items: compra.resumen.items, pedidos: pedidos.map(p => ({ ...p, estado_pago: compra.estado, nombre_plato: p.nombre_producto, precio_plato: p.precio_centimos / 100 })), mensaje: compra.motivo || mensajes[compra.estado] || 'Estamos comprobando la compra.',
    };
  }

  async function notificarUnaVez(cx, compra) {
    if (compra.notificada || !['RESERVADA', 'CONFIRMADA'].includes(compra.estado)) return;
    try {
      await notificar(compra, (await cx.query('SELECT * FROM Pedidos WHERE id_compra = $1', [compra.id_compra])).rows, cx);
      await cx.query('UPDATE Compras SET notificada = TRUE WHERE id_compra = $1', [compra.id_compra]);
    } catch (error) { console.error('No se pudo notificar la compra:', error.code || 'NOTIFICACION'); }
  }

  async function finalizarCancelacion(cx, compra) {
    if (!compra.payment_intent_id) return cambiar(cx, compra, 'CANCELADA', compra.motivo);
    try {
      const intencion = await recuperarIntencion(compra);
      comprobarIntencion(compra, intencion);
      if (intencion.status === 'succeeded') {
        const devolucion = compra.refund_id ? await stripe.refunds.retrieve(compra.refund_id) : await stripe.refunds.create({ payment_intent: intencion.id }, { idempotencyKey: 'nexbite-reembolso-' + compra.id_compra });
        if (!compra.refund_id) await cx.query('UPDATE Compras SET refund_id = $2 WHERE id_compra = $1', [compra.id_compra, devolucion.id]);
        if (devolucion.status === 'succeeded') return cambiar(cx, compra, 'REEMBOLSADA');
        if (['failed', 'canceled'].includes(devolucion.status)) return cambiar(cx, compra, 'REEMBOLSO_FALLIDO', 'El banco no ha completado la devolución. Contacta con el local para resolverla.');
        // retrieve devuelve el estado actual; repetir create devolvería la
        // respuesta original guardada por la clave de idempotencia.
        return cambiar(cx, compra, 'REEMBOLSO_PENDIENTE', 'La devolución del pago está pendiente de confirmación.');
      }
      if (intencion.status !== 'canceled') await stripe.paymentIntents.cancel(intencion.id, {}, { idempotencyKey: 'nexbite-cancelar-' + compra.id_compra });
      return cambiar(cx, compra, 'CANCELADA', compra.motivo);
    } catch (error) {
      console.error('Cancelación pendiente de conciliar:', error.code || 'CONEXION');
      return compra;
    }
  }

  async function cancelar(cx, compra, motivo) {
    if (finales.has(compra.estado)) return compra;
    await cx.query('BEGIN');
    try {
      compra = await cambiar(cx, compra, 'CANCELANDO', motivo);
      await cx.query("UPDATE Pedidos SET estado = 'CANCELADO' WHERE id_compra = $1", [compra.id_compra]);
      await cx.query('COMMIT');
    } catch (error) { await cx.query('ROLLBACK'); throw error; }
    return finalizarCancelacion(cx, compra);
  }

  async function capturar(cx, compra, intencion) {
    comprobarIntencion(compra, intencion);
    if (intencion.status === 'requires_capture') {
      try {
        intencion = await stripe.paymentIntents.capture(intencion.id, {}, { idempotencyKey: 'nexbite-capturar-' + compra.id_compra });
      } catch (error) {
        // Tras una respuesta perdida, recuperar Stripe permite conocer el resultado
        // sin repetir el pedido. El trabajador retoma esta compra al reiniciar.
        console.error('Pago pendiente de conciliar:', error.code || 'CONEXION');
        return compra;
      }
    }
    if (intencion.status === 'succeeded') {
      if (intencion.amount_received !== compra.total_centimos) return cancelar(cx, compra, 'El importe recibido no coincide con el pedido. Se ha cancelado y se tramitará su devolución.');
      await cx.query('BEGIN');
      try {
        compra = await cambiar(cx, compra, 'CONFIRMADA');
        await cx.query("UPDATE Pedidos SET estado = 'PENDIENTE' WHERE id_compra = $1 AND estado = 'PROGRAMADO'", [compra.id_compra]);
        await cx.query('COMMIT');
      } catch (error) { await cx.query('ROLLBACK'); throw error; }
      await notificarUnaVez(cx, compra);
      return compra;
    }
    if (intencion.status === 'canceled') return cancelar(cx, compra, 'La autorización bancaria ha caducado. No se ha cobrado la compra.');
    return compra;
  }

  async function confirmarInterna(cx, compra) {
    if (compra.estado !== 'BORRADOR') return compra;
    let intencion = null;
    if (compra.solicitud.metodo_pago === 'TARJETA') {
      intencion = await recuperarIntencion(compra);
      comprobarIntencion(compra, intencion);
      if (intencion.status === 'canceled') return cancelar(cx, compra, 'La autorización se ha cancelado. No se ha cobrado la compra.');
      if (intencion.status !== 'requires_capture') throw errorCompra('Completa la autorización de tu tarjeta para confirmar el pedido.', 'AUTORIZACION_PENDIENTE');
      const limite = intencion.latest_charge?.payment_method_details?.card?.capture_before;
      const vencimiento = new Date(limite ? limite * 1000 : (intencion.created * 1000 || ahora().getTime()) + 5 * 86400_000);
      if (new Date(compra.solicitud.fecha_programada || ahora()) >= new Date(vencimiento.getTime() - 30 * 60_000)) {
        await cancelar(cx, compra, 'La fecha elegida supera la autorización de esta tarjeta. Reserva con efectivo o elige una hora más cercana.');
        throw errorCompra('La fecha elegida supera la autorización de esta tarjeta. No se ha cobrado: reserva con efectivo o elige otra hora.', 'AUTORIZACION_CORTA');
      }
      await cx.query('UPDATE Compras SET autorizacion_hasta = $2 WHERE id_compra = $1', [compra.id_compra, vencimiento]);
      compra.autorizacion_hasta = vencimiento;
    }
    try {
      await cx.query('BEGIN');
      const resumen = await cotizar(cx, compra.solicitud, 'confirmar');
      if (resumen.total_centimos !== compra.total_centimos || resumen.items.some((item, i) => item.precio_centimos !== compra.resumen.items[i].precio_centimos) || JSON.stringify(resumen.composicion_menu) !== JSON.stringify(compra.resumen.composicion_menu)) throw errorCompra('Los precios o los productos del menú han cambiado. Revisa el carrito antes de confirmar otra compra.', 'PRECIO_ACTUALIZADO');
      const estadoPedido = compra.solicitud.fecha_programada ? 'PROGRAMADO' : 'PENDIENTE';
      for (const item of compra.resumen.items) {
        await cx.query(`
          INSERT INTO Pedidos (id_usuario, id_restaurante, id_plato, metodo_pago, direccion_envio, fecha_programada, estado, id_compra, precio_centimos, nombre_producto)
          SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10 FROM generate_series(1, $11::int)
        `, [compra.id_usuario, compra.id_restaurante, item.id_plato, compra.solicitud.metodo_pago, compra.solicitud.direccion_envio, compra.solicitud.fecha_programada, estadoPedido, compra.id_compra, item.precio_centimos, item.nombre, item.cantidad]);
      }
      compra = await cambiar(cx, compra, compra.solicitud.fecha_programada ? 'RESERVADA' : intencion ? 'AUTORIZADA' : 'CONFIRMADA');
      await cx.query('UPDATE Usuarios SET puntos_acumulados = puntos_acumulados + 10 WHERE id_usuario = $1', [compra.id_usuario]);
      await cx.query('COMMIT');
    } catch (error) {
      await cx.query('ROLLBACK');
      // Todavía no se ha cobrado. Se anula la retención si cualquier unidad falla.
      await cancelar(cx, await leer(cx, compra.id_compra), error.message);
      throw error;
    }
    if (compra.estado === 'AUTORIZADA') compra = await capturar(cx, compra, intencion);
    await notificarUnaVez(cx, compra);
    return compra;
  }

  async function preparar(input, contexto) {
    const usuario = exigirUsuario(contexto);
    const solicitud = normalizarSolicitud(input);
    return conBloqueo(solicitud.clave, async cx => {
      let compra = await leer(cx, solicitud.clave);
      if (compra) {
        if (String(compra.id_usuario) !== usuario) throw errorCompra('Esta compra no pertenece a tu cuenta.', 'FORBIDDEN');
        if (JSON.stringify(compra.solicitud) !== JSON.stringify(solicitud)) {
          // JSONB puede ordenar las propiedades; comparar su forma normalizada.
          if (JSON.stringify(normalizarSolicitud(compra.solicitud)) !== JSON.stringify(solicitud)) throw errorCompra('Usa un nuevo identificador para un carrito diferente.');
        }
        if (compra.estado !== 'BORRADOR') return resultado(cx, compra);
      }
      if (!compra) {
        await cx.query('BEGIN');
        try {
          const resumen = await cotizar(cx, solicitud);
          compra = (await cx.query('INSERT INTO Compras (id_compra, id_usuario, id_restaurante, solicitud, resumen, total_centimos) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6) RETURNING *', [solicitud.clave, usuario, solicitud.id_restaurante, JSON.stringify(solicitud), JSON.stringify(resumen), resumen.total_centimos])).rows[0];
          await cx.query('COMMIT');
        } catch (error) { await cx.query('ROLLBACK'); throw error; }
      }
      let intencion = null;
      if (solicitud.metodo_pago === 'TARJETA') {
        if (compra.payment_intent_id) intencion = await recuperarIntencion(compra);
        else {
          const cliente = (await cx.query('SELECT stripe_customer_id FROM Usuarios WHERE id_usuario = $1', [usuario])).rows[0]?.stripe_customer_id;
          if (!cliente || !/^pm_[a-zA-Z0-9]+$/.test(solicitud.id_tarjeta || '')) throw errorCompra('Selecciona una tarjeta guardada.');
          const tarjeta = await stripe.paymentMethods.retrieve(solicitud.id_tarjeta);
          if (tarjeta.type !== 'card' || idStripe(tarjeta.customer) !== cliente) throw errorCompra('La tarjeta no pertenece a tu cuenta.', 'FORBIDDEN');
          intencion = await stripe.paymentIntents.create({
            amount: compra.total_centimos, currency: 'eur', customer: cliente,
            payment_method: solicitud.id_tarjeta, payment_method_types: ['card'], capture_method: 'manual',
            metadata: { id_compra: compra.id_compra, id_usuario: usuario },
          }, { idempotencyKey: 'nexbite-compra-' + compra.id_compra });
          compra = (await cx.query('UPDATE Compras SET payment_intent_id = $2 WHERE id_compra = $1 RETURNING *', [compra.id_compra, intencion.id])).rows[0];
        }
      }
      return resultado(cx, compra, intencion);
    });
  }

  async function confirmar(clave, contexto) {
    const usuario = exigirUsuario(contexto);
    return conBloqueo(clave, async cx => {
      let compra = await leer(cx, clave);
      if (!compra || String(compra.id_usuario) !== usuario) throw errorCompra('Esta compra no pertenece a tu cuenta.', 'FORBIDDEN');
      compra = await confirmarInterna(cx, compra);
      if (compra.estado === 'AUTORIZADA') compra = await capturar(cx, compra, await recuperarIntencion(compra));
      return resultado(cx, compra);
    });
  }

  async function consultar(clave, contexto) {
    const usuario = exigirUsuario(contexto);
    return conBloqueo(clave, async cx => {
      let compra = await leer(cx, clave);
      if (!compra || String(compra.id_usuario) !== usuario) throw errorCompra('Esta compra no pertenece a tu cuenta.', 'FORBIDDEN');
      compra = await conciliar(cx, compra);
      return resultado(cx, compra, compra.estado === 'BORRADOR' && compra.payment_intent_id ? await recuperarIntencion(compra) : null);
    });
  }

  async function conciliar(cx, compra) {
    if (['CANCELANDO', 'REEMBOLSO_PENDIENTE'].includes(compra.estado)) return finalizarCancelacion(cx, compra);
    if (compra.estado === 'BORRADOR') {
      const intencion = compra.payment_intent_id && await recuperarIntencion(compra);
      if (intencion?.status === 'requires_capture') return confirmarInterna(cx, compra);
      if (intencion?.status === 'canceled' || ahora().getTime() - new Date(compra.creada).getTime() > 30 * 60_000) return cancelar(cx, compra, 'La compra no se confirmó a tiempo. No se ha cobrado.');
      return compra;
    }
    if (compra.estado === 'AUTORIZADA') return capturar(cx, compra, await recuperarIntencion(compra));
    if (compra.estado !== 'RESERVADA') return compra;
    const momento = ahora();
    if (compra.autorizacion_hasta && momento >= new Date(new Date(compra.autorizacion_hasta).getTime() - 5 * 60_000)) return cancelar(cx, compra, 'La autorización ha caducado antes de poder preparar el pedido. No se ha cobrado.');
    const fecha = new Date(compra.solicitud.fecha_programada);
    if (momento < fecha) return compra;
    if (momento > new Date(fecha.getTime() + 30 * 60_000)) return cancelar(cx, compra, 'El pedido no estuvo disponible a tiempo. La reserva se ha cancelado sin cobrar.');
    await cx.query('BEGIN');
    try {
      const resumen = await cotizar(cx, compra.solicitud, 'activar');
      if (JSON.stringify(resumen.composicion_menu) !== JSON.stringify(compra.resumen.composicion_menu)) throw errorCompra('Los productos incluidos en el menú han cambiado.');
      if (compra.solicitud.metodo_pago === 'EFECTIVO') {
        compra = await cambiar(cx, compra, 'CONFIRMADA');
        await cx.query("UPDATE Pedidos SET estado = 'PENDIENTE' WHERE id_compra = $1 AND estado = 'PROGRAMADO'", [compra.id_compra]);
      } else compra = await cambiar(cx, compra, 'AUTORIZADA');
      await cx.query('COMMIT');
    } catch (error) {
      await cx.query('ROLLBACK');
      if (error.extensions?.code === 'NO_DISPONIBLE') return compra;
      return cancelar(cx, compra, 'La reserva ya no se puede servir: ' + error.message);
    }
    if (compra.estado === 'AUTORIZADA') compra = await capturar(cx, compra, await recuperarIntencion(compra));
    await notificarUnaVez(cx, compra);
    return compra;
  }

  async function validarCambioPedido(idPedido, estado, conexion = pool) {
    const permitidos = ['PENDIENTE', 'EN COCINA', 'PREPARANDO', 'EN CAMINO', 'ENVIADO', 'ENTREGADO', 'CANCELADO', 'RECHAZADO'];
    if (!permitidos.includes(estado)) throw errorCompra('El estado del pedido no es válido.');
    const pedido = (await conexion.query('SELECT p.*, c.estado AS estado_compra FROM Pedidos p LEFT JOIN Compras c ON p.id_compra = c.id_compra WHERE p.id_pedido = $1', [idPedido])).rows[0];
    if (!pedido) throw errorCompra('El pedido no existe.');
    if (['ENTREGADO', 'CANCELADO', 'RECHAZADO'].includes(pedido.estado)) throw errorCompra('Este pedido ya ha finalizado.');
    if (!['CANCELADO', 'RECHAZADO'].includes(estado) && (pedido.fecha_programada && new Date(pedido.fecha_programada) > ahora() || pedido.estado === 'PROGRAMADO' || pedido.id_compra && pedido.estado_compra !== 'CONFIRMADA')) throw errorCompra('El pedido aún está reservado o pendiente de confirmar el pago.');
    const etapas = { PENDIENTE: 0, PREPARANDO: 1, 'EN COCINA': 1, ENVIADO: 2, 'EN CAMINO': 2, ENTREGADO: 3 };
    if (etapas[estado] < etapas[pedido.estado]) throw errorCompra('Un pedido no puede volver a un estado anterior.');
    return pedido;
  }

  async function cancelarPedido(idPedido, contexto, motivo = 'Cancelado por el cliente') {
    const usuario = exigirUsuario(contexto);
    let pedido = (await pool.query('SELECT * FROM Pedidos WHERE id_pedido = $1', [idPedido])).rows[0];
    if (!pedido) throw errorCompra('El pedido no existe.');
    if (contexto.usuario.rol === 'VENDEDOR') await exigirLocalPropio(pool, contexto, idPedido, 'pedido');
    else if (String(pedido.id_usuario) !== usuario) throw errorCompra('Este pedido no pertenece a tu cuenta.', 'FORBIDDEN');
    if (pedido.id_compra) {
      return conBloqueo(pedido.id_compra, async cx => {
        const pedidos = (await cx.query('SELECT * FROM Pedidos WHERE id_compra = $1', [pedido.id_compra])).rows;
        if (pedidos.some(p => !['PENDIENTE', 'PROGRAMADO', 'CANCELADO', 'RECHAZADO'].includes(p.estado))) throw errorCompra('La preparación ya ha empezado. Contacta con el local para resolver la incidencia.');
        const compra = await cancelar(cx, await leer(cx, pedido.id_compra), motivo);
        pedido = (await cx.query('SELECT * FROM Pedidos WHERE id_pedido = $1', [idPedido])).rows[0];
        return { ...pedido, estado_pago: compra.estado, mensaje_pago: (await resultado(cx, compra)).mensaje };
      });
    }
    if (!['PENDIENTE', 'PROGRAMADO', 'CANCELADO', 'RECHAZADO'].includes(pedido.estado)) throw errorCompra('La preparación ya ha empezado. Contacta con el local para resolver la incidencia.');
    pedido = (await pool.query("UPDATE Pedidos SET estado = 'CANCELADO' WHERE id_pedido = $1 AND estado IN ('PENDIENTE','PROGRAMADO','CANCELADO','RECHAZADO') RETURNING *", [idPedido])).rows[0];
    if (!pedido) throw errorCompra('El local ya ha empezado a preparar el pedido.');
    return { ...pedido, mensaje_pago: pedido.metodo_pago === 'TARJETA' ? 'Pedido antiguo cancelado. Consulta con el local para verificar la devolución de su pago.' : 'Pedido cancelado. No hay ningún cobro con tarjeta.' };
  }

  async function procesarPendientes() {
    const pendientes = (await pool.query(`
      SELECT id_compra FROM Compras
      WHERE estado IN ('BORRADOR','AUTORIZADA','CANCELANDO','REEMBOLSO_PENDIENTE')
        OR estado = 'RESERVADA' AND ((solicitud->>'fecha_programada')::timestamptz <= $1 OR autorizacion_hasta <= $1::timestamptz + INTERVAL '5 minutes')
      ORDER BY CASE WHEN estado = 'BORRADOR' THEN 1 ELSE 0 END, actualizada LIMIT 100
    `, [ahora()])).rows;
    for (const { id_compra } of pendientes) {
      try { await conBloqueo(id_compra, async cx => {
        await cx.query('UPDATE Compras SET actualizada = NOW() WHERE id_compra = $1', [id_compra]);
        return conciliar(cx, await leer(cx, id_compra));
      }); }
      catch (error) { if (error.extensions?.code !== 'COMPRA_EN_PROCESO') console.error('Compra pendiente de revisar:', id_compra, error.code || error.extensions?.code || 'CONEXION'); }
    }
    // Los pedidos anteriores a esta migración conservan su fecha y su pago.
    const antiguos = (await pool.query(`
      SELECT pe.* FROM Pedidos pe JOIN Restaurantes r ON r.id_restaurante = pe.id_restaurante JOIN Platos p ON p.id_plato = pe.id_plato
      WHERE pe.id_compra IS NULL AND pe.estado = 'PROGRAMADO' AND NULLIF(pe.fecha_programada::text, '')::timestamptz <= $1::timestamptz
        AND (r.aceptando_pedidos IS DISTINCT FROM FALSE OR NULLIF(r.tiempo_reactivacion::text, '')::timestamptz <= $1::timestamptz)
        AND (p.disponible IS DISTINCT FROM FALSE OR NULLIF(p.tiempo_disponible::text, '')::timestamptz <= $1::timestamptz)
        AND NOT EXISTS (SELECT 1 FROM Menu_Platos mp JOIN Platos incluido ON incluido.id_plato = mp.id_plato_incluido WHERE mp.id_menu = pe.id_plato AND incluido.disponible = FALSE AND (incluido.tiempo_disponible IS NULL OR NULLIF(incluido.tiempo_disponible::text, '')::timestamptz > $1::timestamptz))
      ORDER BY pe.id_pedido LIMIT 100
    `, [ahora()])).rows;
    for (const pedido of antiguos) {
      try {
        await conBloqueo('antiguo-' + pedido.id_pedido, async cx => {
          await cx.query('BEGIN');
          try {
            await cotizar(cx, normalizarSolicitud({ clave: 'antiguo-pedido-' + pedido.id_pedido, id_restaurante: pedido.id_restaurante, items: [{ id_plato: pedido.id_plato, cantidad: 1 }], metodo_pago: 'EFECTIVO', tipo_entrega: pedido.direccion_envio?.toUpperCase().startsWith('RECOGIDA') ? 'RECOGIDA' : 'DOMICILIO' }), 'activar-antiguo');
            await cx.query("UPDATE Pedidos SET estado = 'PENDIENTE' WHERE id_pedido = $1 AND estado = 'PROGRAMADO' AND NULLIF(fecha_programada::text, '')::timestamptz <= $2::timestamptz", [pedido.id_pedido, ahora()]);
            await cx.query('COMMIT');
          } catch (error) { await cx.query('ROLLBACK'); throw error; }
        });
      } catch (error) { if (error.extensions?.code !== 'NO_DISPONIBLE') console.error('Reserva antigua pendiente:', pedido.id_pedido, error.extensions?.code || 'VALIDACION'); }
    }
  }

  const conPedidoBloqueado = async (idPedido, accion) => {
    const pedido = (await pool.query('SELECT id_compra FROM Pedidos WHERE id_pedido = $1', [idPedido])).rows[0];
    return conBloqueo(pedido?.id_compra || 'pedido-' + idPedido, cx => accion(cx));
  };

  return {
    preparar, confirmar, consultar, cancelarPedido, validarCambioPedido, procesarPendientes, conPedidoBloqueado,
    Query: { consultarCompra: (_, { id_compra }, ctx) => consultar(id_compra, ctx) },
    Mutation: {
      prepararCompra: (_, { input }, ctx) => preparar(input, ctx),
      confirmarCompra: (_, { id_compra }, ctx) => confirmar(id_compra, ctx),
    },
  };
}
