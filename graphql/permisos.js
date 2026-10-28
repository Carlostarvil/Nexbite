import { GraphQLError } from 'graphql';

// ============================================================================
// FUNCIONES BÁSICAS DE AUTENTICACIÓN
// ============================================================================

/**
 * EXIGIR USUARIO:
 * Comprueba que haya una sesión activa y devuelve el ID del usuario en formato texto.
 */
export function exigirUsuario(contexto) {
  const id = contexto?.usuario?.id_usuario;
  // Expresión Regular: Asegura que el ID sea un número matemático válido.
  if (!/^[1-9]\d*$/.test(String(id))) throw new GraphQLError('Inicia sesión para continuar.', { extensions: { code: 'UNAUTHENTICATED' } });
  return String(id);
}

/**
 * EXIGIR CUENTA PROPIA:
 * Evita que un usuario logueado intente descargar el perfil o el historial de otro usuario
 * modificando el ID en la URL o en la petición (Vulnerabilidad IDOR).
 */
export function exigirCuentaPropia(contexto, id) {
  if (exigirUsuario(contexto) !== String(id)) throw new GraphQLError('Solo puedes acceder a los datos de tu cuenta.', { extensions: { code: 'FORBIDDEN' } });
}

/**
 * EXIGIR LOCAL PROPIO:
 * Comprueba que el usuario logueado no solo sea "VENDEDOR", sino que sea el dueño legítimo 
 * del restaurante, plato o pedido específico que intenta modificar.
 */
export async function exigirLocalPropio(pool, contexto, id, entidad = 'local') {
  const usuario = exigirUsuario(contexto);
  
  if (contexto.usuario.rol !== 'VENDEDOR') throw new GraphQLError('Inicia sesión como vendedor.', { extensions: { code: 'FORBIDDEN' } });
  
  // Diccionario de consultas SQL que verifican la propiedad cruzando tablas (JOIN).
  const consultas = {
    local: 'SELECT r.id_restaurante FROM Restaurantes r WHERE r.id_restaurante = $1 AND r.id_usuario_dueño = $2',
    producto: 'SELECT r.id_restaurante FROM Platos p JOIN Restaurantes r ON r.id_restaurante = p.id_restaurante WHERE p.id_plato = $1 AND r.id_usuario_dueño = $2',
    pedido: 'SELECT r.id_restaurante FROM Pedidos p JOIN Restaurantes r ON r.id_restaurante = p.id_restaurante WHERE p.id_pedido = $1 AND r.id_usuario_dueño = $2',
  };
  
  // Si la consulta devuelve 0 filas, el elemento no le pertenece y lanza un error 'FORBIDDEN' (Prohibido).
  if (!(await pool.query(consultas[entidad], [id, usuario])).rows.length) throw new GraphQLError('El elemento no existe o no pertenece a tus locales.', { extensions: { code: 'FORBIDDEN' } });
}

// ============================================================================
// GENERADOR DE MIDDLEWARES (GUARDAESPALDAS DE GRAPHQL)
// ============================================================================
/**
 * Envuelve las funciones originales de GraphQL y les inyecta comprobaciones de seguridad 
 * automáticas antes de permitir que se ejecuten.
 */
export function protegerResolvers(pool, originales, compras) {
  
  // SPREAD OPERATOR (...): Crea una copia exacta de las listas Query y Mutation originales.
  const protegidos = { ...originales, Query: { ...originales.Query }, Mutation: { ...originales.Mutation } };
  
  // FUNCIÓN ENVOLTORIO (Interceptor / Middleware):
  // Sobrescribe la función para obligarla a pasar primero por 'comprobar'.
  const envolver = (tipo, nombre, comprobar) => {
    // NOTACIÓN DE CORCHETES: Copia de seguridad de la función original.
    const resolver = originales[tipo][nombre]; 
    protegidos[tipo][nombre] = async (padre, args, contexto, info) => {
      await comprobar(args, contexto); // 1. FASE DE SEGURIDAD (Pide carnet).
      return resolver(padre, args, contexto, info); // 2. FASE DE EJECUCIÓN (Deja pasar).
    };
  };
  
  // 1. Proteger consultas privadas de Clientes (Solo pueden ver su propio historial)
  for (const nombre of ['obtenerPerfilUsuario', 'obtenerPedidosCliente', 'obtenerUltimosPedidos', 'obtenerRecomendaciones', 'obtenerFavoritos', 'obtenerPlatosFavoritos']) {
    envolver('Query', nombre, (args, ctx) => exigirCuentaPropia(ctx, args.id_usuario));
  }
  
  // 2. Proteger mutaciones (escritura) de Clientes (con validación extra para reseñas y avisos)
  for (const nombre of ['actualizarPerfilUsuario', 'guardarPreferencias', 'solicitarAviso', 'crearResena']) {
    envolver('Mutation', nombre, (args, ctx) => {
      exigirCuentaPropia(ctx, args.id_usuario);
      if (nombre === 'crearResena' && (args.puntuacion < 1 || args.puntuacion > 5 || !args.comentario.trim() || args.comentario.length > 5000)) throw new Error('Escribe una reseña y una puntuación entre 1 y 5.');
      if (nombre === 'solicitarAviso' && !['RESTAURANTE', 'PLATO'].includes(args.tipo)) throw new Error('El tipo de aviso no es válido.');
    });
  }
  
  // 3. Proteger acciones genéricas que solo requieren estar logueado
  for (const nombre of ['alternarFavorito', 'alternarFavoritoPlato', 'registrarNegocio']) envolver('Mutation', nombre, (_, ctx) => exigirUsuario(ctx));
  
  // 4. Proteger mutaciones exclusivas para DUEÑOS de Restaurantes (Bucle de Desestructuración)
  // [tipo, nombre_funcion, campo_del_id, tipo_de_entidad_para_exigirLocalPropio]
  for (const [tipo, nombre, campo, entidad] of [
    ['Query', 'obtenerPedidosVendedor', 'id_restaurante', 'local'],
    ['Mutation', 'cambiarEstadoRestaurante', 'id_restaurante', 'local'],
    ['Mutation', 'marcarPlatoAgotado', 'id_plato', 'producto'],
    ['Mutation', 'crearPlato', 'id_restaurante', 'local'],
  ]) envolver(tipo, nombre, async (args, ctx) => {
    
    // Verifica que sea el dueño legítimo
    await exigirLocalPropio(pool, ctx, args[campo], entidad);
    
    // Validaciones extra específicas si está creando un Plato:
    if (nombre === 'crearPlato') {
      if (!args.nombre.trim() || !args.descripcion.trim() || !Number.isFinite(args.precio) || args.precio < 0 || !args.categoria.length) throw new Error('Completa el producto con un precio válido y una categoría.');
      if (args.platos_existentes?.length && !args.categoria.includes('MENU')) throw new Error('Solo un menú puede incluir otros productos.');
      if (args.categoria.includes('MENU') && !args.platos_existentes?.length) throw new Error('Selecciona los productos de este menú.');
      if (args.platos_existentes?.length) {
        const productos = (await pool.query('SELECT categoria FROM Platos WHERE id_restaurante = $1 AND id_plato = ANY($2::int[])', [args.id_restaurante, args.platos_existentes])).rows;
        if (productos.some(p => p.categoria?.includes('MENU'))) throw new Error('Un menú solo puede incluir productos individuales.');
      }
    }
    
    // Validaciones extra específicas si está pausando el local o un plato:
    if (nombre === 'cambiarEstadoRestaurante' || nombre === 'marcarPlatoAgotado') {
      const fecha = args.tiempo && new Date(args.tiempo);
      if (fecha && !Number.isNaN(fecha.getTime()) && fecha <= new Date()) throw new Error('Elige una fecha futura para volver a estar disponible.');
    }
  });

  // ============================================================================
  // INTERCEPTORES AVANZADOS (Pagos y Borrados Seguros)
  // ============================================================================
  
  // 5. Interceptar actualización de pedidos para conectarla con el servicio de Pagos de Stripe
  const actualizar = originales.Mutation.actualizarEstadoPedido;
  protegidos.Mutation.actualizarEstadoPedido = async (padre, args, ctx, info) => {
    
    // Si la cocina cancela un pedido, delega toda la lógica de devolver el dinero a 'compras.cancelarPedido'
    if (['CANCELADO', 'RECHAZADO'].includes(args.nuevo_estado)) {
      await exigirLocalPropio(pool, ctx, args.id_pedido, 'pedido');
      return compras.cancelarPedido(args.id_pedido, ctx, args.motivo_rechazo || args.mensaje_personalizado || 'Cancelado por el local');
    }
    
    // Si la cocina solo avanza el estado (ej: a "EN CAMINO"), bloquea el pedido 
    // en la BD para evitar carreras, valida matemáticamente que no retroceda estados, 
    // y finalmente ejecuta la función original (actualizar).
    await exigirLocalPropio(pool, ctx, args.id_pedido, 'pedido');
    return compras.conPedidoBloqueado(args.id_pedido, async cx => {
      await compras.validarCambioPedido(args.id_pedido, args.nuevo_estado, cx);
      return actualizar(padre, args, { ...ctx, conexionConsulta: cx }, info);
    });
  };
  
  // 6. Eliminar elementos con validación de "Pedidos Activos"
  // Agrupamos la comprobación y el borrado en una transacción y bloqueamos la fila.
  // BEGIN por sí solo no impide lecturas fantasma: importan los bloqueos y el aislamiento.
  for (const [nombre, tabla, campo, entidad] of [
    ['eliminarRestaurante', 'Restaurantes', 'id_restaurante', 'local'],
    ['eliminarPlato', 'Platos', 'id_plato', 'producto'],
    ['eliminarPedido', 'Pedidos', 'id_pedido', 'pedido'],
  ]) protegidos.Mutation[nombre] = async (_, args, ctx) => {
    exigirUsuario(ctx);
    const cx = await pool.connect();
    try {
      await cx.query('BEGIN'); // Inicia transacción
      await exigirLocalPropio(cx, ctx, args[campo], entidad); // Bloquea acceso a otras cuentas
      
      // FOR UPDATE: Bloquea la fila específica. Si otro usuario la estaba editando, espera.
      const fila = (await cx.query(`SELECT * FROM ${tabla} WHERE ${campo} = $1 FOR UPDATE`, [args[campo]])).rows[0];
      if (!fila) throw new Error('El elemento ya no existe.');
      
      // Operador Ternario: Si intentan borrar un Plato, comprueba también si ese plato 
      // forma parte de algún Menú que tenga pedidos activos.
      const condicion = entidad === 'producto' ? '(id_plato = $1 OR id_plato IN (SELECT id_menu FROM Menu_Platos WHERE id_plato_incluido = $1))' : `${campo} = $1`;
      const activos = await cx.query(`SELECT 1 FROM Pedidos WHERE ${condicion} AND estado NOT IN ('ENTREGADO','CANCELADO','RECHAZADO') LIMIT 1`, [args[campo]]);
      
      if (activos.rows.length) throw new Error('Hay pedidos activos. Cancélalos o complétalos antes de eliminar este elemento.');
      if (entidad === 'pedido' && fila.id_compra) throw new Error('Los pedidos asociados a un pago se conservan en el historial.');
      
      await cx.query(`DELETE FROM ${tabla} WHERE ${campo} = $1`, [args[campo]]); // Ejecuta el borrado
      await cx.query('COMMIT'); // Guarda cambios definitivamente
      return 'Eliminado';
    } catch (error) { 
      await cx.query('ROLLBACK'); throw error; 
    } finally { 
      cx.release(); 
    }
  };
  
  // Devuelve la copia segura de las funciones para que GraphQL funcione de forma blindada.
  return protegidos;
}
