import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularDistancia, coordenadasValidas, validarZonaEntrega } from '../shared/zonaEntrega.js';
import { crearConsultasZona, filtroZona } from '../graphql/consultasZona.js';
import { crearBuscadorDirecciones } from '../graphql/direcciones.js';

test('acepta coordenadas cero y rechaza ubicaciones ausentes o fuera del mundo', () => {
  assert.equal(coordenadasValidas(0, 0), true);
  assert.equal(coordenadasValidas('41.39', '2.17'), true);
  for (const lat of [null, undefined, '', ' ', false, NaN, Infinity, 91, -91]) assert.equal(coordenadasValidas(lat, 0), false);
  assert.equal(coordenadasValidas(0, 181), false);
});

test('comprueba el radio de cada local, incluyendo el límite exacto', () => {
  const local = { latitud: 0, longitud: 0, radio_cobertura_km: 5 };
  const latitudLimite = 5 / 6371 * 180 / Math.PI;
  assert.equal(validarZonaEntrega(local, 0, 0), 0);
  assert.ok(Math.abs(validarZonaEntrega(local, latitudLimite, 0) - 5) < 1e-6);
  assert.throws(() => validarZonaEntrega(local, latitudLimite + .001, 0), /no entrega/);
  assert.throws(() => validarZonaEntrega(local, null, 0), /Selecciona la dirección/);
  assert.throws(() => validarZonaEntrega({ ...local, radio_cobertura_km: null }, 0, 0), /no tiene una zona/);
  assert.throws(() => validarZonaEntrega({ ...local, latitud: null }, 0, 0), /no tiene una zona/);
  assert.ok(Number.isFinite(calcularDistancia(0, 0, 0, 180)));
});

test('la búsqueda de recogida usa distancia propia y la de reparto usa el radio del local', () => {
  const valores = ['usuario'];
  const reparto = filtroZona({ latitud: 0, longitud: 0, solo_con_entrega: true }, valores);
  assert.deepEqual(valores, ['usuario', 0, 0]);
  assert.match(reparto.condicion, /r\.radio_cobertura_km/);
  const recogida = filtroZona({ latitud: 0, longitud: 0 }, []);
  assert.doesNotMatch(recogida.condicion, /radio_cobertura_km/);
  assert.equal(filtroZona({}, []).condicion, 'TRUE', 'Las consultas del historial conservan compatibilidad');
  assert.throws(() => filtroZona({ solo_con_entrega: true }, []), /ubicación válida/);
  assert.throws(() => filtroZona({ latitud: 0, longitud: 0, radio_km: -1 }, []), /radio de búsqueda/);
});

test('los listados de descubrimiento y el buscador aplican la zona antes de LIMIT y usan parámetros SQL', async () => {
  const llamadas = [];
  const consultas = crearConsultasZona({ query: async (sql, valores) => { llamadas.push({ sql, valores }); return { rows: [] }; } });
  const args = { latitud: 41.39, longitud: 2.17, solo_con_entrega: true, id_usuario: '7', termino: "pizza' OR TRUE" };
  for (const nombre of Object.keys(consultas).filter(nombre => nombre !== 'obtenerUltimosPedidos')) {
    await consultas[nombre](null, args);
    const { sql, valores } = llamadas.at(-1);
    assert.match(sql, /WHERE[\s\S]*r\.radio_cobertura_km/);
    if (sql.includes('LIMIT')) assert.ok(sql.indexOf('radio_cobertura_km') < sql.lastIndexOf('LIMIT'));
    assert.ok(valores.includes(41.39));
    assert.doesNotMatch(sql, /pizza/);
  }
  assert.match(llamadas[0].sql, /SELECT r\.\*/); // El mapa incluye fotos y dirección.
});

test('la dirección manual y GPS se normalizan y se reutilizan sin nuevas peticiones', async () => {
  const llamadas = [];
  const features = [{ geometry: { coordinates: [2.17, 41.39] }, properties: { street: 'Calle Prueba', housenumber: '12', city: 'Barcelona', country: 'España' } }];
  const consultas = crearBuscadorDirecciones({ intervaloMs: 0, fetchImpl: async url => { llamadas.push(url); return { ok: true, json: async () => ({ features }) }; } });
  const [primera, segunda] = await Promise.all([consultas.buscarDirecciones(null, { termino: 'Calle Prueba 12' }), consultas.buscarDirecciones(null, { termino: 'Calle Prueba 12' })]);
  assert.equal(llamadas.length, 1);
  assert.deepEqual(primera, segunda);
  assert.equal(primera[0].direccion, 'Calle Prueba 12, Barcelona, España');
  assert.equal(llamadas[0].searchParams.get('q'), 'Calle Prueba 12');
  const gps = await consultas.obtenerDireccionUbicacion(null, { latitud: 41.3901, longitud: 2.1701 });
  assert.equal(gps.lat, 41.3901, 'La dirección GPS mantiene las coordenadas reales');
  assert.equal(gps.lng, 2.1701);
});

test('los errores al buscar direcciones permiten reintentar', async () => {
  let llamadas = 0;
  const consultas = crearBuscadorDirecciones({ intervaloMs: 0, fetchImpl: async () => ({ ok: ++llamadas > 1, json: async () => ({ features: [] }) }) });
  await assert.rejects(consultas.buscarDirecciones(null, { termino: 'Calle Prueba' }), /No se pudo buscar/);
  assert.deepEqual(await consultas.buscarDirecciones(null, { termino: 'Calle Prueba' }), []);
  assert.equal(llamadas, 2);
});
