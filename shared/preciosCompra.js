export function centimos(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > 999999.99) throw new Error('El precio no es válido.');
  return Math.round((numero + Number.EPSILON) * 100);
}

export function configuracionEnvio(tipo = '') {
  const leer = (clave, defecto) => {
    const coincidencia = String(tipo).match(new RegExp('\\|' + clave + ':\\s*([\\d.,]+)', 'i'));
    return coincidencia ? Number(coincidencia[1].replace(',', '.')) : defecto;
  };
  return { base: leer('ENVIO', 1.90), porKm: leer('KM', 0.50), gratisDesde: leer('GRATIS', 15) };
}

export function costeEnvio(subtotalCentimos, tipo, distancia, recogida) {
  if (recogida) return 0;
  const config = configuracionEnvio(tipo);
  return subtotalCentimos >= centimos(config.gratisDesde) ? 0 : centimos(config.base + config.porKm * distancia);
}
