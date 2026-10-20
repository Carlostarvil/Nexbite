// 1. ¿Se está importando una función?
// SÍ. Las llaves { validarHorariosRecogida } significan que estamos extrayendo 
// exclusivamente esa función de todas las que pueda haber en 'horariosRecogida.js'.
import { validarHorariosRecogida } from '../shared/horariosRecogida.js';

/**
 * FÁBRICA DE RESOLVERS (GraphQL)
 * Esta función envuelve la lógica principal y prepara el entorno.
 * 
 * 2. ¿Qué es (pool)?
 * 'pool' es tu conexión a la base de datos PostgreSQL. Piensa en él como el "cable" 
 * o el túnel que conecta tu código con la base de datos. Se lo pasamos desde fuera 
 * para que esta función pueda lanzar consultas SQL a través de él.
 * 
 * @param {object} pool - La conexión a la base de datos PostgreSQL.
 * @returns {Function} - Una función asíncrona que procesa la petición de actualización.
 */
export function crearActualizadorNegocio(pool) {
  
  // ============================================================================
  // FUNCIÓN RESOLVER (La que realmente hace el trabajo)
  // ============================================================================
  
  // 3. ¿Qué es todo esto: (_, { id_restaurante... }, contexto) => { ?
  // Es una Función Flecha que recibe los 3 parámetros estándar de GraphQL:
  // a) '_' (Guion bajo): Es el primer parámetro (el padre). Lo llamamos '_' porque no lo vamos a usar.
  // b) { id_restaurante, nombre... }: "Desestructuración". En lugar de recibir un objeto grande 
  //    y tener que escribir 'datos.nombre' o 'datos.tipo', extraemos las variables directamente para usarlas.
  // c) contexto: Es la "caja" que contiene los datos de la sesión actual (quién está conectado).
  return async (_, {
    id_restaurante, nombre, tipo, latitud, longitud, imagen_url,
    radio_cobertura_km, telefono, direccion, horarios_recogida
  }, contexto) => {
    
    // VALIDACIÓN DE SEGURIDAD (Autorización)
    if (!contexto?.usuario || contexto.usuario.rol !== 'VENDEDOR') {
      throw new Error('Inicia sesión como vendedor para editar un local.');
    }
    
    // 4. ¿Por qué se usa el ! si ya tiene .trim()?
    // .trim() solo limpia espacios a los lados. Si el usuario envía "   ", .trim() lo convierte en "".
    // En programación, un texto vacío ("") se evalúa como Falso. 
    // Al poner el '!' (que significa NO o lo contrario), convertimos ese Falso en Verdadero.
    // Se lee así: "Si NO hay nombre (porque quedó vacío), entonces lanza un Error".
    if (!nombre.trim()) throw new Error('El nombre del local es obligatorio.');
    
    // 5. PROCESAMIENTO COMPLEJO DE CATEGORÍAS
    // Imagina que tipo = " PIZZA, SANA | VEGANA "
    // a. tipo.split('|')[0]   -> Corta por la barra y se queda la primera parte: " PIZZA, SANA "
    // b. .split(',')          -> Corta por las comas creando una lista: [" PIZZA", " SANA "]
    // c. .map(c => c.trim().toUpperCase()) -> Recorre la lista, quita espacios y pone mayúsculas: ["PIZZA", "SANA"]
    // d. .filter(Boolean)     -> Elimina cualquier texto vacío que haya podido quedar por error.
    const categorias = tipo.split('|')[0].split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    
    // Lista maestra de categorías aceptadas por el sistema.
    const permitidas = ['RESTAURANTE', 'SUPERMERCADO', 'FARMACIA', 'HAMBURGUESAS', 'PIZZA', 'DESAYUNO', 'ASIÁTICA', 'SANA', 'AMERICANA', 'POSTRES', 'SÁNDWICHES', 'MEXICANA', 'POLLO'];
    
    // 6. Explicación de la condición de categorías:
    // !categorias.length -> Si la longitud de la lista es 0 (está vacía).
    // || -> O también...
    // categorias.some(...) -> Si "ALGUNA" categoría enviada NO está incluida en la lista de permitidas.
    if (!categorias.length || categorias.some(c => !permitidas.includes(c))) {
      throw new Error('Selecciona categorías válidas para tu negocio.');
    }
    
    if (!telefono.trim()) throw new Error('El teléfono de contacto es obligatorio.');
    if (!imagen_url.trim()) throw new Error('La imagen de portada es obligatoria.');
    
    // VALIDACIÓN MATEMÁTICA DE COORDENADAS
    if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90 ||
        !Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
      throw new Error('Selecciona una ubicación válida para el local.');
    }
    
    if (!Number.isFinite(radio_cobertura_km) || radio_cobertura_km <= 0 || radio_cobertura_km > 500) {
      throw new Error('La distancia de reparto debe estar entre 0 y 500 kilómetros.');
    }
    
    // VALIDACIÓN DE HORARIOS
    const horarios = horarios_recogida == null ? null : validarHorariosRecogida(horarios_recogida);
    
    // ACTUALIZACIÓN EN LA BASE DE DATOS
    const res = await pool.query(`
      UPDATE Restaurantes
      SET nombre = $1, tipo = $2, latitud = $3, longitud = $4, imagen_url = $5,
          radio_cobertura_km = $6, telefono = $7, direccion = $8, 
          horarios_recogida = $9::jsonb -- ::jsonb fuerza a guardar esto como un objeto JSON nativo
      WHERE id_restaurante = $10 
        AND id_usuario_dueño = $11
      
      -- 7. ¿Qué significa RETURNING *?
      -- Normalmente un UPDATE no devuelve datos, solo avisa de que terminó.
      -- 'RETURNING *' es una orden para PostgreSQL: "Devuélveme la fila completa recién modificada".
      RETURNING *
      
    `, [
        // 8. Relleno automático de los "huecos" ($1, $2, etc.)
        // PostgreSQL toma esta lista y va rellenando los huecos en orden exacto para evitar hackeos.
        nombre.trim(), 
        tipo, 
        latitud, 
        longitud, 
        imagen_url, 
        radio_cobertura_km,
        telefono.trim(), 
        direccion?.trim() || null, 
        
        // 9. ¿Cuándo se convierte a JSON?
        // En JavaScript, 'horarios' es un Objeto. Las bases de datos solo entienden texto o números.
        // JSON.stringify() convierte ese Objeto a una larga cadena de texto justo antes de enviarlo a la BD.
        horarios === null ? null : JSON.stringify(horarios), 
        
        id_restaurante, 
        
        // 10. ¿Qué es contexto.usuario.id_usuario?
        // Es abrir cajas: Dentro de 'contexto' está la caja 'usuario', y dentro está la variable 'id_usuario'.
        // Este valor rellenará el hueco $11 para garantizar que eres el dueño legítimo.
        contexto.usuario.id_usuario 
    ]);
    
    if (!res.rows[0]) throw new Error('El local no existe o no te pertenece.');
    
    // 11. ¿Qué es res.rows[0]?
    // 'res' es todo el paquete que respondió la base de datos.
    // 'rows' es la lista de filas afectadas. 'rows[0]' es la primera fila (nuestro restaurante).
    // Se la devolvemos a GraphQL para que el usuario vea los datos ya guardados.
    return res.rows[0];
  };
}