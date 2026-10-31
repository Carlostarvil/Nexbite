import { estadoCanonico, agruparProductos } from './pedidosVendedor.js';

export function crearNotificacionesPedidos(pool, enviarCorreo, { ahora = () => new Date() } = {}) {
  let enCurso = null;
  let programada = false;
  let repetir = false;

  async function registrar(conexion, pedido, { motivo = '', mensaje = '', compraCompleta = false, pedidoCompleto = false, pedidos = [pedido] } = {}) {
    const estado = estadoCanonico(pedido.estado);
    if (!['PREPARANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'].includes(estado)) return;
    const nombres = (await conexion.query(`
      SELECT r.nombre AS local, pl.nombre AS producto FROM Restaurantes r
      LEFT JOIN Platos pl ON pl.id_plato = $2 AND pl.id_restaurante = r.id_restaurante
      WHERE r.id_restaurante = $1
    `, [pedido.id_restaurante, pedido.id_plato])).rows[0];
    const conjunto = pedidoCompleto || compraCompleta;
    const unidades = [...pedidos].sort((a, b) => Number(a.id_pedido) - Number(b.id_pedido));
    const numeroPedido = conjunto ? unidades[0].id_pedido : pedido.id_pedido;
    const datos = {
      estado, local: nombres?.local || 'tu local', producto: pedido.nombre_producto || nombres?.producto || '',
      recogida: String(pedido.direccion_envio || '').toLowerCase().includes('recogida'),
      motivo, mensaje, compraCompleta, pedidoCompleto: conjunto, numeroPedido, pedidos: unidades.map(p => p.id_pedido),
      productos: conjunto ? agruparProductos(unidades).map(p => p.cantidad + ' × ' + p.nombre).join(' · ') : '',
    };
    const clave = (compraCompleta || pedidoCompleto) && pedido.id_compra ? 'compra-' + pedido.id_compra + '-' + estado : 'pedido-' + pedido.id_pedido + '-' + estado;
    const canal = pedido.id_compra ? 'compra-' + pedido.id_compra : 'pedido-' + pedido.id_pedido;
    await conexion.query(`
      INSERT INTO Notificaciones_Pedido (clave, canal, id_pedido, id_usuario, datos, creada, proximo_intento)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6) ON CONFLICT (clave) DO NOTHING
    `, [clave, canal, numeroPedido, pedido.id_usuario, JSON.stringify(datos), ahora()]);
  }

  async function enviarLote() {
    for (let indice = 0; indice < 10; indice++) {
      // La reserva temporal evita que dos procesos envíen el mismo aviso a la vez.
      // No mantiene una conexión ni el bloqueo del pedido mientras habla con Brevo.
      const aviso = (await pool.query(`
        UPDATE Notificaciones_Pedido SET intentos = intentos + 1, proximo_intento = $1::timestamptz + INTERVAL '2 minutes'
        WHERE clave = (
          SELECT n.clave FROM Notificaciones_Pedido n
          WHERE n.enviada IS NULL AND n.proximo_intento <= $1 AND NOT EXISTS (
            SELECT 1 FROM Notificaciones_Pedido anterior
            WHERE anterior.canal = n.canal AND anterior.id_notificacion < n.id_notificacion AND anterior.enviada IS NULL
          ) ORDER BY n.id_notificacion LIMIT 1 FOR UPDATE OF n SKIP LOCKED
        ) AND enviada IS NULL AND proximo_intento <= $1 RETURNING *
      `, [ahora()])).rows[0];
      if (!aviso) break;
      const clave = aviso.clave;
      try {
        const usuario = (await pool.query('SELECT nombre, email FROM Usuarios WHERE id_usuario = $1', [aviso.id_usuario])).rows[0];
        if (!usuario?.email) throw Object.assign(new Error('El destinatario no tiene correo.'), { code: 'CORREO_DESTINATARIO' });
        const datos = aviso.datos;
        const referencia = datos.compraCompleta && !datos.pedidoCompleto ? 'Tu compra en ' + datos.local : 'Tu pedido #' + (datos.numeroPedido ?? datos.pedidos[0]) + ' de ' + datos.local;
        const textos = {
          PREPARANDO: ['En preparación', 'ya se está preparando.'],
          ENVIADO: datos.recogida ? ['Listo para recoger', 'ya está listo para recoger en el local.'] : ['En camino', 'ya está en camino a tu dirección.'],
          ENTREGADO: datos.recogida ? ['Recogido', 'se ha marcado como recogido.'] : ['Entregado', 'se ha marcado como entregado.'],
          CANCELADO: [datos.compraCompleta && !datos.pedidoCompleto ? 'Compra cancelada' : 'Pedido cancelado', 'se ha cancelado.'],
        };
        const [titulo, descripcion] = textos[datos.estado];
        const texto = [
          'Hola ' + (usuario.nombre || '') + ',', '', referencia + ' ' + descripcion,
          datos.productos ? 'Productos: ' + datos.productos : datos.producto && !datos.compraCompleta ? 'Producto: ' + datos.producto : '',
          datos.compraCompleta && !datos.pedidoCompleto ? 'Pedidos incluidos: ' + datos.pedidos.map(id => '#' + id).join(', ') + '.' : '',
          datos.motivo ? 'Motivo: ' + datos.motivo : '',
          datos.mensaje ? 'Mensaje del local: ' + datos.mensaje : '',
          datos.estado === 'CANCELADO' ? 'Consulta el estado del pago o de su devolución en Mis pedidos.' : 'Puedes consultar el pedido desde tu perfil de NexBite.',
        ].filter(linea => linea !== '').join('\n');
        await enviarCorreo({
          from: `"NexBite" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
          to: usuario.email, subject: titulo + ' · ' + referencia, text: texto,
        });
        await pool.query('UPDATE Notificaciones_Pedido SET enviada = $2, ultimo_error = NULL WHERE clave = $1', [clave, ahora()]);
      } catch (error) {
        const espera = Math.min(300, 15 * 2 ** Math.min(aviso.intentos - 1, 5));
        const proximo = new Date(ahora().getTime() + espera * 1000);
        const codigo = /^[A-Z0-9_]{1,80}$/.test(String(error.code)) ? error.code : 'CORREO_FALLO';
        await pool.query('UPDATE Notificaciones_Pedido SET proximo_intento = $2, ultimo_error = $3 WHERE clave = $1', [clave, proximo, codigo]);
        console.error('Aviso de estado pendiente de enviar:', codigo);
      }
    }
  }

  function procesarPendientes() {
    if (enCurso) { repetir = true; return enCurso; }
    enCurso = (async () => {
      do { repetir = false; await enviarLote(); } while (repetir);
    })().finally(() => { enCurso = null; });
    return enCurso;
  }

  function despertar() {
    if (programada) return;
    programada = true;
    setImmediate(() => {
      programada = false;
      procesarPendientes().catch(error => console.error('No se pudieron revisar los avisos de estado:', error.code || 'CORREO_FALLO'));
    });
  }

  return { registrar, procesarPendientes, despertar };
}
