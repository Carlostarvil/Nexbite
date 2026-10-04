import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchema, parse, validate } from 'graphql';
import { typeDefs } from '../graphql/typeDefs.js';
import { crearOperacionesPago } from '../graphql/pagos.js';

const contexto = id => ({ usuario: { id_usuario: id, rol: 'CLIENTE' } });
const pago = { monto: 12.5, id_tarjeta: 'pm_propietario', clave_pago: 'b60c69a7-0cf5-4f22-9b6b-2116f0c3d583' };

function entorno() {
  const usuarios = new Map([
    [7, { nombre: 'Cliente', email: 'cliente@example.test', stripe_customer_id: null }],
    [8, { nombre: 'Otro', email: 'otro@example.test', stripe_customer_id: 'cus_otro' }],
  ]);
  const tarjetas = new Map([
    ['pm_propietario', { id: 'pm_propietario', type: 'card', customer: null, card: { brand: 'visa', last4: '4242' }, billing_details: { name: 'Cliente' } }],
    ['pm_ajeno', { id: 'pm_ajeno', type: 'card', customer: 'cus_otro', card: { brand: 'visa', last4: '1111' } }],
  ]);
  const llamadas = { clientes: [], configuraciones: [], pagos: [], eliminadas: [], transacciones: [], liberadas: 0 };
  const query = async (sql, valores) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) { llamadas.transacciones.push(sql); return { rows: [] }; }
    if (sql.startsWith('SELECT')) return { rows: usuarios.has(Number(valores[0])) ? [{ ...usuarios.get(Number(valores[0])) }] : [] };
    if (sql.startsWith('UPDATE')) { usuarios.get(Number(valores[1])).stripe_customer_id = valores[0]; return { rows: [] }; }
    throw new Error('Consulta inesperada');
  };
  const pool = { query, connect: async () => ({ query, release: () => llamadas.liberadas++ }) };
  const intenciones = new Map();
  const stripe = {
    customers: { create: async (datos, opciones) => {
      llamadas.clientes.push({ datos, opciones });
      return { id: 'cus_' + datos.metadata.id_usuario };
    } },
    setupIntents: { create: async datos => {
      llamadas.configuraciones.push(datos);
      return { client_secret: 'seti_prueba_secret' };
    } },
    paymentMethods: {
      retrieve: async id => {
        if (!tarjetas.has(id)) throw Object.assign(new Error('No existe'), { code: 'resource_missing' });
        return tarjetas.get(id);
      },
      list: async ({ customer }) => ({ data: [...tarjetas.values()].filter(t => t.customer === customer) }),
      detach: async id => { llamadas.eliminadas.push(id); tarjetas.get(id).customer = null; },
    },
    paymentIntents: { create: async (datos, opciones) => {
      llamadas.pagos.push({ datos, opciones });
      assert.equal(tarjetas.get(datos.payment_method).customer, datos.customer);
      if (!intenciones.has(opciones.idempotencyKey)) intenciones.set(opciones.idempotencyKey, { client_secret: 'pi_' + intenciones.size + '_secret' });
      return intenciones.get(opciones.idempotencyKey);
    } },
  };
  return { usuarios, tarjetas, llamadas, stripe, ...crearOperacionesPago(pool, stripe) };
}

test('guardar la tarjeta crea y conserva un cliente de Stripe por cuenta', async () => {
  const e = entorno();
  assert.equal(await e.Mutation.crearConfiguracionTarjeta(null, {}, contexto(7)), 'seti_prueba_secret');
  assert.equal(e.usuarios.get(7).stripe_customer_id, 'cus_7');
  await e.Mutation.crearConfiguracionTarjeta(null, {}, contexto(7));
  assert.equal(e.llamadas.clientes.length, 1);
  assert.deepEqual(e.llamadas.transacciones, ['BEGIN', 'COMMIT']);
  assert.equal(e.llamadas.liberadas, 1);
  assert.deepEqual(e.llamadas.configuraciones, [1, 2].map(() => ({ customer: 'cus_7', payment_method_types: ['card'], usage: 'on_session' })));
});

test('rechaza gestiones de tarjetas y pagos sin iniciar sesión', async () => {
  const e = entorno();
  for (const ctx of [undefined, {}, { usuario: null }]) {
    await assert.rejects(e.Query.obtenerMisTarjetas(null, { id_usuario: '7' }, ctx), /Inicia sesión/);
    await assert.rejects(e.Mutation.crearConfiguracionTarjeta(null, {}, ctx), /Inicia sesión/);
    await assert.rejects(e.Mutation.crearIntencionPago(null, pago, ctx), /Inicia sesión/);
    await assert.rejects(e.Mutation.eliminarTarjetaGuardada(null, { id_tarjeta: 'pm_ajeno' }, ctx), /Inicia sesión/);
  }
  assert.equal(e.llamadas.clientes.length + e.llamadas.pagos.length + e.llamadas.eliminadas.length, 0);
});

test('si Stripe falla al crear el cliente, revierte la transacción y permite reintentar', async t => {
  const e = entorno();
  const crear = e.stripe.customers.create;
  t.mock.method(console, 'error', () => {});
  e.stripe.customers.create = async () => { throw Object.assign(new Error('Fallo de conexión'), { type: 'StripeConnectionError' }); };
  await assert.rejects(e.Mutation.crearConfiguracionTarjeta(null, {}, contexto(7)), error => error.extensions.code === 'PASARELA_NO_DISPONIBLE');
  assert.deepEqual(e.llamadas.transacciones, ['BEGIN', 'ROLLBACK']);
  assert.equal(e.llamadas.liberadas, 1);
  assert.equal(e.usuarios.get(7).stripe_customer_id, null);
  e.stripe.customers.create = crear;
  assert.equal(await e.Mutation.crearConfiguracionTarjeta(null, {}, contexto(7)), 'seti_prueba_secret');
  assert.equal(e.usuarios.get(7).stripe_customer_id, 'cus_7');
});

test('las tarjetas de una cuenta no aparecen en otra ni se pueden consultar por su ID', async () => {
  const e = entorno();
  assert.deepEqual(await e.Query.obtenerMisTarjetas(null, { id_usuario: '7' }, contexto(7)), []);
  await assert.rejects(e.Query.obtenerMisTarjetas(null, { id_usuario: '8' }, contexto(7)), /propias tarjetas/);
  const tarjetas = await e.Query.obtenerMisTarjetas(null, { id_usuario: '8' }, contexto(8));
  assert.deepEqual(tarjetas.map(t => t.id), ['pm_ajeno']);
});

test('una tarjeta sin vincular, ajena o inexistente no inicia un cobro', async () => {
  const e = entorno();
  e.usuarios.get(7).stripe_customer_id = 'cus_7';
  for (const id_tarjeta of ['pm_propietario', 'pm_ajeno', 'pm_inexistente', 'id_invalido']) {
    await assert.rejects(e.Mutation.crearIntencionPago(null, { ...pago, id_tarjeta }, contexto(7)), error => error.extensions.code === 'TARJETA_NO_DISPONIBLE');
  }
  assert.equal(e.llamadas.pagos.length, 0);
});

test('la misma tarjeta vinculada sirve para dos compras independientes', async () => {
  const e = entorno();
  e.usuarios.get(7).stripe_customer_id = 'cus_7';
  e.tarjetas.get('pm_propietario').customer = 'cus_7';
  const primero = await e.Mutation.crearIntencionPago(null, pago, contexto(7));
  const segundo = await e.Mutation.crearIntencionPago(null, { ...pago, monto: 9.99, clave_pago: 'b60c69a7-0cf5-4f22-9b6b-2116f0c3d584' }, contexto(7));
  assert.notEqual(primero, segundo);
  assert.deepEqual(e.llamadas.pagos.map(p => [p.datos.customer, p.datos.payment_method, p.datos.amount]), [
    ['cus_7', 'pm_propietario', 1250], ['cus_7', 'pm_propietario', 999],
  ]);
});

test('un reintento con la misma clave reutiliza la intención de pago', async () => {
  const e = entorno();
  e.usuarios.get(7).stripe_customer_id = 'cus_7';
  e.tarjetas.get('pm_propietario').customer = 'cus_7';
  assert.equal(await e.Mutation.crearIntencionPago(null, pago, contexto(7)), await e.Mutation.crearIntencionPago(null, pago, contexto(7)));
  assert.equal(e.llamadas.pagos[0].opciones.idempotencyKey, e.llamadas.pagos[1].opciones.idempotencyKey);
});

test('rechaza importes o identificadores inválidos antes de iniciar cobros', async () => {
  const e = entorno();
  for (const monto of [0, -2, NaN, Infinity, 0.1, 1_000_000]) await assert.rejects(e.Mutation.crearIntencionPago(null, { ...pago, monto }, contexto(7)), /importe/);
  await assert.rejects(e.Mutation.crearIntencionPago(null, { ...pago, clave_pago: 'corta' }, contexto(7)), /identificador/);
  assert.equal(e.llamadas.pagos.length, 0);
});

test('solo el propietario puede eliminar una tarjeta y deja de aparecer en su cuenta', async () => {
  const e = entorno();
  e.usuarios.get(7).stripe_customer_id = 'cus_7';
  e.tarjetas.get('pm_propietario').customer = 'cus_7';
  await assert.rejects(e.Mutation.eliminarTarjetaGuardada(null, { id_tarjeta: 'pm_ajeno' }, contexto(7)), /Añádela de nuevo/);
  assert.equal(await e.Mutation.eliminarTarjetaGuardada(null, { id_tarjeta: 'pm_propietario' }, contexto(7)), true);
  assert.deepEqual(await e.Query.obtenerMisTarjetas(null, { id_usuario: '7' }, contexto(7)), []);
  assert.deepEqual(e.llamadas.eliminadas, ['pm_propietario']);
});

test('las consultas y mutaciones del cliente son válidas en el esquema', () => {
  const schema = buildSchema(typeDefs);
  for (const consulta of [
    'query { obtenerMisTarjetas(id_usuario: "7") { id brand last4 name } }',
    'mutation { crearConfiguracionTarjeta }',
    'mutation { eliminarTarjetaGuardada(id_tarjeta: "pm_propietario") }',
    'mutation { crearIntencionPago(monto: 12.5, id_tarjeta: "pm_propietario", clave_pago: "b60c69a7-0cf5-4f22-9b6b-2116f0c3d583") }',
  ]) assert.deepEqual(validate(schema, parse(consulta)), []);
});
