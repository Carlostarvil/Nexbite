import { coordenadasValidas } from '../shared/zonaEntrega.js';

export function crearBuscadorDirecciones({ fetchImpl = fetch, baseUrl = process.env.PHOTON_URL || 'https://photon.komoot.io', intervaloMs = 1000 } = {}) {
  const cache = new Map();
  let cola = Promise.resolve();
  let ultimaSolicitud = 0;
  const consultar = (ruta, parametros) => {
    const url = new URL(ruta, baseUrl);
    for (const [clave, valor] of Object.entries(parametros)) url.searchParams.set(clave, valor);
    url.searchParams.set('limit', ruta === '/reverse' ? '1' : '5');
    const clave = url.toString();
    const anterior = cache.get(clave);
    if (anterior && anterior.vence > Date.now()) return anterior.promesa;
    const promesa = cola.then(async () => {
      const espera = Math.max(0, intervaloMs - (Date.now() - ultimaSolicitud));
      if (espera) await new Promise(resolve => setTimeout(resolve, espera));
      ultimaSolicitud = Date.now();
      const respuesta = await fetchImpl(url, { signal: AbortSignal.timeout(10000), headers: { 'Accept-Language': 'es', 'User-Agent': 'NexBite/1.0 (address selection)' } });
      if (!respuesta.ok) throw new Error('No se pudo buscar la dirección. Inténtalo de nuevo.');
      const data = await respuesta.json();
      if (!Array.isArray(data.features)) throw new Error('No se pudo buscar la dirección. Inténtalo de nuevo.');
      return data.features.flatMap(feature => {
        const [lng, lat] = feature.geometry?.coordinates || [];
        if (!coordenadasValidas(lat, lng)) return [];
        const p = feature.properties || {};
        const calle = [p.street, p.housenumber].filter(Boolean).join(' ');
        const direccion = [...new Set([calle || p.name, p.postcode, p.city || p.town || p.village, p.state, p.country].filter(Boolean))].join(', ');
        return direccion ? [{ direccion, lat, lng }] : [];
      });
    });
    cola = promesa.catch(() => {});
    cache.set(clave, { promesa, vence: Date.now() + 300000 });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    promesa.catch(() => { if (cache.get(clave)?.promesa === promesa) cache.delete(clave); });
    return promesa;
  };
  return {
    buscarDirecciones: (_, { termino }) => {
      const texto = termino?.trim();
      if (!texto || texto.length < 4 || texto.length > 200) throw new Error('Escribe la calle, el número y la ciudad.');
      return consultar('/api', { q: texto });
    },
    obtenerDireccionUbicacion: async (_, { latitud, longitud }) => {
      if (!coordenadasValidas(latitud, longitud)) throw new Error('Selecciona una ubicación válida.');
      const direcciones = await consultar('/reverse', { lat: latitud, lon: longitud });
      return direcciones[0] ? { ...direcciones[0], lat: latitud, lng: longitud } : null;
    },
  };
}
