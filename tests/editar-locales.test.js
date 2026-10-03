import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSchema, parse, validate } from 'graphql';
import { typeDefs } from '../graphql/typeDefs.js';
import { crearActualizadorNegocio } from '../graphql/actualizarNegocio.js';

const propietario = { usuario: { id_usuario: 7, rol: 'VENDEDOR' } };
const datos = {
  id_restaurante: '9', nombre: '  Pizzería Uno  ', tipo: 'RESTAURANTE',
  latitud: 0, longitud: 0, imagen_url: 'data:image/png;base64,foto',
  radio_cobertura_km: 7.5, telefono: '  600000001  ', direccion: '  Calle de prueba, 1  ',
  horarios_recogida: [{ dia: 0, inicio: '12:00', fin: '15:00' }],
};

function almacenPrueba() {
  const filas = [
    { id_restaurante: '9', id_usuario_dueño: 7, nombre: 'Nombre anterior', aceptando_pedidos: false, tiempo_reactivacion: 'mañana' },
    { id_restaurante: '10', id_usuario_dueño: 8, nombre: 'Local ajeno' },
  ];
  const llamadas = [];
  const pool = { query: async (sql, valores) => {
    llamadas.push({ sql, valores });
    assert.match(sql, /WHERE id_restaurante = \$10 AND id_usuario_dueño = \$11/);
    assert.doesNotMatch(sql, /SET[^]*aceptando_pedidos/);
    const fila = filas.find(r => r.id_restaurante === valores[9] && r.id_usuario_dueño === valores[10]);
    if (!fila) return { rows: [] };
    const campos = ['nombre', 'tipo', 'latitud', 'longitud', 'imagen_url', 'radio_cobertura_km', 'telefono', 'direccion'];
    campos.forEach((campo, i) => { fila[campo] = valores[i]; });
    fila.horarios_recogida = valores[8] === null ? null : JSON.parse(valores[8]);
    return { rows: [{ ...fila }] };
  } };
  return { filas, llamadas, actualizar: crearActualizadorNegocio(pool) };
}

test('el propietario puede actualizar todos los datos del registro conservando la pausa', async () => {
  const { actualizar, filas, llamadas } = almacenPrueba();
  const resultado = await actualizar(null, datos, propietario);
  assert.equal(resultado.nombre, 'Pizzería Uno');
  assert.equal(resultado.telefono, '600000001');
  assert.equal(resultado.direccion, 'Calle de prueba, 1');
  assert.equal(resultado.radio_cobertura_km, 7.5);
  assert.equal(resultado.imagen_url, datos.imagen_url);
  assert.equal(resultado.latitud, 0);
  assert.equal(resultado.longitud, 0);
  assert.deepEqual(resultado.horarios_recogida, datos.horarios_recogida);
  assert.equal(resultado.aceptando_pedidos, false);
  assert.equal(resultado.tiempo_reactivacion, 'mañana');
  assert.equal(filas[1].nombre, 'Local ajeno');
  assert.equal(llamadas.length, 1);
});

test('rechaza sesiones anónimas y cuentas que no son de vendedor antes de escribir', async () => {
  const { actualizar, llamadas } = almacenPrueba();
  for (const contexto of [undefined, {}, { usuario: null }, { usuario: { id_usuario: 7, rol: 'CLIENTE' } }]) {
    await assert.rejects(actualizar(null, datos, contexto), /como vendedor/);
  }
  assert.equal(llamadas.length, 0);
});

test('no permite modificar un local ajeno ni uno inexistente', async () => {
  const { actualizar, filas } = almacenPrueba();
  await assert.rejects(actualizar(null, { ...datos, id_restaurante: '10' }, propietario), /no te pertenece/);
  await assert.rejects(actualizar(null, { ...datos, id_restaurante: '99' }, propietario), /no existe/);
  assert.equal(filas[1].nombre, 'Local ajeno');
  assert.equal(filas[0].nombre, 'Nombre anterior');
});

test('valida nombre, tipo, teléfono, portada, ubicación y radio antes de escribir', async () => {
  const { actualizar, llamadas } = almacenPrueba();
  for (const cambios of [
    { nombre: '  ' }, { tipo: 'OTRO' }, { telefono: ' ' }, { imagen_url: '' },
    { latitud: 91 }, { longitud: -181 }, { latitud: NaN }, { longitud: null },
    { radio_cobertura_km: 0 }, { radio_cobertura_km: 501 }, { radio_cobertura_km: NaN },
  ]) {
    await assert.rejects(actualizar(null, { ...datos, ...cambios }, propietario));
  }
  assert.equal(llamadas.length, 0);
});

test('rechaza horarios vacíos o solapados sin modificar el local', async () => {
  const { actualizar, llamadas, filas } = almacenPrueba();
  await assert.rejects(actualizar(null, { ...datos, horarios_recogida: [] }, propietario), /al menos/);
  await assert.rejects(actualizar(null, { ...datos, horarios_recogida: [
    ...datos.horarios_recogida, { dia: 0, inicio: '14:00', fin: '17:00' },
  ] }, propietario), /solaparse/);
  assert.equal(llamadas.length, 0);
  assert.equal(filas[0].nombre, 'Nombre anterior');
});

test('conserva el horario NULL al editar un local antiguo sin configurar recogida', async () => {
  const { actualizar } = almacenPrueba();
  const resultado = await actualizar(null, { ...datos, horarios_recogida: null }, propietario);
  assert.equal(resultado.horarios_recogida, null);
});

test('las consultas de Mis locales y la mutación de edición encajan con GraphQL', () => {
  const esquema = buildSchema(typeDefs);
  for (const ruta of ['../nexbite-frontend/src/MisLocales.jsx', '../nexbite-frontend/src/RegistroRestaurante.jsx']) {
    const codigo = readFileSync(new URL(ruta, import.meta.url), 'utf8');
    for (const [, consulta] of codigo.matchAll(/gql`([\s\S]*?)`/g)) {
      assert.deepEqual(validate(esquema, parse(consulta)), []);
    }
  }
});
