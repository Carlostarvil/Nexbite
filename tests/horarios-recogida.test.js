import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchema, parse, validate } from 'graphql';
import { readFileSync } from 'node:fs';
import { typeDefs } from '../graphql/typeDefs.js';
import { validarHorariosRecogida, recogidaDisponible, validarFechaRecogida, generarOpcionesRecogida } from '../shared/horariosRecogida.js';

// Lunes 5 de octubre, en horario de verano peninsular (UTC+2).
const comidaCena = [
  { dia: 0, inicio: '12:00', fin: '15:00' },
  { dia: 0, inicio: '19:00', fin: '23:00' },
];
const fecha = valor => new Date(valor);

test('acepta y ordena franjas de comida y cena sin modificar la entrada', () => {
  const entrada = [...comidaCena].reverse();
  assert.deepEqual(validarHorariosRecogida(entrada), comidaCena);
  assert.equal(entrada[0].inicio, '19:00');
});

test('rechaza horarios vacíos, mal formados y franjas demasiado cortas', () => {
  for (const entrada of [[], null, [{ dia: 7, inicio: '12:00', fin: '15:00' }],
    [{ dia: 0, inicio: '25:00', fin: '15:00' }], [{ dia: 0, inicio: '12:00', fin: '12:00' }],
    [{ dia: 0, inicio: '12:00', fin: '12:15' }]]) {
    assert.throws(() => validarHorariosRecogida(entrada));
  }
});

test('rechaza solapamientos, incluso entre domingo y lunes', () => {
  assert.throws(() => validarHorariosRecogida([...comidaCena, { dia: 0, inicio: '14:00', fin: '16:00' }]), /solaparse/);
  assert.throws(() => validarHorariosRecogida([
    { dia: 6, inicio: '23:00', fin: '02:00' }, { dia: 0, inicio: '01:00', fin: '03:00' },
  ]), /solaparse/);
  assert.doesNotThrow(() => validarHorariosRecogida([
    { dia: 0, inicio: '12:00', fin: '15:00' }, { dia: 0, inicio: '15:00', fin: '17:00' },
  ]));
});

test('respeta apertura, cierre, pausa entre franjas y días sin recogida', () => {
  assert.equal(recogidaDisponible(comidaCena, fecha('2026-10-05T09:59:00Z')), false);
  assert.equal(recogidaDisponible(comidaCena, fecha('2026-10-05T10:00:00Z')), true);
  assert.equal(recogidaDisponible(comidaCena, fecha('2026-10-05T13:00:00Z')), false);
  assert.equal(recogidaDisponible(comidaCena, fecha('2026-10-05T15:00:00Z')), false);
  assert.equal(recogidaDisponible(comidaCena, fecha('2026-10-05T17:00:00Z')), true);
  assert.equal(recogidaDisponible(comidaCena, fecha('2026-10-06T10:00:00Z')), false);
});

test('recogida inmediata requiere 15 minutos antes del cierre', () => {
  assert.equal(validarFechaRecogida(comidaCena, null, fecha('2026-10-05T12:45:00Z')), null);
  assert.throws(() => validarFechaRecogida(comidaCena, null, fecha('2026-10-05T12:45:01Z')), /inmediata/);
  assert.throws(() => validarFechaRecogida(comidaCena, null, fecha('2026-10-05T14:00:00Z')), /inmediata/);
});

test('valida antelación, fechas inválidas y que la franja completa quepa antes del cierre', () => {
  const ahora = fecha('2026-10-05T09:00:00Z');
  assert.equal(validarFechaRecogida(comidaCena, '2026-10-05T12:30:00Z', ahora), '2026-10-05T12:30:00.000Z');
  assert.throws(() => validarFechaRecogida(comidaCena, '2026-10-05T12:45:00Z', ahora), /fuera/);
  assert.throws(() => validarFechaRecogida(comidaCena, '2026-10-05T15:00:00Z', ahora), /fuera/);
  assert.throws(() => validarFechaRecogida(comidaCena, 'no-fecha', ahora), /antelación/);
  assert.throws(() => validarFechaRecogida(comidaCena, '2026-10-05T08:00:00Z', ahora), /antelación/);
  assert.throws(() => validarFechaRecogida(comidaCena, '2026-10-05T10:10:00Z', fecha('2026-10-05T10:00:00Z')), /antelación/);
});

test('acepta fechas ISO y timestamps del cliente anterior', () => {
  const ahora = fecha('2026-10-05T09:00:00Z');
  const pedido = fecha('2026-10-05T10:30:00Z');
  assert.equal(validarFechaRecogida(comidaCena, String(pedido.getTime()), ahora), pedido.toISOString());
});

test('las opciones solo incluyen fechas y horas dentro del horario', () => {
  const ahora = fecha('2026-10-05T10:07:00Z');
  const opciones = generarOpcionesRecogida(comidaCena, ahora);
  assert.deepEqual(opciones.map(dia => dia.valor), ['2026-10-05']);
  assert.equal(opciones[0].horas[0].valor, '2026-10-05T10:30:00.000Z');
  for (const hora of opciones[0].horas) assert.doesNotThrow(() => validarFechaRecogida(comidaCena, hora.valor, ahora));
  assert.equal(opciones[0].horas.some(h => h.valor === '2026-10-05T12:45:00.000Z'), false);
});

test('no incluye hoy si ya ha cerrado ni arrastra una hora al siguiente día', () => {
  const diario = Array.from({ length: 7 }, (_, dia) => ({ dia, inicio: '12:00', fin: '15:00' }));
  const opciones = generarOpcionesRecogida(diario, fecha('2026-10-05T13:00:00Z'));
  assert.equal(opciones[0].valor, '2026-10-06');
  assert.equal(opciones.length, 6);
  assert.deepEqual(generarOpcionesRecogida([], fecha('2026-10-05T10:00:00Z')), []);
});

test('respeta franjas con minutos personalizados sin redondear la apertura', () => {
  const horario = [{ dia: 0, inicio: '12:07', fin: '12:37' }];
  const opciones = generarOpcionesRecogida(horario, fecha('2026-10-05T09:00:00Z'));
  assert.deepEqual(opciones[0].horas.map(h => h.valor), ['2026-10-05T10:07:00.000Z']);
});

test('admite recogida nocturna en el día siguiente y cruza el fin de semana', () => {
  const noche = validarHorariosRecogida([{ dia: 6, inicio: '23:00', fin: '02:00' }]);
  assert.equal(recogidaDisponible(noche, fecha('2026-10-04T21:00:00Z')), true);
  assert.equal(recogidaDisponible(noche, fecha('2026-10-04T23:30:00Z')), true);
  assert.equal(recogidaDisponible(noche, fecha('2026-10-05T00:00:00Z')), false);
  const opciones = generarOpcionesRecogida(noche, fecha('2026-10-04T22:50:00Z'));
  assert.equal(opciones[0].valor, '2026-10-05');
});

test('mantiene compatibles los locales anteriores con horario NULL', () => {
  assert.equal(recogidaDisponible(null, fecha('2026-10-05T01:00:00Z')), true);
  assert.equal(validarFechaRecogida(null, null, fecha('2026-10-05T01:00:00Z')), null);
  assert.ok(generarOpcionesRecogida(null, fecha('2026-10-05T09:00:00Z')).length > 0);
});

test('usa hora peninsular en invierno y durante los cambios de hora', () => {
  const domingos = [{ dia: 6, inicio: '01:00', fin: '04:00' }];
  const primavera = generarOpcionesRecogida(domingos, fecha('2026-03-29T00:00:00Z'))[0];
  assert.equal(primavera.horas.some(h => h.etiqueta.startsWith('02:')), false);
  assert.throws(() => validarFechaRecogida(
    [{ dia: 6, inicio: '01:00', fin: '02:30' }], '2026-03-29T00:45:00Z', fecha('2026-03-29T00:00:00Z')
  ), /fuera/);
  const otono = generarOpcionesRecogida(domingos, fecha('2026-10-25T00:00:00Z'))[0];
  const dosYMedia = otono.horas.filter(h => h.etiqueta.startsWith('02:30'));
  assert.equal(dosYMedia.length, 2);
  assert.notEqual(dosYMedia[0].valor, dosYMedia[1].valor);
  assert.notEqual(dosYMedia[0].etiqueta, dosYMedia[1].etiqueta);
  assert.equal(recogidaDisponible(comidaCena, fecha('2026-11-02T11:00:00Z')), true);
});

test('las operaciones GraphQL de registro y carrito coinciden con el esquema del servidor', () => {
  const esquema = buildSchema(typeDefs);
  for (const ruta of ['../nexbite-frontend/src/RegistroRestaurante.jsx', '../nexbite-frontend/src/Carrito.jsx']) {
    const codigo = readFileSync(new URL(ruta, import.meta.url), 'utf8');
    for (const [, consulta] of codigo.matchAll(/gql`([\s\S]*?)`/g)) {
      assert.deepEqual(validate(esquema, parse(consulta)), []);
    }
  }
});
