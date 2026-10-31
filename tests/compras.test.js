import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { crearServicioCompras, normalizarSolicitud } from '../graphql/compras.js';
import { protegerResolvers } from '../graphql/permisos.js';
import { SQL_COMPRAS } from '../graphql/migracionCompras.js';
import { crearNotificacionesPedidos } from '../graphql/notificacionesPedidos.js';
import { procesarMensaje } from '../graphql/nlp/chatbot.js';

// PostgreSQL en memoria: nunca utiliza .env, tarjetas reales ni datos del usuario.
const db = new PGlite();
const cliente = { usuario: { id_usuario: 1, rol: 'CLIENTE' } };
const vendedor = { usuario: { id_usuario: 7, rol: 'VENDEDOR' } };
let reloj, servicio, stripe, intenciones, devoluciones, capturas, liberaciones, falloProducto, perderRespuesta, devolucionPendiente;
const query = (sql, valores) => {
  if (sql.includes('INSERT INTO Pedidos') && String(valores[2]) === String(falloProducto)) throw Error('Fallo de escritura simulado');
  return db.query(sql, valores);
};
const pool = { query, connect: async () => ({ query, release() {} }) };
const solicitud = (clave = 'compra-prueba-000001', cambios = {}) => ({
  clave, id_restaurante: '10', items: [{ id_plato: '101', cantidad: 2 }, { id_plato: '102', cantidad: 1 }],
  metodo_pago: 'TARJETA', id_tarjeta: 'pm_propia', tipo_entrega: 'DOMICILIO',
  direccion_envio: 'Dirección de prueba', latitud_cliente: 0, longitud_cliente: 0, ...cambios,
});
const autorizar = clave => {
  const intencion = [...intenciones.values()].find(p => p.metadata.id_compra === clave);
  intencion.status = 'requires_capture';
  return intencion;
};
const filas = clave => db.query('SELECT * FROM Pedidos WHERE id_compra = $1', [clave]).then(r => r.rows);

before(async () => {
  await db.exec(`
    CREATE TABLE Usuarios (id_usuario INT PRIMARY KEY, rol TEXT, stripe_customer_id TEXT, puntos_acumulados INT DEFAULT 0);
    CREATE TABLE Restaurantes (id_restaurante INT PRIMARY KEY, id_usuario_dueño INT, nombre TEXT, tipo TEXT, latitud FLOAT8, longitud FLOAT8, radio_cobertura_km FLOAT8, aceptando_pedidos BOOLEAN DEFAULT TRUE, tiempo_reactivacion TIMESTAMPTZ, horarios_recogida JSONB);
    CREATE TABLE Platos (id_plato INT PRIMARY KEY, id_restaurante INT REFERENCES Restaurantes(id_restaurante), nombre TEXT, precio FLOAT8, categoria TEXT[], disponible BOOLEAN DEFAULT TRUE, tiempo_disponible TIMESTAMPTZ);
    CREATE TABLE Menu_Platos (id_menu INT REFERENCES Platos(id_plato), id_plato_incluido INT REFERENCES Platos(id_plato));
    CREATE TABLE Pedidos (id_pedido SERIAL PRIMARY KEY, id_usuario INT REFERENCES Usuarios(id_usuario), id_restaurante INT REFERENCES Restaurantes(id_restaurante), id_plato INT REFERENCES Platos(id_plato), metodo_pago TEXT, direccion_envio TEXT, fecha_programada TIMESTAMPTZ, estado TEXT, fecha_pedido TIMESTAMPTZ DEFAULT NOW());
  `);
  await db.exec(SQL_COMPRAS);
  await db.exec(SQL_COMPRAS); // Arrancar de nuevo no cambia los pedidos existentes.
});
after(() => db.close());
beforeEach(async () => {
  reloj = new Date('2026-10-12T12:00:00Z');
  falloProducto = null; perderRespuesta = false; devolucionPendiente = false; capturas = 0; liberaciones = 0;
  intenciones = new Map(); devoluciones = new Map();
  await db.exec(`
    TRUNCATE Pedidos, Compras, Menu_Platos, Platos, Restaurantes, Usuarios RESTART IDENTITY CASCADE;
    INSERT INTO Usuarios VALUES (1,'CLIENTE','cus_propio',0),(7,'VENDEDOR',NULL,0),(8,'VENDEDOR','cus_ajeno',0);
    INSERT INTO Restaurantes (id_restaurante,id_usuario_dueño,nombre,tipo,latitud,longitud,radio_cobertura_km) VALUES (10,7,'Local','PIZZA|ENVIO:1.90|KM:0.50|GRATIS:15',0,0,10),(20,8,'Otro local','PIZZA',0,0,10);
    INSERT INTO Platos (id_plato,id_restaurante,nombre,precio,categoria) VALUES (101,10,'Pizza',10,ARRAY['PLATO']),(102,10,'Bebida',2,ARRAY['BEBIDA']),(103,10,'Temporal',8,ARRAY['PLATO']),(104,10,'Menú',10.2,ARRAY['MENU']),(201,20,'Ajeno',9,ARRAY['PLATO']);
    INSERT INTO Menu_Platos VALUES (104,101),(104,102);
  `);
  await db.query('UPDATE Platos SET disponible = FALSE, tiempo_disponible = $1 WHERE id_plato = 103', [new Date(reloj.getTime() + 4 * 3600_000)]);
  stripe = {
    paymentMethods: { retrieve: async id => ({ id, type: 'card', customer: id === 'pm_propia' ? 'cus_propio' : 'cus_ajeno' }) },
    paymentIntents: {
      create: async (datos, opciones) => {
        if (!intenciones.has(opciones.idempotencyKey)) {
          const id = 'pi_prueba' + intenciones.size;
          intenciones.set(opciones.idempotencyKey, { ...datos, id, status: 'requires_confirmation', client_secret: id + '_secret', created: reloj.getTime() / 1000, latest_charge: { payment_method_details: { card: { capture_before: reloj.getTime() / 1000 + 7 * 86400 } } } });
        }
        return intenciones.get(opciones.idempotencyKey);
      },
      retrieve: async id => [...intenciones.values()].find(p => p.id === id),
      capture: async id => {
        const pago = [...intenciones.values()].find(p => p.id === id);
        const compra = (await db.query('SELECT resumen FROM Compras WHERE id_compra = $1', [pago.metadata.id_compra])).rows[0];
        assert.equal((await filas(pago.metadata.id_compra)).length, compra.resumen.items.reduce((n, item) => n + item.cantidad, 0), 'Antes del cobro deben estar guardadas todas las unidades');
        if (pago.status !== 'succeeded') { capturas++; pago.status = 'succeeded'; pago.amount_received = pago.amount; }
        if (perderRespuesta) { perderRespuesta = false; throw Error('Respuesta perdida después del cobro'); }
        return pago;
      },
      cancel: async id => {
        const pago = [...intenciones.values()].find(p => p.id === id);
        if (pago.status !== 'canceled') { liberaciones++; pago.status = 'canceled'; }
        return pago;
      },
    },
    refunds: {
      create: async (datos, opciones) => {
        if (!devoluciones.has(opciones.idempotencyKey)) devoluciones.set(opciones.idempotencyKey, { ...datos, id: 're_prueba' + devoluciones.size, status: devolucionPendiente ? 'pending' : 'succeeded' });
        return { ...devoluciones.get(opciones.idempotencyKey) };
      },
      retrieve: async id => [...devoluciones.values()].find(r => r.id === id),
    },
  };
  servicio = crearServicioCompras(pool, stripe, { ahora: () => reloj });
});

test('calcula precios y envío en PostgreSQL, admite coordenadas cero y solo autoriza el importe', async () => {
  const input = solicitud(undefined, { items: [{ id_plato: '101', cantidad: 1 }], monto: 0.50 });
  const compra = await servicio.preparar(input, cliente);
  assert.equal(compra.total, 11.90);
  const intencion = [...intenciones.values()][0];
  assert.equal(intencion.amount, 1190);
  assert.equal(intencion.capture_method, 'manual');
  assert.equal(capturas, 0);
});

test('un carrito completo se guarda en una transacción antes del cobro y los reintentos no lo duplican', async () => {
  const input = solicitud();
  const quote = await servicio.preparar(input, cliente);
  assert.equal((await servicio.preparar(input, cliente)).client_secret, quote.client_secret);
  assert.equal(intenciones.size, 1);
  autorizar(input.clave);
  const compra = await servicio.confirmar(input.clave, cliente);
  assert.equal(compra.estado, 'CONFIRMADA');
  assert.equal(compra.pedidos.length, 3);
  await servicio.confirmar(input.clave, cliente);
  assert.equal((await filas(input.clave)).length, 3);
  assert.equal(capturas, 1);
  assert.equal((await db.query('SELECT puntos_acumulados FROM Usuarios WHERE id_usuario = 1')).rows[0].puntos_acumulados, 10);
});

test('un correo lento no retrasa la confirmación ni bloquea la gestión del pedido', { timeout: 5000 }, async t => {
  const bloqueos = new Set();
  const poolConcurrente = { query, connect: async () => ({
    query: async (sql, valores) => {
      // PGlite comparte sesión; simula aquí los bloqueos entre conexiones de pg.
      if (sql.includes('pg_try_advisory_lock')) {
        const libre = !bloqueos.has(valores[0]);
        if (libre) bloqueos.add(valores[0]);
        return { rows: [{ bloqueado: libre }] };
      }
      if (sql.includes('pg_advisory_unlock')) {
        bloqueos.delete(valores[0]);
        return { rows: [] };
      }
      return query(sql, valores);
    },
    release() {},
  }) };
  let terminarCorreo, anunciarInicio, envios = 0;
  const correoPendiente = new Promise(resolve => { terminarCorreo = resolve; });
  const correoIniciado = new Promise(resolve => { anunciarInicio = resolve; });
  t.after(() => terminarCorreo());
  const compras = crearServicioCompras(poolConcurrente, stripe, {
    ahora: () => reloj,
    notificar: async () => { envios++; anunciarInicio(); await correoPendiente; },
  });
  const input = solicitud('compra-correo-lento-0001', { metodo_pago: 'EFECTIVO' });
  await compras.preparar(input, cliente);
  const confirmada = await compras.confirmar(input.clave, cliente);
  assert.equal(confirmada.estado, 'CONFIRMADA');
  assert.equal(envios, 0, 'La petición de pago no debe intentar enviar correo');
  const enviando = compras.procesarNotificacionesPendientes();
  await correoIniciado;
  const pedido = await compras.conPedidoBloqueado(confirmada.pedidos[0].id_pedido,
    cx => compras.validarCambioPedido(confirmada.pedidos[0].id_pedido, 'PREPARANDO', cx));
  assert.equal(pedido.estado_compra, 'CONFIRMADA');
  assert.equal((await compras.consultar(input.clave, cliente)).estado, 'CONFIRMADA');
  terminarCorreo();
  await enviando;
  assert.equal((await db.query('SELECT notificada FROM Compras WHERE id_compra = $1', [input.clave])).rows[0].notificada, true);
});

test('un correo fallido queda pendiente y puede reintentarse tras reiniciar sin duplicar compras', async () => {
  let intentos = 0;
  const compras = crearServicioCompras(pool, stripe, {
    ahora: () => reloj,
    notificar: async () => { intentos++; throw Object.assign(new Error('Fallo SMTP simulado'), { code: 'SMTP_PRUEBA' }); },
  });
  const input = solicitud('compra-correo-reintento-0001', { metodo_pago: 'EFECTIVO' });
  await compras.preparar(input, cliente);
  await compras.confirmar(input.clave, cliente);
  await compras.procesarNotificacionesPendientes();
  assert.equal((await db.query('SELECT notificada FROM Compras WHERE id_compra = $1', [input.clave])).rows[0].notificada, false);
  const reiniciadas = crearServicioCompras(pool, stripe, { ahora: () => reloj, notificar: async () => { intentos++; } });
  await reiniciadas.procesarNotificacionesPendientes();
  await reiniciadas.procesarNotificacionesPendientes();
  assert.equal(intentos, 2);
  assert.equal((await db.query('SELECT notificada FROM Compras WHERE id_compra = $1', [input.clave])).rows[0].notificada, true);
  assert.equal((await filas(input.clave)).length, 3);
  assert.equal((await reiniciadas.consultar(input.clave, cliente)).estado, 'CONFIRMADA');
});

test('activar una reserva mientras sale su correo conserva pendiente el aviso de confirmación', { timeout: 5000 }, async t => {
  let terminarCorreo, anunciarInicio;
  const correoPendiente = new Promise(resolve => { terminarCorreo = resolve; });
  const correoIniciado = new Promise(resolve => { anunciarInicio = resolve; });
  t.after(() => terminarCorreo());
  const estadosNotificados = [];
  const compras = crearServicioCompras(pool, stripe, {
    ahora: () => reloj,
    notificar: async compra => {
      estadosNotificados.push(compra.estado);
      if (compra.estado === 'RESERVADA') { anunciarInicio(); await correoPendiente; }
    },
  });
  const input = solicitud('compra-correo-reserva-0001', { metodo_pago: 'EFECTIVO', fecha_programada: new Date(reloj.getTime() + 3600_000).toISOString() });
  await compras.preparar(input, cliente);
  assert.equal((await compras.confirmar(input.clave, cliente)).estado, 'RESERVADA');
  const enviando = compras.procesarNotificacionesPendientes();
  await correoIniciado;
  reloj = new Date(reloj.getTime() + 3600_000);
  await compras.procesarPendientes();
  terminarCorreo();
  await enviando;
  const compra = (await db.query('SELECT estado, notificada FROM Compras WHERE id_compra = $1', [input.clave])).rows[0];
  assert.equal(compra.estado, 'CONFIRMADA');
  assert.equal(compra.notificada, false, 'El aviso de reserva no debe marcar enviada la confirmación');
  await compras.procesarNotificacionesPendientes();
  await compras.procesarNotificacionesPendientes();
  assert.deepEqual(estadosNotificados, ['RESERVADA', 'CONFIRMADA']);
});

test('si una unidad falla, revierte todo el pedido y libera la autorización sin cobrar', async () => {
  const input = solicitud();
  await servicio.preparar(input, cliente); autorizar(input.clave); falloProducto = '102';
  await assert.rejects(servicio.confirmar(input.clave, cliente), /Fallo de escritura/);
  assert.equal((await filas(input.clave)).length, 0);
  assert.equal(capturas, 0);
  assert.equal(liberaciones, 1);
  assert.equal((await db.query('SELECT puntos_acumulados FROM Usuarios WHERE id_usuario = 1')).rows[0].puntos_acumulados, 0);
});

test('rechaza productos de otro local, componentes no disponibles y reservas inválidas antes de autorizar', async () => {
  await assert.rejects(servicio.preparar(solicitud(undefined, { items: [{ id_plato: '201', cantidad: 1 }] }), cliente), /mismo local/);
  await db.exec('UPDATE Platos SET disponible = FALSE WHERE id_plato = 102');
  await assert.rejects(servicio.preparar(solicitud(undefined, { items: [{ id_plato: '104', cantidad: 1 }] }), cliente), /no estará disponible/);
  for (const diferencia of [-3600_000, 5 * 60_000, 8 * 86400_000]) {
    await assert.rejects(servicio.preparar(solicitud(undefined, { fecha_programada: new Date(reloj.getTime() + diferencia).toISOString() }), cliente), /hora futura/);
  }
  assert.equal(intenciones.size, 0);
});

test('no admite fechas anteriores a la reapertura del local o de un componente del menú', async () => {
  await db.query('UPDATE Restaurantes SET aceptando_pedidos = FALSE, tiempo_reactivacion = $1 WHERE id_restaurante = 10', [new Date(reloj.getTime() + 4 * 3600_000)]);
  await assert.rejects(servicio.preparar(solicitud(undefined, { fecha_programada: new Date(reloj.getTime() + 3600_000).toISOString() }), cliente), /El local no estará disponible/);
  await db.exec('UPDATE Restaurantes SET aceptando_pedidos = TRUE WHERE id_restaurante = 10');
  await db.query('UPDATE Platos SET disponible = FALSE, tiempo_disponible = $1 WHERE id_plato = 102', [new Date(reloj.getTime() + 4 * 3600_000)]);
  await assert.rejects(servicio.preparar(solicitud(undefined, { items: [{ id_plato: '104', cantidad: 1 }], fecha_programada: new Date(reloj.getTime() + 3600_000).toISOString() }), cliente), /Bebida/);
});

test('si cambia un precio o los componentes del menú, libera la retención y exige revisar el carrito', async () => {
  const input = solicitud(undefined, { items: [{ id_plato: '104', cantidad: 1 }] });
  await servicio.preparar(input, cliente); autorizar(input.clave);
  await db.exec('DELETE FROM Menu_Platos WHERE id_plato_incluido = 102');
  await assert.rejects(servicio.confirmar(input.clave, cliente), /han cambiado/);
  assert.equal(capturas, 0);
  assert.equal(liberaciones, 1);
  assert.equal((await filas(input.clave)).length, 0);
});

test('una respuesta de cobro perdida se recupera tras reiniciar sin duplicar pago ni pedido', async t => {
  t.mock.method(console, 'error', () => {});
  const input = solicitud(); await servicio.preparar(input, cliente); autorizar(input.clave); perderRespuesta = true;
  await servicio.confirmar(input.clave, cliente);
  const reiniciado = crearServicioCompras(pool, stripe, { ahora: () => reloj });
  await reiniciado.procesarPendientes();
  assert.equal((await reiniciado.consultar(input.clave, cliente)).estado, 'CONFIRMADA');
  assert.equal(capturas, 1);
  assert.equal((await filas(input.clave)).length, 3);
});

test('una autorización confirmada con respuesta perdida se recupera aunque el navegador no confirme el pedido', async () => {
  const input = solicitud(); await servicio.preparar(input, cliente); autorizar(input.clave);
  await servicio.procesarPendientes();
  assert.equal((await servicio.consultar(input.clave, cliente)).estado, 'CONFIRMADA');
  assert.equal(capturas, 1);
  assert.equal((await filas(input.clave)).length, 3);
});

test('el resolver identifica un fallo de conexión sin exponer datos privados y permite recuperar la misma compra', async t => {
  const registros = t.mock.method(console, 'error', () => {});
  const input = solicitud(); await servicio.preparar(input, cliente); autorizar(input.clave);
  const recuperar = stripe.paymentIntents.retrieve;
  stripe.paymentIntents.retrieve = async () => { throw Object.assign(Error('Credencial privada sk_test_secreto'), { code: 'ECONNRESET' }); };
  for (const ejecutar of [
    () => servicio.Mutation.confirmarCompra(null, { id_compra: input.clave }, cliente),
    () => servicio.Query.consultarCompra(null, { id_compra: input.clave }, cliente),
  ]) await assert.rejects(ejecutar(), error => {
    assert.equal(error.extensions.code, 'COMPRA_SERVIDOR_NO_DISPONIBLE');
    assert.equal(error.extensions.codigo_incidente, 'ECONNRESET');
    assert.doesNotMatch(error.message, /sk_test|secreto/);
    return true;
  });
  assert.deepEqual(registros.mock.calls.map(llamada => llamada.arguments[1].etapa), ['confirmar', 'consultar']);
  assert.equal(registros.mock.calls[0].arguments[1].id_compra, input.clave);
  assert.doesNotMatch(JSON.stringify(registros.mock.calls), /sk_test|secreto/);
  stripe.paymentIntents.retrieve = recuperar;
  const recuperada = await servicio.Query.consultarCompra(null, { id_compra: input.clave }, cliente);
  assert.equal(recuperada.estado, 'CONFIRMADA');
  assert.equal(intenciones.size, 1); assert.equal(capturas, 1); assert.equal((await filas(input.clave)).length, 3);
});

test('el resolver mantiene los errores de sesión para que el carrito los distinga de una conexión perdida', async () => {
  await assert.rejects(servicio.Query.consultarCompra(null, { id_compra: 'compra-prueba-000001' }, {}), error => error.extensions.code === 'UNAUTHENTICATED');
});

test('las reservas conservan su fecha, esperan disponibilidad y se cobran al activarse', async () => {
  const fecha = new Date(reloj.getTime() + 5 * 3600_000).toISOString();
  const input = solicitud(undefined, { fecha_programada: fecha, items: [{ id_plato: '103', cantidad: 1 }] });
  await servicio.preparar(input, cliente); autorizar(input.clave);
  assert.equal((await servicio.confirmar(input.clave, cliente)).estado, 'RESERVADA');
  await servicio.procesarPendientes(); assert.equal(capturas, 0);
  await assert.rejects(servicio.validarCambioPedido((await filas(input.clave))[0].id_pedido, 'PREPARANDO'), /reservado/);
  reloj = new Date(fecha);
  await db.query('UPDATE Platos SET tiempo_disponible = $1 WHERE id_plato = 103', [new Date(reloj.getTime() + 10 * 60_000)]);
  await servicio.procesarPendientes(); assert.equal(capturas, 0);
  reloj = new Date(reloj.getTime() + 11 * 60_000); await servicio.procesarPendientes();
  assert.equal(capturas, 1);
  assert.equal((await filas(input.clave))[0].estado, 'PENDIENTE');
  assert.equal(new Date((await filas(input.clave))[0].fecha_programada).toISOString(), fecha);
});

test('una reserva que no puede servirse en su ventana se cancela sin cobrar', async () => {
  const fecha = new Date(reloj.getTime() + 3600_000).toISOString();
  const input = solicitud(undefined, { fecha_programada: fecha });
  await servicio.preparar(input, cliente); autorizar(input.clave); await servicio.confirmar(input.clave, cliente);
  await db.exec('UPDATE Restaurantes SET aceptando_pedidos = FALSE, tiempo_reactivacion = NULL WHERE id_restaurante = 10');
  reloj = new Date(new Date(fecha).getTime() + 31 * 60_000); await servicio.procesarPendientes();
  assert.equal(capturas, 0); assert.equal(liberaciones, 1);
  assert.equal((await servicio.consultar(input.clave, cliente)).estado, 'CANCELADA');
});

test('respeta el vencimiento real de la autorización y ofrece efectivo para fechas más lejanas', async () => {
  const input = solicitud(undefined, { fecha_programada: new Date(reloj.getTime() + 2 * 86400_000).toISOString() });
  await servicio.preparar(input, cliente);
  autorizar(input.clave).latest_charge.payment_method_details.card.capture_before = reloj.getTime() / 1000 + 86400;
  await assert.rejects(servicio.confirmar(input.clave, cliente), /efectivo/);
  assert.equal(capturas, 0); assert.equal(liberaciones, 1);
});

test('cancelar una unidad cancela toda la compra y devuelve o libera el importe una sola vez', async () => {
  const input = solicitud(); await servicio.preparar(input, cliente); autorizar(input.clave); await servicio.confirmar(input.clave, cliente);
  const id = (await filas(input.clave))[0].id_pedido;
  await servicio.cancelarPedido(id, cliente); await servicio.cancelarPedido(id, cliente);
  assert.equal(devoluciones.size, 1);
  assert.ok((await filas(input.clave)).every(p => p.estado === 'CANCELADO'));
  const reserva = solicitud('compra-reserva-000001', { fecha_programada: new Date(reloj.getTime() + 3600_000).toISOString() });
  await servicio.preparar(reserva, cliente); autorizar(reserva.clave); await servicio.confirmar(reserva.clave, cliente);
  await servicio.cancelarPedido((await filas(reserva.clave))[0].id_pedido, cliente);
  assert.equal(liberaciones, 1);
  assert.equal(devoluciones.size, 1);
});

test('el chatbot informa de una devolución real y no inventa reembolsos para pedidos antiguos', async () => {
  const input = solicitud(); await servicio.preparar(input, cliente); autorizar(input.clave); await servicio.confirmar(input.clave, cliente);
  const id = (await filas(input.clave))[0].id_pedido;
  const respuesta = await procesarMensaje('Cancelar ' + id, cliente, pool, servicio);
  assert.match(respuesta, /devolución se ha tramitado/);
  assert.equal(devoluciones.size, 1);
  const antiguo = (await db.query("INSERT INTO Pedidos (id_usuario,id_restaurante,id_plato,metodo_pago,estado) VALUES (1,10,101,'TARJETA','PENDIENTE') RETURNING id_pedido")).rows[0].id_pedido;
  assert.match(await procesarMensaje('Reembolso ' + antiguo, cliente, pool, servicio), /verificar la devolución/);
  assert.equal(devoluciones.size, 1);
});

test('una devolución pendiente se consulta hasta confirmarse sin solicitar otra devolución', async () => {
  const input = solicitud(); await servicio.preparar(input, cliente); autorizar(input.clave); await servicio.confirmar(input.clave, cliente);
  devolucionPendiente = true;
  assert.equal((await servicio.cancelarPedido((await filas(input.clave))[0].id_pedido, cliente)).estado_pago, 'REEMBOLSO_PENDIENTE');
  [...devoluciones.values()][0].status = 'succeeded';
  await servicio.procesarPendientes();
  assert.equal((await servicio.consultar(input.clave, cliente)).estado, 'REEMBOLSADA');
  assert.equal(devoluciones.size, 1);
});

test('cancelar una compra completa registra un solo aviso con el motivo y el mensaje del local', async () => {
  let despertares = 0;
  const avisos = crearNotificacionesPedidos(pool, async () => {}, { ahora: () => reloj });
  servicio = crearServicioCompras(pool, stripe, { ahora: () => reloj, registrarCambioPedido: avisos.registrar, despertarAvisosPedido: () => { despertares++; } });
  const input = solicitud('compra-aviso-cancelacion-001', { metodo_pago: 'EFECTIVO' });
  await servicio.preparar(input, cliente);
  await servicio.confirmar(input.clave, cliente);
  const id = (await filas(input.clave))[0].id_pedido;
  await servicio.cancelarPedido(id, vendedor, 'Falta de stock', 'Lo sentimos, vuelve mañana.');
  await servicio.cancelarPedido(id, vendedor, 'Falta de stock');
  const eventos = (await db.query('SELECT * FROM Notificaciones_Pedido')).rows;
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].datos.estado, 'CANCELADO');
  assert.equal(eventos[0].datos.compraCompleta, true);
  assert.equal(eventos[0].datos.pedidos.length, 3);
  assert.equal(eventos[0].datos.motivo, 'Falta de stock');
  assert.equal(eventos[0].datos.mensaje, 'Lo sentimos, vuelve mañana.');
  assert.equal(despertares, 1);
});

test('un fallo al registrar el aviso revierte la cancelación sin devolver un pago que sigue activo', async () => {
  const avisos = crearNotificacionesPedidos(pool, async () => {}, { ahora: () => reloj });
  servicio = crearServicioCompras(pool, stripe, {
    ahora: () => reloj,
    registrarCambioPedido: async (...args) => { await avisos.registrar(...args); throw new Error('Fallo de aviso simulado'); },
  });
  const input = solicitud(); await servicio.preparar(input, cliente); autorizar(input.clave);
  await servicio.confirmar(input.clave, cliente);
  await assert.rejects(servicio.cancelarPedido((await filas(input.clave))[0].id_pedido, cliente), /Fallo de aviso/);
  assert.ok((await filas(input.clave)).every(p => p.estado === 'PENDIENTE'));
  assert.equal((await db.query('SELECT estado FROM Compras WHERE id_compra = $1', [input.clave])).rows[0].estado, 'CONFIRMADA');
  assert.equal((await db.query('SELECT * FROM Notificaciones_Pedido')).rows.length, 0);
  assert.equal(devoluciones.size, 0);
});

test('cancelar un pedido antiguo también conserva un aviso pendiente sin duplicarlo', async () => {
  const avisos = crearNotificacionesPedidos(pool, async () => {}, { ahora: () => reloj });
  servicio = crearServicioCompras(pool, stripe, { ahora: () => reloj, registrarCambioPedido: avisos.registrar });
  const pedido = (await db.query("INSERT INTO Pedidos (id_usuario, id_restaurante, id_plato, metodo_pago, estado) VALUES (1,10,101,'EFECTIVO','PENDIENTE') RETURNING *")).rows[0];
  await servicio.cancelarPedido(pedido.id_pedido, cliente, 'Cambio de planes');
  await servicio.cancelarPedido(pedido.id_pedido, cliente, 'Cambio de planes');
  const eventos = (await db.query('SELECT * FROM Notificaciones_Pedido')).rows;
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].datos.compraCompleta, false);
  assert.equal(eventos[0].datos.motivo, 'Cambio de planes');
});

test('sin sesión, con tarjeta ajena o con otra cuenta no se consulta ni confirma una compra', async () => {
  await assert.rejects(servicio.preparar(solicitud(), {}), /Inicia sesión/);
  await assert.rejects(servicio.preparar(solicitud(undefined, { id_tarjeta: 'pm_ajena' }), cliente), /no pertenece/);
  const input = solicitud('compra-propia-000002'); await servicio.preparar(input, cliente);
  await assert.rejects(servicio.confirmar(input.clave, vendedor), /no pertenece/);
  await assert.rejects(servicio.consultar(input.clave, vendedor), /no pertenece/);
});

test('las consultas privadas y acciones de vendedor exigen cuenta propia y propiedad del local', async () => {
  let ejecuciones = 0;
  const nombresQuery = ['obtenerPerfilUsuario','obtenerPedidosCliente','obtenerUltimosPedidos','obtenerRecomendaciones','obtenerFavoritos','obtenerPlatosFavoritos','obtenerPedidosVendedor'];
  const nombresMutation = ['actualizarPerfilUsuario','guardarPreferencias','solicitarAviso','crearResena','alternarFavorito','alternarFavoritoPlato','registrarNegocio','cambiarEstadoRestaurante','marcarPlatoAgotado','actualizarEstadoPedido','eliminarPedido','eliminarRestaurante','eliminarPlato','crearPlato'];
  const resolver = async () => { ejecuciones++; return true; };
  const protegidos = protegerResolvers(pool, { Query: Object.fromEntries(nombresQuery.map(n => [n,resolver])), Mutation: Object.fromEntries(nombresMutation.map(n => [n,resolver])) }, servicio);
  for (const nombre of nombresQuery.filter(n => n !== 'obtenerPedidosVendedor')) {
    await assert.rejects(protegidos.Query[nombre](null, { id_usuario: '1' }, {}), /Inicia sesión/);
    await assert.rejects(protegidos.Query[nombre](null, { id_usuario: '1' }, vendedor), /tu cuenta/);
  }
  await assert.rejects(protegidos.Mutation.cambiarEstadoRestaurante(null, { id_restaurante: '20' }, vendedor), /no pertenece/);
  await assert.rejects(protegidos.Mutation.marcarPlatoAgotado(null, { id_plato: '201' }, vendedor), /no pertenece/);
  assert.equal(ejecuciones, 0);
  await protegidos.Mutation.cambiarEstadoRestaurante(null, { id_restaurante: '10', aceptando: true }, vendedor);
  assert.equal(ejecuciones, 1);
});

test('normaliza cantidades repetidas y rechaza datos, métodos y claves inválidos', () => {
  assert.deepEqual(normalizarSolicitud(solicitud(undefined, { items: [{ id_plato: '101', cantidad: 1 }, { id_plato: '101', cantidad: 2 }] })).items, [{ id_plato: '101', cantidad: 3 }]);
  for (const input of [solicitud('corta'), solicitud(undefined,{metodo_pago:'OTRO'}), solicitud(undefined,{tipo_entrega:'OTRO'}), solicitud(undefined,{items:[]}), solicitud(undefined,{items:[{id_plato:'101',cantidad:-1}]}), solicitud(undefined,{fecha_programada:'inválida'})]) assert.throws(() => normalizarSolicitud(input));
});

test('revisa reservas y reactiva disponibilidad con fechas antiguas guardadas como VARCHAR', async () => {
  await db.exec(`
    ALTER TABLE Restaurantes ALTER COLUMN tiempo_reactivacion TYPE VARCHAR USING tiempo_reactivacion::text;
    ALTER TABLE Platos ALTER COLUMN tiempo_disponible TYPE VARCHAR USING tiempo_disponible::text;
    ALTER TABLE Pedidos ALTER COLUMN fecha_programada TYPE VARCHAR USING fecha_programada::text;
  `);
  try {
    await db.query('UPDATE Restaurantes SET aceptando_pedidos = FALSE, tiempo_reactivacion = $1 WHERE id_restaurante = 10', [new Date(reloj.getTime() - 60_000).toISOString()]);
    await db.query('UPDATE Platos SET disponible = FALSE, tiempo_disponible = $1 WHERE id_plato = 101', [new Date(reloj.getTime() - 60_000).toISOString()]);
    await db.query(`INSERT INTO Pedidos (id_usuario,id_restaurante,id_plato,metodo_pago,direccion_envio,fecha_programada,estado) VALUES (1,10,101,'EFECTIVO','Recogida en el local',$1,'PROGRAMADO')`, [new Date(reloj.getTime() - 60_000).toISOString()]);
    await servicio.procesarPendientes();
    assert.equal((await db.query('SELECT estado FROM Pedidos')).rows[0].estado, 'PENDIENTE');
    assert.equal((await db.query('SELECT aceptando_pedidos FROM Restaurantes WHERE id_restaurante = 10')).rows[0].aceptando_pedidos, true);
    assert.equal((await db.query('SELECT disponible FROM Platos WHERE id_plato = 101')).rows[0].disponible, true);
    await servicio.preparar(solicitud(), cliente);
  } finally {
    await db.exec(`
      ALTER TABLE Restaurantes ALTER COLUMN tiempo_reactivacion TYPE TIMESTAMPTZ USING NULLIF(tiempo_reactivacion, '')::timestamptz;
      ALTER TABLE Platos ALTER COLUMN tiempo_disponible TYPE TIMESTAMPTZ USING NULLIF(tiempo_disponible, '')::timestamptz;
      ALTER TABLE Pedidos ALTER COLUMN fecha_programada TYPE TIMESTAMPTZ USING NULLIF(fecha_programada, '')::timestamptz;
    `);
  }
});
