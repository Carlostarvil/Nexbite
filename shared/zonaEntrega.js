export function coordenadasValidas(latitud, longitud) {
  const esNumero = valor => (typeof valor === 'number' || typeof valor === 'string' && valor.trim() !== '') && Number.isFinite(Number(valor));
  return esNumero(latitud) && esNumero(longitud) &&
    Number.isFinite(Number(latitud)) && Math.abs(Number(latitud)) <= 90 &&
    Number.isFinite(Number(longitud)) && Math.abs(Number(longitud)) <= 180;
}

export function calcularDistancia(lat1, lon1, lat2, lon2) {
  if (!coordenadasValidas(lat1, lon1) || !coordenadasValidas(lat2, lon2)) {
    throw new Error('Selecciona una ubicación válida.');
  }
  const radianes = grados => Number(grados) * Math.PI / 180;
  const diferenciaLatitud = radianes(Number(lat2) - Number(lat1));
  const diferenciaLongitud = radianes(Number(lon2) - Number(lon1));
  const a = Math.sin(diferenciaLatitud / 2) ** 2 +
    Math.cos(radianes(lat1)) * Math.cos(radianes(lat2)) * Math.sin(diferenciaLongitud / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function validarZonaEntrega(restaurante, latitud, longitud) {
  if (!coordenadasValidas(latitud, longitud)) throw new Error('Selecciona la dirección de entrega antes de continuar.');
  if (!coordenadasValidas(restaurante?.latitud, restaurante?.longitud) ||
      !Number.isFinite(Number(restaurante?.radio_cobertura_km)) || Number(restaurante?.radio_cobertura_km) <= 0) {
    throw new Error('Este local no tiene una zona de entrega disponible. Puedes elegir recogida en el local.');
  }
  const distancia = calcularDistancia(latitud, longitud, restaurante.latitud, restaurante.longitud);
  if (distancia > Number(restaurante.radio_cobertura_km) + 1e-6) {
    throw new Error(`Este local no entrega en esta dirección (${distancia.toFixed(1)} km). Su radio de reparto es de ${restaurante.radio_cobertura_km} km. Puedes elegir recogida en el local.`);
  }
  return distancia;
}
