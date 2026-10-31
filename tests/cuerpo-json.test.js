import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import cuerpoJson from '../config/cuerpoJson.js';
import { MAX_BYTES_IMAGEN, MAX_BYTES_PETICION_JSON, MENSAJE_IMAGEN_GRANDE } from '../shared/limitesImagen.js';

async function servidorPrueba(t) {
  const app = express();
  let peticionesProcesadas = 0;
  app.use(cuerpoJson);
  app.post('/graphql', (req, res) => {
    peticionesProcesadas++;
    res.json({ query: req.body.query, imagen: req.body.variables?.imagen_url });
  });
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ tipo: error.type }));
  const servidor = createServer(app);
  await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {
    servidor.close(resolve);
    servidor.closeAllConnections();
  }));
  return {
    enviar: body => fetch(`http://127.0.0.1:${servidor.address().port}/graphql`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    }),
    get peticionesProcesadas() { return peticionesProcesadas; },
  };
}

test('las consultas JSON pequeñas siguen llegando a la API', async t => {
  const servidor = await servidorPrueba(t);
  const respuesta = await servidor.enviar(JSON.stringify({ query: '{ __typename }' }));
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { query: '{ __typename }' });
});

test('una foto de 5 MB en base64 supera el antiguo límite de 100 KB y llega completa', async t => {
  const servidor = await servidorPrueba(t);
  const imagen = 'data:image/jpeg;base64,' + Buffer.alloc(MAX_BYTES_IMAGEN, 1).toString('base64');
  const cuerpo = JSON.stringify({ query: 'mutation CrearPlato', variables: { imagen_url: imagen } });
  assert.ok(Buffer.byteLength(cuerpo) > 100 * 1024);
  const respuesta = await servidor.enviar(cuerpo);
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).imagen, imagen);
  assert.equal(servidor.peticionesProcesadas, 1);
});

test('una petición que supera los 10 MB devuelve un 413 claro sin llegar a la API', async t => {
  const servidor = await servidorPrueba(t);
  const respuesta = await servidor.enviar(JSON.stringify({ imagen: 'x'.repeat(MAX_BYTES_PETICION_JSON) }));
  assert.equal(respuesta.status, 413);
  assert.deepEqual(await respuesta.json(), {
    errors: [{ message: MENSAJE_IMAGEN_GRANDE, extensions: { code: 'PAYLOAD_TOO_LARGE' } }],
  });
  assert.equal(servidor.peticionesProcesadas, 0);
});

test('el JSON mal formado conserva el error 400 y no llega a la API', async t => {
  const servidor = await servidorPrueba(t);
  const respuesta = await servidor.enviar('{');
  assert.equal(respuesta.status, 400);
  assert.equal((await respuesta.json()).tipo, 'entity.parse.failed');
  assert.equal(servidor.peticionesProcesadas, 0);
});
