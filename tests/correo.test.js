import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioCorreo } from '../config/correo.js';

const envBrevo = { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'clave-ficticia-prueba', EMAIL_FROM: 'verificado@example.test' };
const mensaje = { from: '"Soporte NexBite" <original@example.test>', to: 'cliente@example.test', subject: 'Tu pedido', text: 'Pedido confirmado', html: '<p>Pedido confirmado</p>' };

test('Brevo envía por HTTPS con remitente verificado y sin utilizar SMTP', async () => {
  let peticion;
  const correo = crearServicioCorreo({
    env: envBrevo,
    crearTransporte: () => { throw new Error('No debe usar SMTP'); },
    fetchImpl: async (url, opciones) => {
      peticion = { url, opciones, cuerpo: JSON.parse(opciones.body) };
      return new Response(JSON.stringify({ messageId: '<correo-prueba>' }), { status: 201 });
    },
  });
  assert.deepEqual(await correo.sendMail(mensaje), { messageId: '<correo-prueba>' });
  assert.equal(peticion.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(peticion.opciones.method, 'POST');
  assert.equal(peticion.opciones.redirect, 'error');
  assert.equal(peticion.opciones.headers['api-key'], envBrevo.BREVO_API_KEY);
  assert.equal(peticion.opciones.signal.aborted, false);
  assert.deepEqual(peticion.cuerpo.sender, { email: envBrevo.EMAIL_FROM, name: 'Soporte NexBite' });
  assert.deepEqual(peticion.cuerpo.to, [{ email: mensaje.to }]);
  assert.equal(peticion.cuerpo.subject, mensaje.subject);
  assert.equal(peticion.cuerpo.htmlContent, mensaje.html);
  assert.equal(peticion.cuerpo.textContent, mensaje.text);
  assert.ok(!peticion.opciones.body.includes(envBrevo.BREVO_API_KEY));
});

test('una configuración incompleta no envía peticiones ni impide iniciar el servicio', async () => {
  for (const env of [{ EMAIL_PROVIDER: 'brevo' }, { EMAIL_PROVIDER: 'desconocido' }, { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'ficticia' }]) {
    const correo = crearServicioCorreo({ env, fetchImpl: async () => { throw new Error('No debe hacer peticiones'); } });
    await assert.rejects(correo.sendMail({ ...mensaje, from: undefined }), { code: 'CORREO_NO_CONFIGURADO' });
  }
});

test('los rechazos de Brevo conservan el código HTTP sin exponer la respuesta ni la clave', async () => {
  for (const status of [401, 429]) {
    const correo = crearServicioCorreo({
      env: envBrevo,
      fetchImpl: async () => new Response(JSON.stringify({ message: 'dato-privado@example.test ' + envBrevo.BREVO_API_KEY }), { status }),
    });
    await assert.rejects(correo.sendMail(mensaje), error => {
      assert.equal(error.code, 'CORREO_HTTP_' + status);
      assert.ok(!error.message.includes(envBrevo.BREVO_API_KEY));
      assert.ok(!error.message.includes('dato-privado'));
      return true;
    });
  }
});

test('una respuesta sin identificador de correo no se considera un envío aceptado', async () => {
  for (const body of ['{}', 'respuesta incompleta']) {
    const correo = crearServicioCorreo({ env: envBrevo, fetchImpl: async () => new Response(body, { status: 201 }) });
    await assert.rejects(correo.sendMail(mensaje), { code: 'CORREO_RESPUESTA_INVALIDA' });
  }
});

test('los fallos de red y tiempos de espera generan errores que permiten reintentar', async () => {
  for (const [fallo, code] of [[new DOMException('Espera agotada', 'TimeoutError'), 'CORREO_TIEMPO_AGOTADO'], [new TypeError('Fallo de red'), 'CORREO_CONEXION']]) {
    const correo = crearServicioCorreo({ env: envBrevo, fetchImpl: async () => { throw fallo; } });
    await assert.rejects(correo.sendMail(mensaje), { code });
  }
});

test('el transporte de Gmail sigue disponible en local y no intenta enviar sin credenciales', async () => {
  let opciones, envios = 0;
  const crearTransporte = configuracion => {
    opciones = configuracion;
    return { sendMail: async recibido => { envios++; assert.deepEqual(recibido, mensaje); return { messageId: 'smtp-prueba' }; } };
  };
  const correo = crearServicioCorreo({ env: { EMAIL_PROVIDER: 'smtp', EMAIL_USER: 'local@example.test', EMAIL_PASS: 'ficticia' }, crearTransporte });
  assert.deepEqual(await correo.sendMail(mensaje), { messageId: 'smtp-prueba' });
  assert.equal(opciones.service, 'gmail');
  assert.equal(opciones.connectionTimeout, 5000);
  assert.equal(opciones.socketTimeout, 10000);
  const sinConfigurar = crearServicioCorreo({ env: {}, crearTransporte });
  await assert.rejects(sinConfigurar.sendMail(mensaje), { code: 'CORREO_NO_CONFIGURADO' });
  assert.equal(envios, 1);
});
