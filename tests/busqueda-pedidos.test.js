import test from 'node:test';
import assert from 'node:assert/strict';
import { coincidePedido } from '../nexbite-frontend/src/busquedaPedidos.js';

test('busca por número con almohadilla, título y espacios sin confundir la dirección', () => {
  const pedido = { id_pedido: '123', nombre_plato: 'Pizza', direccion_envio: 'Calle Mayor 45' };
  for (const texto of ['123', '#123', ' PEDIDO #123 ', 'pedido 123', '23', '', '   ']) assert.equal(coincidePedido(pedido, texto), true, texto);
  for (const texto of ['#999', '45', 'pedido #999']) assert.equal(coincidePedido(pedido, texto), false, texto);
  for (const texto of [' PIZZA ', 'calle mayor 45']) assert.equal(coincidePedido(pedido, texto), true, texto);
});

test('buscar un producto encuentra el pedido completo aunque no sea su primer plato', () => {
  const pedido = { id_pedido: '123', nombre_plato: 'Pizza', productos: [{ nombre: 'Pizza' }, { nombre: 'Limonada' }] };
  assert.equal(coincidePedido(pedido, ' LIMONADA '), true);
  assert.equal(coincidePedido(pedido, 'Sushi'), false);
});
