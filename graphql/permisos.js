import { GraphQLError } from 'graphql';

export function exigirUsuario(contexto) {
  const id = contexto?.usuario?.id_usuario;
  if (!/^[1-9]\d*$/.test(String(id))) throw new GraphQLError('Inicia sesión para continuar.', { extensions: { code: 'UNAUTHENTICATED' } });
  return String(id);
}

export function exigirCuentaPropia(contexto, id) {
  if (exigirUsuario(contexto) !== String(id)) throw new GraphQLError('Solo puedes acceder a los datos de tu cuenta.', { extensions: { code: 'FORBIDDEN' } });
}

export async function exigirLocalPropio(pool, contexto, id, entidad = 'local') {
  const usuario = exigirUsuario(contexto);
  if (contexto.usuario.rol !== 'VENDEDOR') throw new GraphQLError('Inicia sesión como vendedor.', { extensions: { code: 'FORBIDDEN' } });
  const consultas = {
    local: 'SELECT r.id_restaurante FROM Restaurantes r WHERE r.id_restaurante = $1 AND r.id_usuario_dueño = $2',
    producto: 'SELECT r.id_restaurante FROM Platos p JOIN Restaurantes r ON r.id_restaurante = p.id_restaurante WHERE p.id_plato = $1 AND r.id_usuario_dueño = $2',
    pedido: 'SELECT r.id_restaurante FROM Pedidos p JOIN Restaurantes r ON r.id_restaurante = p.id_restaurante WHERE p.id_pedido = $1 AND r.id_usuario_dueño = $2',
  };
  if (!(await pool.query(consultas[entidad], [id, usuario])).rows.length) throw new GraphQLError('El elemento no existe o no pertenece a tus locales.', { extensions: { code: 'FORBIDDEN' } });
}

export function protegerResolvers(pool, originales, compras) {
  const protegidos = { ...originales, Query: { ...originales.Query }, Mutation: { ...originales.Mutation } };
  const envolver = (tipo, nombre, comprobar) => {
    const resolver = originales[tipo][nombre];
    protegidos[tipo][nombre] = async (padre, args, contexto, info) => {
      await comprobar(args, contexto);
      return resolver(padre, args, contexto, info);
    };
  };
  for (const nombre of ['obtenerPerfilUsuario', 'obtenerPedidosCliente', 'obtenerUltimosPedidos', 'obtenerRecomendaciones', 'obtenerFavoritos', 'obtenerPlatosFavoritos']) {
    envolver('Query', nombre, (args, ctx) => exigirCuentaPropia(ctx, args.id_usuario));
  }
  for (const nombre of ['actualizarPerfilUsuario', 'guardarPreferencias', 'solicitarAviso', 'crearResena']) {
    envolver('Mutation', nombre, (args, ctx) => {
      exigirCuentaPropia(ctx, args.id_usuario);
      if (nombre === 'crearResena' && (args.puntuacion < 1 || args.puntuacion > 5 || !args.comentario.trim() || args.comentario.length > 5000)) throw new Error('Escribe una reseña y una puntuación entre 1 y 5.');
      if (nombre === 'solicitarAviso' && !['RESTAURANTE', 'PLATO'].includes(args.tipo)) throw new Error('El tipo de aviso no es válido.');
    });
  }
  for (const nombre of ['alternarFavorito', 'alternarFavoritoPlato', 'registrarNegocio']) envolver('Mutation', nombre, (_, ctx) => exigirUsuario(ctx));
  for (const [tipo, nombre, campo, entidad] of [
    ['Query', 'obtenerPedidosVendedor', 'id_restaurante', 'local'],
    ['Mutation', 'cambiarEstadoRestaurante', 'id_restaurante', 'local'],
    ['Mutation', 'marcarPlatoAgotado', 'id_plato', 'producto'],
    ['Mutation', 'crearPlato', 'id_restaurante', 'local'],
  ]) envolver(tipo, nombre, async (args, ctx) => {
    await exigirLocalPropio(pool, ctx, args[campo], entidad);
    if (nombre === 'crearPlato') {
      if (!args.nombre.trim() || !args.descripcion.trim() || !Number.isFinite(args.precio) || args.precio < 0 || !args.categoria.length) throw new Error('Completa el producto con un precio válido y una categoría.');
      if (args.platos_existentes?.length && !args.categoria.includes('MENU')) throw new Error('Solo un menú puede incluir otros productos.');
      if (args.categoria.includes('MENU') && !args.platos_existentes?.length) throw new Error('Selecciona los productos de este menú.');
      if (args.platos_existentes?.length) {
        const productos = (await pool.query('SELECT categoria FROM Platos WHERE id_restaurante = $1 AND id_plato = ANY($2::int[])', [args.id_restaurante, args.platos_existentes])).rows;
        if (productos.some(p => p.categoria?.includes('MENU'))) throw new Error('Un menú solo puede incluir productos individuales.');
      }
    }
    if (nombre === 'cambiarEstadoRestaurante' || nombre === 'marcarPlatoAgotado') {
      const fecha = args.tiempo && new Date(args.tiempo);
      if (fecha && !Number.isNaN(fecha.getTime()) && fecha <= new Date()) throw new Error('Elige una fecha futura para volver a estar disponible.');
    }
  });
  const actualizar = originales.Mutation.actualizarEstadoPedido;
  protegidos.Mutation.actualizarEstadoPedido = async (padre, args, ctx, info) => {
    if (['CANCELADO', 'RECHAZADO'].includes(args.nuevo_estado)) {
      await exigirLocalPropio(pool, ctx, args.id_pedido, 'pedido');
      return compras.cancelarPedido(args.id_pedido, ctx, args.motivo_rechazo || args.mensaje_personalizado || 'Cancelado por el local');
    }
    await exigirLocalPropio(pool, ctx, args.id_pedido, 'pedido');
    return compras.conPedidoBloqueado(args.id_pedido, async cx => {
      await compras.validarCambioPedido(args.id_pedido, args.nuevo_estado, cx);
      return actualizar(padre, args, { ...ctx, conexionConsulta: cx }, info);
    });
  };
  // Comprobar y borrar bajo el mismo bloqueo evita que entre un pedido entre
  // la comprobación y el DELETE. Las compras conservan su resumen histórico.
  for (const [nombre, tabla, campo, entidad] of [
    ['eliminarRestaurante', 'Restaurantes', 'id_restaurante', 'local'],
    ['eliminarPlato', 'Platos', 'id_plato', 'producto'],
    ['eliminarPedido', 'Pedidos', 'id_pedido', 'pedido'],
  ]) protegidos.Mutation[nombre] = async (_, args, ctx) => {
    exigirUsuario(ctx);
    const cx = await pool.connect();
    try {
      await cx.query('BEGIN');
      await exigirLocalPropio(cx, ctx, args[campo], entidad);
      const fila = (await cx.query(`SELECT * FROM ${tabla} WHERE ${campo} = $1 FOR UPDATE`, [args[campo]])).rows[0];
      if (!fila) throw new Error('El elemento ya no existe.');
      const condicion = entidad === 'producto' ? '(id_plato = $1 OR id_plato IN (SELECT id_menu FROM Menu_Platos WHERE id_plato_incluido = $1))' : `${campo} = $1`;
      const activos = await cx.query(`SELECT 1 FROM Pedidos WHERE ${condicion} AND estado NOT IN ('ENTREGADO','CANCELADO','RECHAZADO') LIMIT 1`, [args[campo]]);
      if (activos.rows.length) throw new Error('Hay pedidos activos. Cancélalos o complétalos antes de eliminar este elemento.');
      if (entidad === 'pedido' && fila.id_compra) throw new Error('Los pedidos asociados a un pago se conservan en el historial.');
      await cx.query(`DELETE FROM ${tabla} WHERE ${campo} = $1`, [args[campo]]);
      await cx.query('COMMIT');
      return 'Eliminado';
    } catch (error) { await cx.query('ROLLBACK'); throw error; }
    finally { cx.release(); }
  };
  return protegidos;
}
