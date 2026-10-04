import { GraphQLError } from 'graphql';

const tarjetaNoDisponible = () => new GraphQLError(
  'Esta tarjeta ya no está disponible. Añádela de nuevo para pagar.',
  { extensions: { code: 'TARJETA_NO_DISPONIBLE' } },
);

export function crearOperacionesPago(pool, stripe) {
  const exigirUsuario = contexto => {
    const id = contexto?.usuario?.id_usuario;
    if (!id) throw new GraphQLError('Inicia sesión para gestionar tus tarjetas.', { extensions: { code: 'UNAUTHENTICATED' } });
    return id;
  };

  const obtenerCliente = async (idUsuario, crear = false) => {
    const { rows } = await pool.query('SELECT stripe_customer_id FROM Usuarios WHERE id_usuario = $1', [idUsuario]);
    if (!rows[0]) throw new Error('La cuenta no existe.');
    if (rows[0].stripe_customer_id || !crear) return rows[0].stripe_customer_id;

    // La fila bloqueada evita crear clientes diferentes en dos peticiones simultáneas.
    const conexion = await pool.connect();
    try {
      await conexion.query('BEGIN');
      const { rows: usuarios } = await conexion.query(
        'SELECT nombre, email, stripe_customer_id FROM Usuarios WHERE id_usuario = $1 FOR UPDATE', [idUsuario],
      );
      const usuario = usuarios[0];
      if (!usuario) throw new Error('La cuenta no existe.');
      let cliente = usuario.stripe_customer_id;
      if (!cliente) {
        const nuevo = await stripe.customers.create({
          name: usuario.nombre, email: usuario.email, metadata: { id_usuario: String(idUsuario) },
        }, { idempotencyKey: 'nexbite-cliente-' + idUsuario });
        cliente = nuevo.id;
        await conexion.query('UPDATE Usuarios SET stripe_customer_id = $1 WHERE id_usuario = $2', [cliente, idUsuario]);
      }
      await conexion.query('COMMIT');
      return cliente;
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    } finally {
      conexion.release();
    }
  };

  const comprobarTarjeta = async (id, cliente) => {
    if (!cliente || !/^pm_[a-zA-Z0-9]+$/.test(id)) throw tarjetaNoDisponible();
    let tarjeta;
    try {
      tarjeta = await stripe.paymentMethods.retrieve(id);
    } catch (error) {
      if (error.code === 'resource_missing') throw tarjetaNoDisponible();
      throw error;
    }
    const propietario = typeof tarjeta.customer === 'string' ? tarjeta.customer : tarjeta.customer?.id;
    if (tarjeta.type !== 'card' || propietario !== cliente) throw tarjetaNoDisponible();
    return tarjeta;
  };

  const ejecutar = async (accion, mensaje) => {
    try {
      return await accion();
    } catch (error) {
      if (error instanceof GraphQLError) throw error;
      console.error('Error en la pasarela de pago:', error.code || error.type || 'CONEXION');
      throw new GraphQLError(mensaje, { extensions: { code: 'PASARELA_NO_DISPONIBLE' } });
    }
  };

  return {
    Query: {
      obtenerMisTarjetas: async (_, { id_usuario }, contexto) => {
        const idUsuario = exigirUsuario(contexto);
        if (String(id_usuario) !== String(idUsuario)) throw new GraphQLError('Solo puedes consultar tus propias tarjetas.');
        return ejecutar(async () => {
          const cliente = await obtenerCliente(idUsuario);
          if (!cliente) return [];
          const tarjetas = await stripe.paymentMethods.list({ customer: cliente, type: 'card', limit: 100 });
          return tarjetas.data.map(tarjeta => ({
            id: tarjeta.id, brand: tarjeta.card.brand, last4: tarjeta.card.last4,
            name: tarjeta.billing_details?.name || '',
          }));
        }, 'No se han podido cargar tus tarjetas. Inténtalo de nuevo.');
      },
    },
    Mutation: {
      crearConfiguracionTarjeta: async (_, __, contexto) => {
        const idUsuario = exigirUsuario(contexto);
        return ejecutar(async () => {
          const cliente = await obtenerCliente(idUsuario, true);
          const configuracion = await stripe.setupIntents.create({
            customer: cliente, payment_method_types: ['card'], usage: 'on_session',
          });
          return configuracion.client_secret;
        }, 'No se ha podido preparar el guardado de la tarjeta. Inténtalo de nuevo.');
      },
      eliminarTarjetaGuardada: async (_, { id_tarjeta }, contexto) => {
        const idUsuario = exigirUsuario(contexto);
        return ejecutar(async () => {
          const cliente = await obtenerCliente(idUsuario);
          await comprobarTarjeta(id_tarjeta, cliente);
          await stripe.paymentMethods.detach(id_tarjeta);
          return true;
        }, 'No se ha podido eliminar la tarjeta. Inténtalo de nuevo.');
      },
      crearIntencionPago: async (_, { monto, id_tarjeta, clave_pago }, contexto) => {
        const idUsuario = exigirUsuario(contexto);
        const importe = Math.round(monto * 100);
        if (!Number.isFinite(monto) || importe < 50 || importe > 99999999) throw new GraphQLError('El importe del pago no es válido.');
        if (!/^[a-zA-Z0-9-]{16,64}$/.test(clave_pago)) throw new GraphQLError('El identificador del pago no es válido.');
        return ejecutar(async () => {
          const cliente = await obtenerCliente(idUsuario);
          await comprobarTarjeta(id_tarjeta, cliente);
          const intencion = await stripe.paymentIntents.create({
            amount: importe, currency: 'eur', customer: cliente,
            payment_method: id_tarjeta, payment_method_types: ['card'],
          }, { idempotencyKey: 'nexbite-pago-' + idUsuario + '-' + clave_pago });
          return intencion.client_secret;
        }, 'No se ha podido iniciar el pago. Inténtalo de nuevo.');
      },
    },
  };
}
