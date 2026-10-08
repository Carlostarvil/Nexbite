import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSchema, graphql, defaultFieldResolver, parse, validate } from 'graphql';
import { typeDefs } from '../graphql/typeDefs.js';
import { crearPlatoConItems, crearResolversImagenesMenu } from '../graphql/imagenesMenu.js';

function basePrueba({ falloVinculos = false } = {}) {
  const platos = new Map([
    ['1', { id_plato: '1', id_restaurante: '9', nombre: 'Pizza', precio: 12, descripcion: '', categoria: ['PLATO'], imagen_url: 'https://fotos.test/pizza.jpg', disponible: true }],
    ['2', { id_plato: '2', id_restaurante: '9', nombre: 'Refresco', precio: 3, descripcion: '', categoria: ['BEBIDA'], imagen_url: 'https://fotos.test/refresco.jpg', disponible: false }],
    ['3', { id_plato: '3', id_restaurante: '9', nombre: 'Postre sin foto', precio: 4, descripcion: '', categoria: ['POSTRE'], imagen_url: null }],
    ['4', { id_plato: '4', id_restaurante: '10', nombre: 'Plato de otro local', precio: 8, descripcion: '', categoria: ['PLATO'], imagen_url: 'https://fotos.test/otro.jpg' }],
  ]);
  const vinculos = new Map();
  let copia;
  let liberadas = 0;
  let lecturas = 0;
  const consulta = async (sql, valores = []) => {
    if (sql === 'BEGIN') { copia = { platos: structuredClone(platos), vinculos: structuredClone(vinculos) }; return { rows: [] }; }
    if (sql === 'COMMIT') { copia = null; return { rows: [] }; }
    if (sql === 'ROLLBACK') {
      platos.clear(); vinculos.clear();
      copia.platos.forEach((valor, id) => platos.set(id, valor));
      copia.vinculos.forEach((valor, id) => vinculos.set(id, valor));
      return { rows: [] };
    }
    if (sql.startsWith('SELECT * FROM Platos')) return { rows: valores[1].map(id => platos.get(id)).filter(p => p && p.id_restaurante === valores[0]) };
    if (sql.startsWith('INSERT INTO Platos')) {
      const campos = ['id_restaurante', 'nombre', 'descripcion', 'precio', 'categoria', 'imagen_url'];
      const plato = { id_plato: '100', ...Object.fromEntries(campos.map((campo, i) => [campo, valores[i]])) };
      platos.set(plato.id_plato, plato); return { rows: [structuredClone(plato)] };
    }
    if (sql.startsWith('INSERT INTO Menu_Platos')) {
      if (falloVinculos) throw new Error('Fallo de almacenamiento de los platos incluidos');
      vinculos.set(valores[0], [...valores[1]]); return { rows: [] };
    }
    if (sql.includes('FROM Menu_Platos vinculo')) {
      lecturas++;
      const menu = platos.get(valores[0]);
      return { rows: (vinculos.get(valores[0]) || []).map(id => platos.get(id)).filter(p => p && p.id_restaurante === menu.id_restaurante) };
    }
    throw new Error('Consulta inesperada: ' + sql);
  };
  return { platos, vinculos, get liberadas() { return liberadas; }, get lecturas() { return lecturas; }, pool: { query: consulta, connect: async () => ({ query: consulta, release: () => liberadas++ }) } };
}

const datosMenu = { id_restaurante: '9', nombre: 'Menú pizza', descripcion: 'Incluye pizza y refresco', precio: 12.75, categoria: ['MENU', 'OFERTA'], platos_existentes: ['1', '2'], imagen_url: '' };

test('el menú conserva los platos y recupera sus imágenes en una consulta nueva de cliente', async () => {
  const base = basePrueba();
  const crear = crearPlatoConItems(base.pool);
  const campos = crearResolversImagenesMenu(base.pool);
  const esquema = buildSchema(typeDefs);
  const opciones = {
    schema: esquema,
    rootValue: { crearPlato: args => crear(null, args), obtenerMenuRestaurante: () => [structuredClone(base.platos.get('100'))] },
    fieldResolver: (fuente, args, contexto, info) => info.parentType.name === 'Plato' && campos[info.fieldName] ? campos[info.fieldName](fuente, args, contexto, info) : defaultFieldResolver(fuente, args, contexto, info),
  };
  const creado = await graphql({ ...opciones, source: `mutation Crear($ids: [ID!]) { crearPlato(id_restaurante: "9", nombre: "Menú pizza", descripcion: "Incluye pizza y refresco", precio: 12.75, categoria: ["MENU", "OFERTA"], platos_existentes: $ids) { id_plato imagen_url items_menu { id_plato nombre imagen_url } } }`, variableValues: { ids: ['1', '2'] } });
  assert.equal(creado.errors, undefined);
  assert.equal(creado.data.crearPlato.imagen_url, 'https://fotos.test/pizza.jpg');
  assert.deepEqual(creado.data.crearPlato.items_menu.map(p => p.id_plato), ['1', '2']);
  const consulta = await graphql({ ...opciones, source: '{ obtenerMenuRestaurante(id_restaurante: "9") { precio categoria imagen_url items_menu { id_plato nombre imagen_url } } }' });
  assert.equal(consulta.errors, undefined);
  assert.equal(consulta.data.obtenerMenuRestaurante[0].precio, 12.75);
  assert.deepEqual(consulta.data.obtenerMenuRestaurante[0].categoria, ['MENU', 'OFERTA']);
  assert.deepEqual(consulta.data.obtenerMenuRestaurante[0].items_menu, creado.data.crearPlato.items_menu);
  assert.equal(base.lecturas, 1, 'La portada y la galería comparten la lectura de los platos');
  assert.equal(base.liberadas, 1);
});

test('la foto propia del menú se conserva junto a las fotos de sus platos', async () => {
  const base = basePrueba(); const campos = crearResolversImagenesMenu(base.pool);
  const creado = await crearPlatoConItems(base.pool)(null, { ...datosMenu, imagen_url: 'https://fotos.test/menu.jpg' });
  assert.equal(await campos.imagen_url(creado), 'https://fotos.test/menu.jpg');
  assert.equal((await campos.items_menu(creado)).length, 2);
});

test('un plato sin foto no oculta las fotos de los demás y la selección repetida no duplica platos', async () => {
  const base = basePrueba(); const campos = crearResolversImagenesMenu(base.pool);
  const creado = await crearPlatoConItems(base.pool)(null, { ...datosMenu, platos_existentes: ['3', '1', '1'] });
  assert.equal(await campos.imagen_url(creado), 'https://fotos.test/pizza.jpg');
  assert.deepEqual(base.vinculos.get('100'), ['3', '1']);
  assert.equal((await campos.items_menu(creado)).length, 2);
});

test('si falla el guardado de los platos incluidos, no queda un menú sin sus imágenes', async () => {
  const base = basePrueba({ falloVinculos: true });
  await assert.rejects(crearPlatoConItems(base.pool)(null, datosMenu), /Fallo de almacenamiento/);
  assert.equal(base.platos.has('100'), false); assert.equal(base.vinculos.size, 0); assert.equal(base.liberadas, 1);
});

test('rechaza platos borrados o de otro local antes de crear el menú', async () => {
  for (const id of ['4', '999']) {
    const base = basePrueba();
    await assert.rejects(crearPlatoConItems(base.pool)(null, { ...datosMenu, platos_existentes: ['1', id] }), /de este local/);
    assert.equal(base.platos.has('100'), false); assert.equal(base.liberadas, 1);
  }
});

test('un plato normal mantiene su foto y no consulta vínculos de menú', async () => {
  const base = basePrueba(); const campos = crearResolversImagenesMenu(base.pool);
  const creado = await crearPlatoConItems(base.pool)(null, { ...datosMenu, categoria: ['PLATO'], platos_existentes: null, imagen_url: 'https://fotos.test/nuevo.jpg' });
  const recargado = structuredClone(base.platos.get(creado.id_plato));
  assert.equal(await campos.imagen_url(recargado), 'https://fotos.test/nuevo.jpg');
  assert.deepEqual(await campos.items_menu(recargado), []); assert.equal(base.lecturas, 0);
});

test('todas las consultas de imágenes de cliente y vendedor encajan con el esquema existente', () => {
  const esquema = buildSchema(typeDefs);
  for (const archivo of ['App.jsx', 'GestorMenu.jsx', 'PerfilRestaurante.jsx', 'DetallePlato.jsx', 'MisFavoritos.jsx', 'Buscador.jsx']) {
    const codigo = readFileSync(new URL('../nexbite-frontend/src/' + archivo, import.meta.url), 'utf8');
    const consultasImagenes = [...codigo.matchAll(/gql`([\s\S]*?)`/g)].map(([, consulta]) => consulta).filter(consulta => consulta.includes('items_menu'));
    assert.ok(consultasImagenes.length > 0, archivo);
    for (const consulta of consultasImagenes) assert.deepEqual(validate(esquema, parse(consulta)), [], archivo);
  }
});
