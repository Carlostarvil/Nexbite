export function coincidePedido(pedido, busqueda) {
  const texto = String(busqueda || '').trim().toLocaleLowerCase('es-ES');
  if (!texto) return true;
  // Acepta el número tal como aparece en la tarjeta o al copiar su título.
  const numero = texto.match(/^(?:pedido\s*)?#?\s*(\d+)$/);
  if (numero) return String(pedido.id_pedido).includes(numero[1]);
  return [pedido.nombre_plato, pedido.direccion_envio].some(valor => String(valor || '').toLocaleLowerCase('es-ES').includes(texto));
}
