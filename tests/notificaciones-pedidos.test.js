import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { SQL_COMPRAS } from '../graphql/migracionCompras.js';
import { crearNotificacionesPedidos } from '../graphql/notificacionesPedidos.js';
import { crearActualizadorEstadoPedido } from '../graphql/actualizarEstadoPedido.js';

const db = new PGlite();
const query = (sql, valores) => db.query(sql, valores);
const pool = { query };
let reloj, enviados, avisos, actualizar, despertares;
const cambiar = (estado, id = 1) => actualizar(null, { id_pedido: id, nuevo_estado: estado }, { conexionConsulta: { query } });
const pendientes = () => db.query('SELECT * FROM Notificaciones_Pedido ORDER BY id_notificacion').then(r => r.rows);

before(async () => {
  await db.exec(`
    CREATE TABLE Usuarios (id_usuario INT PRIMARY KEY, nombre TEXT, email TEXT);
    CREATE TABLE Restaurantes (id_restaurante INT PRIMARY KEY, nombre TEXT);
    CREATE TABLE Platos (id_plato INT PRIMARY KEY, id_restaurante INT, nombre TEXT);
    CREATE TABLE Pedidos (id_pedido SERIAL PRIMARY KEY, id_usuario INT REFERENCES Usuarios(id_usuario), id_restaurante INT, id_plato INT, estado TEXT, direccion_envio TEXT);
  `);
  await db.exec(SQL_COMPRAS);
  await db.exec(SQL_COMPRAS);
});
after(() => db.close());
beforeEach(async () => {
  reloj = new Date('2026-10-31T12:00:00Z');
  enviados = []; despertares = 0;
  await db.exec(`
    TRUNCATE Notificaciones_Pedido, Pedidos, Compras, Platos, Restaurantes, Usuarios RESTART IDENTITY CASCADE;
    INSERT INTO Usuarios VALUES (1, 'Laura', 'cliente@example.test');
    INSERT INTO Restaurantes VALUES (10, 'Local de Diego');
    INSERT INTO Platos VALUES (101, 10, 'Pizza');
    INSERT INTO Pedidos (id_usuario, id_restaurante, id_plato, estado, direccion_envio) VALUES (1, 10, 101, 'PENDIENTE', 'Dirección de prueba');
  `);
  avisos = crearNotificacionesPedidos(pool, async mensaje => { enviados.push(mensaje); }, { ahora: () => reloj });
  actualizar = crearActualizadorEstadoPedido({ registrar: avisos.registrar, despertar: () => { despertares++; } });
});

test('los cambios rápidos conservan un correo distinto y ordenado por cada estado', async () => {
  for (const estado of ['PREPARANDO', 'ENVIADO', 'ENTREGADO']) await cambiar(estado);
  assert.equal(enviados.length, 0, 'Guardar el estado no debe esperar a la API de correo');
  assert.deepEqual((await pendientes()).map(n => n.datos.estado), ['PREPARANDO', 'ENVIADO', 'ENTREGADO']);
  assert.equal(despertares, 3);
  await avisos.procesarPendientes();
  assert.deepEqual(enviados.map(m => m.subject.split(' · ')[0]), ['En preparación', 'En camino', 'Entregado']);
  assert.ok(enviados.every(m => m.to === 'cliente@example.test' && m.text.includes('#1') && m.text.includes('Pizza') && m.text.includes('Local de Diego')));
  assert.ok((await pendientes()).every(n => n.enviada));
});

test('repetir el mismo estado o su alias no crea avisos duplicados', async () => {
  await cambiar('PREPARANDO');
  await cambiar('PREPARANDO');
  await cambiar('EN COCINA');
  assert.equal((await pendientes()).length, 1);
  assert.equal(despertares, 1);
  await avisos.procesarPendientes();
  await avisos.procesarPendientes();
  assert.equal(enviados.length, 1);
});

test('si no se puede guardar el aviso, se revierte también el cambio del pedido', async () => {
  actualizar = crearActualizadorEstadoPedido({
    registrar: async (...args) => { await avisos.registrar(...args); throw new Error('Fallo de almacenamiento simulado'); },
    despertar: () => { despertares++; },
  });
  await assert.rejects(cambiar('PREPARANDO'), /Fallo de almacenamiento/);
  assert.equal((await db.query('SELECT estado FROM Pedidos WHERE id_pedido = 1')).rows[0].estado, 'PENDIENTE');
  assert.equal((await pendientes()).length, 0);
  assert.equal(despertares, 0);
});

test('un fallo temporal se reintenta tras reiniciar y no adelanta los estados posteriores', async () => {
  await cambiar('PREPARANDO'); await cambiar('ENVIADO');
  const fallidas = crearNotificacionesPedidos(pool, async () => { throw Object.assign(new Error('Fallo simulado'), { code: 'CORREO_HTTP_429' }); }, { ahora: () => reloj });
  await fallidas.procesarPendientes();
  const filas = await pendientes();
  assert.equal(filas[0].ultimo_error, 'CORREO_HTTP_429');
  assert.equal(filas[0].intentos, 1);
  assert.equal(filas[1].intentos, 0);
  await avisos.procesarPendientes();
  assert.equal(enviados.length, 0);
  reloj = new Date(reloj.getTime() + 16000);
  const reiniciadas = crearNotificacionesPedidos(pool, async mensaje => { enviados.push(mensaje); }, { ahora: () => reloj });
  await reiniciadas.procesarPendientes();
  assert.deepEqual(enviados.map(m => m.subject.split(' · ')[0]), ['En preparación', 'En camino']);
});

test('dos trabajadores no duplican avisos y un correo lento no bloquea nuevos estados', { timeout: 5000 }, async t => {
  let terminar, anunciar, trabajo;
  const espera = new Promise(resolve => { terminar = resolve; });
  const inicio = new Promise(resolve => { anunciar = resolve; });
  t.after(async () => { terminar(); await trabajo; });
  const lentas = crearNotificacionesPedidos(pool, async mensaje => {
    enviados.push(mensaje);
    if (enviados.length === 1) { anunciar(); await espera; }
  }, { ahora: () => reloj });
  await cambiar('PREPARANDO');
  trabajo = lentas.procesarPendientes();
  await inicio;
  await cambiar('ENVIADO');
  await avisos.procesarPendientes();
  assert.equal(enviados.length, 1);
  assert.equal((await db.query('SELECT estado FROM Pedidos WHERE id_pedido = 1')).rows[0].estado, 'ENVIADO');
  terminar(); await trabajo;
  assert.deepEqual(enviados.map(m => m.subject.split(' · ')[0]), ['En preparación', 'En camino']);
});

test('una reserva temporal de envío caducada se recupera después de una caída', async () => {
  await cambiar('PREPARANDO');
  await db.query("UPDATE Notificaciones_Pedido SET intentos = 1, proximo_intento = $1::timestamptz + INTERVAL '2 minutes'", [reloj]);
  await avisos.procesarPendientes();
  assert.equal(enviados.length, 0);
  reloj = new Date(reloj.getTime() + 121000);
  await avisos.procesarPendientes();
  assert.equal(enviados.length, 1);
});

test('la recogida utiliza los textos listo para recoger y recogido', async () => {
  await db.query("UPDATE Pedidos SET direccion_envio = 'RECOGIDA EN LOCAL' WHERE id_pedido = 1");
  await cambiar('ENVIADO'); await cambiar('ENTREGADO');
  await avisos.procesarPendientes();
  assert.deepEqual(enviados.map(m => m.subject.split(' · ')[0]), ['Listo para recoger', 'Recogido']);
  assert.ok(enviados[0].text.includes('listo para recoger'));
});
