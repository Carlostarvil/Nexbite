import test from 'node:test';
import assert from 'node:assert/strict';
import { detalleErrorCompra, mensajeCompraPendiente, registrarErrorCompra } from '../shared/erroresCompra.js';

test('distingue una compra en proceso de una sesión caducada usando errores de Apollo', () => {
  const enProceso = { errors: [{ extensions: { code: 'COMPRA_EN_PROCESO' } }] };
  assert.equal(mensajeCompraPendiente(enProceso).titulo, 'Tu compra sigue en proceso');
  assert.match(mensajeCompraPendiente(enProceso).descripcion, /mismo pedido/);
  const sesion = { graphQLErrors: [{ extensions: { code: 'UNAUTHENTICATED' } }] };
  assert.equal(mensajeCompraPendiente(sesion).titulo, 'Inicia sesión para comprobar tu compra');
  assert.match(mensajeCompraPendiente(sesion).descripcion, /misma cuenta/);
});

test('los errores HTTP de la compra indican la acción apropiada sin afirmar que se ha cobrado', () => {
  assert.match(mensajeCompraPendiente({ statusCode: 401 }).descripcion, /sesión/);
  assert.match(mensajeCompraPendiente({ networkError: { statusCode: 403 } }).descripcion, /cuenta/);
  assert.match(mensajeCompraPendiente({ statusCode: 429 }).descripcion, /demasiadas peticiones/);
  assert.match(mensajeCompraPendiente({ statusCode: 503 }).descripcion, /no inicies otra compra/);
  assert.match(mensajeCompraPendiente(new TypeError('Failed to fetch')).descripcion, /conexión/);
});

test('los fallos del servidor conservan el código de diagnóstico sin mostrar datos internos al cliente', () => {
  const error = { errors: [{ extensions: { code: 'COMPRA_SERVIDOR_NO_DISPONIBLE', codigo_incidente: '42883' } }] };
  assert.deepEqual(detalleErrorCompra(error), {
    codigo: 'COMPRA_SERVIDOR_NO_DISPONIBLE', codigo_incidente: '42883', estado_http: null,
  });
  assert.match(mensajeCompraPendiente(error).descripcion, /misma referencia/);
  assert.doesNotMatch(mensajeCompraPendiente(error).descripcion, /42883/);
});

test('los registros no contienen mensajes, claves de Stripe, tarjetas ni respuestas completas', t => {
  const registro = t.mock.method(console, 'error', () => {});
  registrarErrorCompra('carrito', 'confirmar', 'compra-prueba-000001', {
    message: 'Credencial de prueba sk_test_secreto', name: 'ServerError', statusCode: 500,
    bodyText: 'pi_privada_secret_no_publicar', paymentIntent: { client_secret: 'privado' },
    errors: [{ extensions: { code: 'COMPRA_SERVIDOR_NO_DISPONIBLE', codigo_incidente: 'ECONNRESET' } }],
  });
  const registrado = registro.mock.calls[0].arguments;
  assert.deepEqual(registrado[1], {
    origen: 'carrito', etapa: 'confirmar', id_compra: 'compra-prueba-000001',
    codigo: 'COMPRA_SERVIDOR_NO_DISPONIBLE', codigo_incidente: 'ECONNRESET', estado_http: 500,
  });
  assert.doesNotMatch(JSON.stringify(registrado), /sk_test|client_secret|paymentIntent|pi_privada|secreto/);
  assert.equal(detalleErrorCompra({ code: 'no\nes seguro', statusCode: 999 }).codigo, 'ERROR_DESCONOCIDO');
});
