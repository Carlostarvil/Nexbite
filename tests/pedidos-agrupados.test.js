import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { buildSchema, graphql } from 'graphql';
import { typeDefs } from '../graphql/typeDefs.js';
import { SQL_COMPRAS } from '../graphql/migracionCompras.js';
import { crearServicioCompras } from '../graphql/compras.js';
import { crearNotificacionesPedidos } from '../graphql/notificacionesPedidos.js';
import { crearActualizadorEstadoPedido } from '../graphql/actualizarEstadoPedido.js';
import { crearConsultaPedidosVendedor } from '../graphql/pedidosVendedor.js';
import { protegerResolvers } from '../graphql/permisos.js';

const db = new PGlite();
const query = (sql, valores) => db.query(sql, valores);
const pool = { query, connect: async () => ({ query, release() {} }) };
const schema = buildSchema(typeDefs);
const cliente = { usuario: { id_usuario: 1, rol: 'CLIENTE' } };
const vendedor = { usuario: { id_usuario: 7, rol: 'VENDEDOR' } };
const reloj = new Date('2026-10-31T12:00:00Z');
let compras, avisos, protegidos, correos, secuencia;
const obtener = crearConsultaPedidosVendedor(pool);
const unidades = clave => query('SELECT * FROM Pedidos WHERE id_compra = $1 ORDER BY id_pedido', [clave]).then(r => r.rows);
const eventos = () => query('SELECT * FROM Notificaciones_Pedido ORDER BY id_notificacion').then(r => r.rows);
const cambiar = (id, estado, ctx = vendedor) => protegidos.Mutation.actualizarEstadoPedido(null, { id_pedido: String(id), nuevo_estado: estado }, ctx);

function conectar(registrar = avisos.registrar) {
  compras = crearServicioCompras(pool, {}, { ahora: () => reloj, registrarCambioPedido: registrar });
  protegidos = protegerResolvers(pool, {
    Query: { obtenerPedidosVendedor: obtener },
    Mutation: { actualizarEstadoPedido: crearActualizadorEstadoPedido({ registrar, despertar() {} }) },
  }, compras);
}

async function comprar(cambios = {}) {
  const input = {
    clave: 'compra-agrupada-' + String(++secuencia).padStart(6, '0'), id_restaurante: '10',
    items: [{ id_plato: '101', cantidad: 2 }, { id_plato: '102', cantidad: 1 }],
    metodo_pago: 'EFECTIVO', tipo_entrega: 'DOMICILIO', direccion_envio: 'Calle de prueba 1',
    latitud_cliente: 0, longitud_cliente: 0, ...cambios,
  };
  await compras.preparar(input, cliente);
  return compras.confirmar(input.clave, cliente);
}

const consulta = `query Pedidos($id: ID!) {
  obtenerPedidosVendedor(id_restaurante: $id) {
    id_pedido id_compra nombre_plato estado cantidad_total subtotal envio total estados_mixtos
    productos { id_plato nombre cantidad precio_unitario total imagen_url estado }
  }
}`;
const consultar = (id = '10', contexto = vendedor) => graphql({
  schema, source: consulta, variableValues: { id }, contextValue: contexto,
  rootValue: { obtenerPedidosVendedor: (args, ctx) => protegidos.Query.obtenerPedidosVendedor(null, args, ctx) },
});

before(async () => {
  await db.exec(`
    CREATE TABLE Usuarios (id_usuario INT PRIMARY KEY, nombre TEXT, email TEXT, rol TEXT, stripe_customer_id TEXT, puntos_acumulados INT DEFAULT 0);
    CREATE TABLE Restaurantes (id_restaurante INT PRIMARY KEY, id_usuario_dueño INT, nombre TEXT, tipo TEXT, latitud FLOAT8, longitud FLOAT8, radio_cobertura_km FLOAT8, aceptando_pedidos BOOLEAN DEFAULT TRUE, tiempo_reactivacion TIMESTAMPTZ, horarios_recogida JSONB);
    CREATE TABLE Platos (id_plato INT PRIMARY KEY, id_restaurante INT REFERENCES Restaurantes(id_restaurante), nombre TEXT, precio FLOAT8, categoria TEXT[], imagen_url TEXT, disponible BOOLEAN DEFAULT TRUE, tiempo_disponible TIMESTAMPTZ);
    CREATE TABLE Menu_Platos (id_menu INT REFERENCES Platos(id_plato), id_plato_incluido INT REFERENCES Platos(id_plato));
    CREATE TABLE Pedidos (id_pedido SERIAL PRIMARY KEY, id_usuario INT REFERENCES Usuarios(id_usuario), id_restaurante INT REFERENCES Restaurantes(id_restaurante), id_plato INT REFERENCES Platos(id_plato), metodo_pago TEXT, direccion_envio TEXT, fecha_programada TIMESTAMPTZ, estado TEXT, fecha_pedido TIMESTAMPTZ DEFAULT NOW());
  `);
  await db.exec(SQL_COMPRAS);
});
after(() => db.close());
beforeEach(async () => {
  secuencia = 0; correos = [];
  await db.exec(`
    TRUNCATE Notificaciones_Pedido, Pedidos, Compras, Menu_Platos, Platos, Restaurantes, Usuarios RESTART IDENTITY CASCADE;
    INSERT INTO Usuarios (id_usuario,nombre,email,rol) VALUES (1,'Laura','laura@example.test','CLIENTE'),(7,'Diego','diego@example.test','VENDEDOR'),(8,'Otro vendedor','otro@example.test','VENDEDOR');
    INSERT INTO Restaurantes (id_restaurante,id_usuario_dueño,nombre,tipo,latitud,longitud,radio_cobertura_km) VALUES (10,7,'Local de Diego','PIZZA',0,0,10),(20,8,'Otro local','PIZZA',0,0,10);
    INSERT INTO Platos (id_plato,id_restaurante,nombre,precio,categoria,imagen_url) VALUES (101,10,'Pizza',10,ARRAY['PLATO'],'pizza.jpg'),(102,10,'Limonada',2,ARRAY['BEBIDA'],'limonada.jpg'),(201,20,'Hamburguesa',9,ARRAY['PLATO'],'hamburguesa.jpg');
  `);
  avisos = crearNotificacionesPedidos(pool, async correo => { correos.push(correo); }, { ahora: () => reloj });
  conectar();
});

test('GraphQL devuelve una compra con sus productos, cantidades, fotos y total, usando un número estable', async () => {
  const compra = await comprar();
  assert.equal((await unidades(compra.id_compra)).length, 3);
  const respuesta = await consultar();
  assert.equal(respuesta.errors, undefined);
  const [pedido] = respuesta.data.obtenerPedidosVendedor;
  assert.equal(respuesta.data.obtenerPedidosVendedor.length, 1);
  assert.equal(pedido.id_pedido, '1');
  assert.equal(pedido.cantidad_total, 3);
  assert.equal(pedido.subtotal, 22); assert.equal(pedido.envio, 0); assert.equal(pedido.total, 22);
  assert.deepEqual(pedido.productos.map(p => [p.nombre, p.cantidad, p.precio_unitario, p.total, p.imagen_url]), [
    ['Pizza', 2, 10, 20, 'pizza.jpg'], ['Limonada', 1, 2, 2, 'limonada.jpg'],
  ]);
  assert.equal(pedido.estados_mixtos, false);
});

test('dos compras del mismo cliente y dirección siguen siendo pedidos distintos; cada local solo ve los suyos', async () => {
  await comprar(); await comprar();
  await comprar({ id_restaurante: '20', items: [{ id_plato: '201', cantidad: 1 }] });
  const lista = await obtener(null, { id_restaurante: '10' });
  assert.deepEqual(lista.map(p => p.id_pedido), [4, 1]);
  assert.ok(lista.every(p => p.cantidad_total === 3));
  const otra = await consultar('20', { usuario: { id_usuario: 8, rol: 'VENDEDOR' } });
  assert.equal(otra.data.obtenerPedidosVendedor.length, 1);
  assert.equal(otra.data.obtenerPedidosVendedor[0].productos[0].nombre, 'Hamburguesa');
});

test('el desglose incluye el envío una sola vez y conserva nombres y precios comprados aunque cambie el catálogo', async () => {
  await comprar({ items: [{ id_plato: '101', cantidad: 1 }] });
  await query("UPDATE Platos SET nombre = 'Pizza nueva', precio = 50 WHERE id_plato = 101");
  const [pedido] = await obtener(null, { id_restaurante: '10' });
  assert.equal(pedido.subtotal, 10); assert.equal(pedido.envio, 1.9); assert.equal(pedido.total, 11.9);
  assert.equal(pedido.productos[0].nombre, 'Pizza'); assert.equal(pedido.productos[0].precio_unitario, 10);
});

test('los pedidos antiguos sin identificador de compra no se mezclan ni inventan importes históricos', async () => {
  await db.exec("INSERT INTO Pedidos (id_usuario,id_restaurante,id_plato,metodo_pago,direccion_envio,estado) VALUES (1,10,101,'EFECTIVO','Misma dirección','PENDIENTE'),(1,10,102,'EFECTIVO','Misma dirección','PENDIENTE')");
  const lista = await obtener(null, { id_restaurante: '10' });
  assert.equal(lista.length, 2);
  assert.ok(lista.every(p => p.cantidad_total === 1 && p.total === null && p.productos[0].precio_unitario === null));
  await cambiar(1, 'PREPARANDO');
  assert.deepEqual((await query('SELECT estado FROM Pedidos ORDER BY id_pedido')).rows.map(p => p.estado), ['PREPARANDO', 'PENDIENTE']);
});

test('avanzar desde cualquier unidad cambia todo el pedido y genera un solo correo por estado', async () => {
  const compra = await comprar();
  const otra = await comprar();
  await cambiar(3, 'PREPARANDO'); await cambiar(2, 'PREPARANDO'); await cambiar(1, 'EN COCINA');
  assert.ok((await unidades(compra.id_compra)).every(p => p.estado === 'PREPARANDO'));
  assert.ok((await unidades(otra.id_compra)).every(p => p.estado === 'PENDIENTE'));
  assert.equal((await eventos()).length, 1);
  for (const estado of ['ENVIADO', 'ENTREGADO']) await cambiar(2, estado);
  assert.ok((await unidades(compra.id_compra)).every(p => p.estado === 'ENTREGADO'));
  const [pedido] = (await obtener(null, { id_restaurante: '10' })).filter(p => p.id_compra === compra.id_compra);
  assert.equal(pedido.id_pedido, 1); assert.equal(pedido.estado, 'ENTREGADO');
  await avisos.procesarPendientes();
  assert.equal(correos.length, 3);
  assert.ok(correos.every(c => c.text.includes('2 × Pizza') && c.text.includes('1 × Limonada') && c.subject.includes('#1')));
});

test('si falla guardar el aviso, se revierten todas las unidades del pedido', async () => {
  const compra = await comprar();
  conectar(async (...args) => { await avisos.registrar(...args); throw new Error('Fallo de almacenamiento simulado'); });
  await assert.rejects(cambiar(2, 'PREPARANDO'), /Fallo de almacenamiento/);
  assert.ok((await unidades(compra.id_compra)).every(p => p.estado === 'PENDIENTE'));
  assert.equal((await eventos()).length, 0);
});

test('los estados desiguales de pedidos anteriores se completan sin retroceder ni reabrir productos entregados', async () => {
  const compra = await comprar();
  await query("UPDATE Pedidos SET estado = CASE id_pedido WHEN 1 THEN 'ENTREGADO' WHEN 2 THEN 'EN CAMINO' ELSE 'PENDIENTE' END");
  let [pedido] = await obtener(null, { id_restaurante: '10' });
  assert.equal(pedido.estado, 'PENDIENTE'); assert.equal(pedido.estados_mixtos, true);
  await cambiar(1, 'PREPARANDO');
  assert.deepEqual((await unidades(compra.id_compra)).map(p => p.estado), ['ENTREGADO', 'EN CAMINO', 'PREPARANDO']);
  await cambiar(2, 'ENVIADO'); await cambiar(3, 'ENTREGADO');
  [pedido] = await obtener(null, { id_restaurante: '10' });
  assert.equal(pedido.estado, 'ENTREGADO'); assert.equal(pedido.estados_mixtos, false);
});

test('los permisos protegen tanto la consulta agrupada como el cambio de todos sus productos', async () => {
  await comprar();
  for (const ctx of [{}, cliente, { usuario: { id_usuario: 8, rol: 'VENDEDOR' } }]) {
    const respuesta = await consultar('10', ctx);
    assert.ok(respuesta.errors?.length);
    await assert.rejects(cambiar(2, 'PREPARANDO', ctx), /Inicia sesión|no pertenece/);
  }
  assert.ok((await query('SELECT estado FROM Pedidos')).rows.every(p => p.estado === 'PENDIENTE'));
});

test('ninguna unidad puede prepararse con pago sin confirmar o con una reserva aún pendiente', async () => {
  const compra = await comprar();
  await query("UPDATE Compras SET estado = 'AUTORIZADA' WHERE id_compra = $1", [compra.id_compra]);
  await assert.rejects(cambiar(2, 'PREPARANDO'), /reservado|confirmar/);
  await query("UPDATE Compras SET estado = 'CONFIRMADA' WHERE id_compra = $1", [compra.id_compra]);
  await query("UPDATE Pedidos SET estado = 'PROGRAMADO', fecha_programada = $1 WHERE id_pedido = 3", [new Date(reloj.getTime() + 3600000)]);
  await assert.rejects(cambiar(1, 'PREPARANDO'), /reservado|confirmar/);
  assert.equal((await eventos()).length, 0);
});

test('no se permite retroceder, cancelar tras empezar la preparación ni reabrir un pedido terminado', async () => {
  const compra = await comprar();
  await cambiar(2, 'PREPARANDO');
  await assert.rejects(cambiar(1, 'PENDIENTE'), /estado anterior/);
  await assert.rejects(cambiar(3, 'CANCELADO'), /preparación/);
  await cambiar(1, 'ENTREGADO');
  await assert.rejects(cambiar(2, 'PREPARANDO'), /finalizado/);
  assert.ok((await unidades(compra.id_compra)).every(p => p.estado === 'ENTREGADO'));
});

test('cancelar el pedido cancela todos sus productos, conserva una tarjeta y registra un solo aviso', async () => {
  const compra = await comprar();
  await cambiar(2, 'CANCELADO'); await cambiar(3, 'CANCELADO');
  const lista = await obtener(null, { id_restaurante: '10' });
  assert.equal(lista.length, 1); assert.equal(lista[0].estado, 'CANCELADO');
  assert.equal(lista[0].cantidad_total, 3);
  assert.ok((await unidades(compra.id_compra)).every(p => p.estado === 'CANCELADO'));
  assert.equal((await eventos()).length, 1);
  await avisos.procesarPendientes();
  assert.equal(correos.length, 1);
  assert.match(correos[0].subject, /Pedido cancelado.*#1/);
  assert.match(correos[0].text, /2 × Pizza.*1 × Limonada/);
  assert.ok(!correos[0].text.includes('Pedidos incluidos'));
});
