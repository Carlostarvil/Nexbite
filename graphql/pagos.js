import { GraphQLError } from 'graphql';

// EXPLICACIÓN DEL ERROR PERSONALIZADO:
// Función flecha '() =>' (sin parámetros) que fabrica un error estándar.
// 'extensions: { code }' añade un código técnico. Así, el programador de la App móvil
// puede leer 'TARJETA_NO_DISPONIBLE' internamente y mostrar un diseño o pop-up específico.
const tarjetaNoDisponible = () => new GraphQLError(
  'Esta tarjeta ya no está disponible. Añádela de nuevo para pagar.',
  { extensions: { code: 'TARJETA_NO_DISPONIBLE' } },
);

// FÁBRICA DE OPERACIONES DE PAGO
// Recibe el 'pool' (conexión a Base de Datos) y 'stripe' (conexión al Banco) 
// desde fuera. Esto se llama Inyección de Dependencias y evita guardar contraseñas aquí.
export function crearOperacionesPago(pool, stripe) {
  
  // FUNCIÓN AYUDANTE: Valida que haya un usuario en la sesión.
  const exigirUsuario = contexto => {
    const id = contexto?.usuario?.id_usuario;
    // 'throw' detiene la ejecución en seco y "escupe" el error hacia afuera.
    if (!id) throw new GraphQLError('Inicia sesión para gestionar tus tarjetas.', { extensions: { code: 'UNAUTHENTICATED' } });
    return id;
  };

  // FUNCIÓN INTERNA: Busca o crea el perfil del cliente en Stripe.
  // 'crear = false' es un parámetro por defecto. Si no le decimos nada, asume Falso.
  const obtenerCliente = async (idUsuario, crear = false) => {
    
    // DESESTRUCTURACIÓN: Extrae exclusivamente la variable 'rows' del paquete gigante que devuelve la BD.
    const { rows } = await pool.query('SELECT stripe_customer_id FROM Usuarios WHERE id_usuario = $1', [idUsuario]);
    if (!rows[0]) throw new Error('La cuenta no existe.');
    
    // CONDICIONAL LÓGICO (||): Si el usuario ya tiene ID de Stripe, O si la orden es NO crear (!crear), termina y devuelve el ID.
    if (rows[0].stripe_customer_id || !crear) return rows[0].stripe_customer_id;

    // TRANSACCIÓN SQL SEGURA:
    // La fila bloqueada (FOR UPDATE) evita crear clientes diferentes en Stripe 
    // si el usuario hace dos peticiones simultáneas (ej: doble clic rápido).
    const conexion = await pool.connect();
    try {
      await conexion.query('BEGIN');
      
      // DESESTRUCTURACIÓN CON RENOMBRAMIENTO: Extrae 'rows' pero lo bautiza como 'usuarios' para no confundir.
      const { rows: usuarios } = await conexion.query(
        'SELECT nombre, email, stripe_customer_id FROM Usuarios WHERE id_usuario = $1 FOR UPDATE', [idUsuario],
      );
      const usuario = usuarios[0];
      if (!usuario) throw new Error('La cuenta no existe.');
      
      let cliente = usuario.stripe_customer_id;
      if (!cliente) {
        // LLAMADA A STRIPE (Creación segura):
        // 'idempotencyKey' asegura que si la red parpadea y la orden se envía dos veces,
        // Stripe reconozca la llave y no cree dos clientes clonados en su sistema.
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
    // EXPRESIÓN REGULAR Y SEGURIDAD: 
    // Comprueba que el ID empiece obligatoriamente por 'pm_' seguido de letras/números.
    // Si alguien intenta inyectar código malicioso SQL en el ID de la tarjeta, lo rechaza al instante.
    if (!cliente || !/^pm_[a-zA-Z0-9]+$/.test(id)) throw tarjetaNoDisponible();
    
    let tarjeta;
    try {
      // .retrieve(): Va a Stripe y "recupera" todos los detalles reales de esta tarjeta.
      tarjeta = await stripe.paymentMethods.retrieve(id);
    } catch (error) {
      if (error.code === 'resource_missing') throw tarjetaNoDisponible();
      throw error;
    }
    
    // TYPEOF: Operador de JavaScript que te dice de qué "tipo" es una variable.
    // Aquí evalúa si Stripe devolvió el cliente como un simple texto ('string') o como un objeto.
    const propietario = typeof tarjeta.customer === 'string' ? tarjeta.customer : tarjeta.customer?.id;
    if (tarjeta.type !== 'card' || propietario !== cliente) throw tarjetaNoDisponible();
    
    return tarjeta;
  };

  // ENVOLTORIO GENÉRICO (Guardaespaldas):
  // Atrapa cualquier error desconocido de la pasarela (ej: Stripe se cae o pierde conexión) 
  // y devuelve un error limpio de GraphQL para que la App no colapse.
  const ejecutar = async (accion, mensaje) => {
    try {
      return await accion();
    } catch (error) {
      if (error instanceof GraphQLError) throw error;
      console.error('Error en la pasarela de pago:', error.code || error.type || 'CONEXION');
      throw new GraphQLError(mensaje, { extensions: { code: 'PASARELA_NO_DISPONIBLE' } });
    }
  };

  // ============================================================================
  // EXPLICACIÓN DE GRAPHQL (Query vs Mutation):
  // ============================================================================
  return {
    
    // QUERY: Consultas de lectura. Sirven para descargar o ver datos (GET). No modifican la base de datos.
    Query: {
      obtenerMisTarjetas: async (_, { id_usuario }, contexto) => {
        const idUsuario = exigirUsuario(contexto);
        if (String(id_usuario) !== String(idUsuario)) throw new GraphQLError('Solo puedes consultar tus propias tarjetas.');
        
        return ejecutar(async () => {
          const cliente = await obtenerCliente(idUsuario);
          if (!cliente) return [];
          
          // .list(): Pide a Stripe el listado de tarjetas guardadas por este cliente.
          const tarjetas = await stripe.paymentMethods.list({ customer: cliente, type: 'card', limit: 100 });
          
          // .map(): Filtra el paquete gigante devuelto por Stripe y entrega al frontend solo los datos esenciales limpios.
          return tarjetas.data.map(tarjeta => ({
            id: tarjeta.id, brand: tarjeta.card.brand, last4: tarjeta.card.last4,
            name: tarjeta.billing_details?.name || '',
          }));
        }, 'No se han podido cargar tus tarjetas. Inténtalo de nuevo.');
      },
    },
    
    // MUTATION: Mutaciones. Sirven para escribir, crear, modificar o borrar datos (POST/PUT/DELETE).
    Mutation: {
      crearConfiguracionTarjeta: async (_, __, contexto) => {
        const idUsuario = exigirUsuario(contexto);
        
        return ejecutar(async () => {
          // Pasa 'true' al parámetro 'crear' para obligar a generar el cliente en Stripe si aún no existe.
          const cliente = await obtenerCliente(idUsuario, true);
          
          // setupIntents.create: Pide a Stripe un permiso especial ('on_session') para guardar 
          // la tarjeta de este cliente y poder cobrarle en el futuro sin pedirle los números otra vez.
          const configuracion = await stripe.setupIntents.create({
            customer: cliente, payment_method_types: ['card'], usage: 'on_session',
          });
          
          // Devuelve el 'client_secret', una contraseña temporal que la App móvil necesita para cargar el formulario de pago seguro.
          return configuracion.client_secret;
        }, 'No se ha podido preparar el guardado de la tarjeta. Inténtalo de nuevo.');
      },
      
      eliminarTarjetaGuardada: async (_, { id_tarjeta }, contexto) => {
        const idUsuario = exigirUsuario(contexto);
        return ejecutar(async () => {
          const cliente = await obtenerCliente(idUsuario);
          await comprobarTarjeta(id_tarjeta, cliente);
          
          // .detach(): Ordena a Stripe que "desvincule" y borre la tarjeta de este cliente.
          await stripe.paymentMethods.detach(id_tarjeta);
          return true;
        }, 'No se ha podido eliminar la tarjeta. Inténtalo de nuevo.');
      },
      
      crearIntencionPago: async (_, __, contexto) => {
        exigirUsuario(contexto);
        throw new GraphQLError('Actualiza la página para pagar el carrito completo con su precio verificado.', { extensions: { code: 'CLIENTE_DESACTUALIZADO' } });
      },
    },
  };
}