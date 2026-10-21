import { coordenadasValidas } from '../shared/zonaEntrega.js';

// EXPLICACIÓN DE LOS PARÁMETROS POR DEFECTO:
// Al poner { fetchImpl = fetch, baseUrl = ..., intervaloMs = 1000 } = {}, le estamos diciendo:
// "Esta función recibe un objeto con opciones. Si el que llama a la función no me pasa nada, 
// o le falta algún dato, usa estos valores por defecto: usa el 'fetch' nativo, conéctate a Komoot 
// y espera 1000 milisegundos (1 segundo) entre cada petición".
export function crearBuscadorDirecciones({ fetchImpl = fetch, baseUrl = process.env.PHOTON_URL || 'https://photon.komoot.io', intervaloMs = 1000 } = {}) {
  const cache = new Map();
  let cola = Promise.resolve();
  let ultimaSolicitud = 0;
  
  const consultar = (ruta, parametros) => {
    const url = new URL(ruta, baseUrl);
    
    // EXPLICACIÓN DE Object.entries:
    // 'parametros' es un objeto (ej: { q: "Madrid", lat: 40 }). 
    // Object.entries lo convierte en una lista y este bucle 'for' lo recorre insertándolos 
    // en la URL para que quede así: "https://...?q=Madrid&lat=40"
    for (const [clave, valor] of Object.entries(parametros)) url.searchParams.set(clave, valor);
    
    // EXPLICACIÓN DEL LÍMITE (Ternario):
    // Si estamos haciendo '/reverse' (buscar por coordenadas) solo queremos '1' resultado exacto.
    // Si estamos buscando texto libre en la barra, queremos que nos devuelva '5' sugerencias.
    url.searchParams.set('limit', ruta === '/reverse' ? '1' : '5');
    
    const clave = url.toString();
    const anterior = cache.get(clave);
    
    // EXPLICACIÓN DE LA MEMORIA (Caché):
    // Date.now() da la hora actual. Si encontramos una búsqueda anterior (anterior) Y (&&) 
    // su fecha de caducidad (vence) es mayor a la hora actual, devuelve la respuesta de la memoria.
    if (anterior && anterior.vence > Date.now()) return anterior.promesa;
    
    const promesa = cola.then(async () => {
      // EXPLICACIÓN DEL CONTROL DE TRÁFICO (Rate Limiting):
      // Math.max evita números negativos. Calcula cuánto tiempo falta para cumplir el segundo
      // de seguridad (intervaloMs) desde la última petición. Si pasaron 800ms, la 'espera' será 200ms.
      const espera = Math.max(0, intervaloMs - (Date.now() - ultimaSolicitud));
      
      // EXPLICACIÓN DE LA PAUSA (setTimeout):
      // Si hay que esperar (espera > 0), esto "congela" el código esos milisegundos exactos 
      // antes de seguir. Esto evita que la API externa nos bloquee por hacer spam.
      if (espera) await new Promise(resolve => setTimeout(resolve, espera));
      ultimaSolicitud = Date.now();
      
      // EXPLICACIÓN DEL FETCH (Petición a internet):
      // Llama a internet. AbortSignal.timeout(10000) es un salvavidas: si la API se cae y no
      // responde en 10 segundos, corta la conexión. Headers: pide los nombres en español ('es').
      const respuesta = await fetchImpl(url, { signal: AbortSignal.timeout(10000), headers: { 'Accept-Language': 'es', 'User-Agent': 'NexBite/1.0 (address selection)' } });
      
      // EXPLICACIÓN DE !respuesta.ok:
      // Cuando pides datos a internet, un código 200 significa OK. Un 404 o 500 significa error. 
      // Si la respuesta NO (!) está OK, lanza un error y detiene todo.
      if (!respuesta.ok) throw new Error('No se pudo buscar la dirección. Inténtalo de nuevo.');
      
      // EXPLICACIÓN DEL JSON:
      // La API nos devuelve un archivo de texto plano gigante. .json() transforma ese 
      // texto en un Objeto de JavaScript real que podemos leer y manipular en el código.
      const data = await respuesta.json();
      
      // EXPLICACIÓN DE Array.isArray:
      // Seguridad pura. Comprueba si 'data.features' (donde deberían venir los resultados) 
      // es realmente una lista (Array). Si nos devolvió otra cosa rara, lanza un error.
      if (!Array.isArray(data.features)) throw new Error('No se pudo buscar la dirección. Inténtalo de nuevo.');
      
      // EXPLICACIÓN DE flatMap Y DESESTRUCTURACIÓN:
      // flatMap recorre la lista. Si le devolvemos una lista vacía [], él la borra del resultado final.
      return data.features.flatMap(feature => {
        // Extrae longitud y latitud del objeto. El '|| []' evita que el código explote si coordinates no existe.
        const [lng, lat] = feature.geometry?.coordinates || [];
        if (!coordenadasValidas(lat, lng)) return [];
        
        // EXPLICACIÓN DE || {}:
        // Si no hay propiedades ('properties' es nulo o indefinido), le asignamos un objeto 
        // vacío {}. Así, en la siguiente línea, pedir p.street devolverá indefinido pero no dará error fatal.
        const p = feature.properties || {};
        
        // EXPLICACIÓN DEL FILTRO Y SET PARA LA DIRECCIÓN:
        // .filter(Boolean) elimina las cosas vacías (ej: si no hay número de casa, lo quita).
        const calle = [p.street, p.housenumber].filter(Boolean).join(' ');
        
        // El 'new Set' sirve para borrar duplicados. Si ciudad='Madrid' y provincia='Madrid', 
        // el Set elimina uno, y luego se unen (.join) separados por coma: "Gran Vía 15, Madrid, España".
        const direccion = [...new Set([calle || p.name, p.postcode, p.city || p.town || p.village, p.state, p.country].filter(Boolean))].join(', ');
        
        // EXPLICACIÓN DEL TERNARIO DE RETORNO:
        // Si logró armar una 'direccion' válida, devuelve esa dirección en formato de lista de un elemento [{...}].
        // (flatMap se encargará de sacarlo de la lista). Si la dirección está vacía, devuelve [].
        return direccion ? [{ direccion, lat, lng }] : [];
      });
    });
    
    // EXPLICACIÓN DE COLA Y CATCH:
    // Mantiene la tubería fluyendo. Si la promesa actual falla, este .catch se traga 
    // el error en silencio para que la siguiente petición en la 'cola' pueda ejecutarse sin atascarse.
    cola = promesa.catch(() => {});
    
    // EXPLICACIÓN DEL BLOQUE FINAL DE CACHÉ:
    // Guarda el resultado exitoso en memoria. Fecha de caducidad: ahora + 300,000 ms (5 minutos).
    cache.set(clave, { promesa, vence: Date.now() + 300000 });
    
    // Protege la memoria RAM del servidor. Si hay más de 200 búsquedas guardadas,
    // extrae y elimina (delete) la primera (la más vieja) de la lista.
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    
    // Si la llamada a internet falló finalmente, la borra de la memoria caché.
    // Así obligamos a que el sistema lo vuelva a intentar si el usuario busca lo mismo más tarde.
    promesa.catch(() => { if (cache.get(clave)?.promesa === promesa) cache.delete(clave); });
    
    return promesa;
  };
  
  // EXPLICACIÓN DEL RETURN FINAL:
  // La "Fábrica" termina aquí, devolviendo las 2 funciones definitivas que 
  // nuestro servidor GraphQL utilizará para responder a la App del cliente.
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