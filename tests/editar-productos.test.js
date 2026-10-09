import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSchema, parse, validate } from 'graphql';
import { typeDefs } from '../graphql/typeDefs.js';
import { crearEditorPlato } from '../graphql/editarPlato.js';

const vendedor = { usuario: { id_usuario: '7', rol: 'VENDEDOR' } };
const datos = { id_plato: '1', id_restaurante: '9', nombre: '  Pizza nueva  ', descripcion: 'Nueva receta', precio: 13, categoria: ['PLATO'], imagen_url: 'pizza-nueva.jpg', platos_existentes: [] };
function almacen({ falloVinculos = false } = {}) {
  let productos = [
    { id_plato: '1', id_restaurante: '9', nombre: 'Pizza', descripcion: 'Original', categoria: ['PLATO'], precio: 12, imagen_url: 'pizza.jpg', disponible: false, tiempo_disponible: '2030-01-01' },
    { id_plato: '2', id_restaurante: '9', nombre: 'Bebida', categoria: ['BEBIDA'], precio: 3, imagen_url: 'bebida.jpg' },
    { id_plato: '3', id_restaurante: '10', nombre: 'Producto ajeno', categoria: ['PLATO'] },
    { id_plato: '20', id_restaurante: '9', nombre: 'Menú', descripcion: 'Incluye pizza', categoria: ['MENU'], precio: 10, imagen_url: null, disponible: true },
  ];
  let vinculos = [{ id_menu: '20', id_plato_incluido: '1' }];
  const pedidos = [{ id_pedido: '50', id_plato: '1' }, { id_pedido: '51', id_plato: '20' }];
  const llamadas = [];
  let copia, liberadas = 0;
  const query = async (sql, valores = []) => {
    llamadas.push({ sql, valores });
    if (sql === 'BEGIN') { copia = structuredClone({ productos, vinculos }); return { rows: [] }; }
    if (sql === 'COMMIT') return { rows: [] };
    if (sql === 'ROLLBACK') { productos = copia.productos; vinculos = copia.vinculos; return { rows: [] }; }
    if (sql.includes('FOR UPDATE OF p')) return { rows: productos.filter(p => p.id_plato === valores[0] && p.id_restaurante === valores[1] && valores[2] === '7' && p.id_restaurante === '9') };
    if (sql.startsWith('SELECT 1 FROM Menu_Platos')) return { rows: vinculos.some(v => v.id_menu === valores[0]) ? [] : vinculos.filter(v => v.id_plato_incluido === valores[0]) };
    if (sql.startsWith('SELECT * FROM Platos')) return { rows: productos.filter(p => p.id_restaurante === valores[0] && valores[1].includes(p.id_plato)) };
    if (sql.includes('UPDATE Platos SET')) {
      const producto = productos.find(p => p.id_plato === valores[5] && p.id_restaurante === valores[6]);
      ['nombre', 'descripcion', 'precio', 'categoria', 'imagen_url'].forEach((campo, i) => { producto[campo] = valores[i]; });
      return { rows: [{ ...producto }] };
    }
    if (sql.startsWith('DELETE FROM Menu_Platos')) { vinculos = vinculos.filter(v => v.id_menu !== valores[0]); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO Menu_Platos')) {
      if (falloVinculos) throw new Error('No se pudieron guardar los vínculos');
      vinculos.push(...valores[1].map(id => ({ id_menu: valores[0], id_plato_incluido: id }))); return { rows: [] };
    }
    throw new Error('Consulta inesperada: ' + sql);
  };
  return { get productos() { return productos; }, get vinculos() { return vinculos; }, get liberadas() { return liberadas; }, pedidos, llamadas, editar: crearEditorPlato({ connect: async () => ({ query, release: () => liberadas++ }) }) };
}

test('editar mantiene el ID, los pedidos, los menús que lo incluyen y la disponibilidad', async () => {
  const base = almacen();
  const resultado = await base.editar(null, datos, vendedor);
  assert.equal(resultado.id_plato, '1');
  assert.equal(resultado.nombre, 'Pizza nueva');
  assert.equal(resultado.precio, 13);
  assert.equal(resultado.disponible, false);
  assert.equal(resultado.tiempo_disponible, '2030-01-01');
  assert.equal(base.productos.length, 4);
  assert.equal(base.pedidos[0].id_plato, '1');
  assert.deepEqual(base.vinculos, [{ id_menu: '20', id_plato_incluido: '1' }]);
  assert.ok(base.llamadas.some(c => c.sql === 'COMMIT'));
  assert.equal(base.liberadas, 1);
});

test('editar un menú reemplaza sus productos y conserva las imágenes y su ID', async () => {
  const base = almacen();
  const resultado = await base.editar(null, { ...datos, id_plato: '20', categoria: ['MENU', 'OFERTA'], imagen_url: null, platos_existentes: ['1', '2', '2'] }, vendedor);
  assert.equal(resultado.id_plato, '20');
  assert.deepEqual(resultado.items_menu.map(p => p.imagen_url), ['pizza.jpg', 'bebida.jpg']);
  assert.deepEqual(base.vinculos.map(v => v.id_plato_incluido), ['1', '2']);
  assert.equal(base.pedidos[1].id_plato, '20');
});

test('un fallo al guardar las inclusiones revierte también los cambios del producto', async () => {
  const base = almacen({ falloVinculos: true });
  await assert.rejects(base.editar(null, { ...datos, id_plato: '20', categoria: ['MENU'], platos_existentes: ['2'] }, vendedor), /vínculos/);
  assert.equal(base.productos.find(p => p.id_plato === '20').nombre, 'Menú');
  assert.deepEqual(base.vinculos, [{ id_menu: '20', id_plato_incluido: '1' }]);
  assert.equal(base.liberadas, 1);
});

test('rechaza editar productos ajenos, inexistentes o usando otro local', async () => {
  for (const cambios of [{ id_plato: '3', id_restaurante: '10' }, { id_plato: '99' }, { id_restaurante: '10' }]) {
    const base = almacen();
    await assert.rejects(base.editar(null, { ...datos, ...cambios }, vendedor), /no pertenece/);
    assert.equal(base.productos[0].nombre, 'Pizza');
    assert.ok(!base.llamadas.some(c => c.sql.includes('UPDATE Platos')));
    assert.equal(base.liberadas, 1);
  }
});

test('rechaza sesiones y datos inválidos antes de abrir una transacción', async () => {
  const base = almacen();
  for (const contexto of [null, {}, { usuario: { rol: 'CLIENTE' } }]) await assert.rejects(base.editar(null, datos, contexto), /vendedor/);
  for (const cambios of [{ nombre: ' ' }, { descripcion: '' }, { precio: -1 }, { precio: NaN }, { categoria: [] }, { categoria: ['MENU'], platos_existentes: [] }, { categoria: ['MENU'], platos_existentes: ['1'] }]) await assert.rejects(base.editar(null, { ...datos, ...cambios }, vendedor));
  assert.equal(base.llamadas.length, 0);
});

test('impide menús anidados, productos de otro local y convertir un producto incluido en menú', async () => {
  for (const ids of [['20'], ['3'], ['999']]) {
    const base = almacen();
    await assert.rejects(base.editar(null, { ...datos, id_plato: '2', categoria: ['MENU'], platos_existentes: ids }, vendedor));
    assert.equal(base.productos[1].nombre, 'Bebida');
  }
  const base = almacen();
  await assert.rejects(base.editar(null, { ...datos, categoria: ['MENU'], platos_existentes: ['2'] }, vendedor), /producto individual está incluido/);
});

test('dos menús pueden compartir platos y editar uno conserva las inclusiones del otro', async () => {
  const base = almacen();
  await base.editar(null, { ...datos, id_plato: '2', categoria: ['MENU'], platos_existentes: ['1'] }, vendedor);
  await base.editar(null, { ...datos, id_plato: '20', categoria: ['MENU'], platos_existentes: ['1'] }, vendedor);
  assert.deepEqual(base.vinculos, [{ id_menu: '2', id_plato_incluido: '1' }, { id_menu: '20', id_plato_incluido: '1' }]);
});

test('editar un menú existente no se confunde con convertir un producto individual', async () => {
  const base = almacen();
  // Datos heredados: un menú tenía una referencia desde otro menú.
  base.vinculos.push({ id_menu: '99', id_plato_incluido: '20' });
  const resultado = await base.editar(null, { ...datos, id_plato: '20', categoria: ['MENU'], platos_existentes: ['1', '2'] }, vendedor);
  assert.equal(resultado.id_plato, '20');
  assert.equal(resultado.items_menu.length, 2);
  assert.ok(base.vinculos.some(v => v.id_menu === '99' && v.id_plato_incluido === '20'));
});

test('al convertir un menú en producto se conservan sus pedidos y se retiran solo sus inclusiones', async () => {
  const base = almacen();
  const resultado = await base.editar(null, { ...datos, id_plato: '20' }, vendedor);
  assert.deepEqual(resultado.categoria, ['PLATO']);
  assert.equal(base.pedidos[1].id_plato, '20');
  assert.deepEqual(base.vinculos, []);
});

test('las nuevas operaciones de menú, pedidos y perfil de vendedor son válidas en GraphQL', () => {
  const esquema = buildSchema(typeDefs);
  for (const archivo of ['GestorMenu.jsx', 'GestorPedidos.jsx', 'PerfilVendedor.jsx']) {
    const codigo = readFileSync(new URL('../nexbite-frontend/src/' + archivo, import.meta.url), 'utf8');
    for (const [, consulta] of codigo.matchAll(/gql`([\s\S]*?)`/g)) assert.deepEqual(validate(esquema, parse(consulta)), [], archivo);
  }
});
