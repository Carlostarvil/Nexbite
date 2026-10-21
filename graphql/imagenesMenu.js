export function crearResolversImagenesMenu(pool) {
  
  // ============================================================================
  // CACHÉ INTELIGENTE PARA CONSULTAS
  // ============================================================================
  // EXPLICACIÓN DE WEAKMAP:
  // Es un "Diccionario Débil" que optimiza la memoria RAM. A diferencia de un mapa normal,
  // aquí las llaves son objetos ('plato'). Si el programa deja de usar un plato y lo borra 
  // de la memoria principal, el WeakMap lo detecta y borra esta consulta automáticamente 
  // para evitar fugas de memoria. Actúa como un caché temporal perfecto.
  const consultas = new WeakMap();
  
  const obtenerItems = plato => {
    // Si los platos ya vienen precargados en el objeto, devuélvelos como una Promesa resuelta y no hagas nada más.
    if (Array.isArray(plato.items_menu)) return Promise.resolve(plato.items_menu);
    
    // Normalización de datos desde PostgreSQL: 
    // Comprueba si la categoría viene como un Array real de JS, o como un texto bruto de SQL ("{MENU,PIZZA}").
    // Si es texto, le borra los caracteres raros con .replace y lo divide por comas.
    const categorias = Array.isArray(plato.categoria) ? plato.categoria : String(plato.categoria || '').replace(/[{}"\[\]]/g, '').split(',').map(c => c.trim());
    
    if (!categorias.includes('MENU')) return Promise.resolve([]);
    
    // Si es la primera vez que preguntamos por los ingredientes de este menú:
    if (!consultas.has(plato)) {
      
      // EXPLICACIÓN DEL SET Y EL THEN (Post-procesado y Reactivación Automática):
      // Guardamos en el caché (WeakMap) la "Promesa" de esta consulta SQL.
      consultas.set(plato, pool.query(`
        -- Busca los ingredientes (incluido) vinculados a este menú.
        SELECT incluido.* FROM Menu_Platos vinculo
        JOIN Platos incluido ON incluido.id_plato = vinculo.id_plato_incluido
        JOIN Platos menu ON menu.id_plato = vinculo.id_menu
        WHERE vinculo.id_menu = $1 AND incluido.id_restaurante = menu.id_restaurante
        ORDER BY incluido.id_plato
      `, [plato.id_plato]).then(async resultado => {
        
        // EVALUACIÓN PEREZOSA (Lazy Evaluation) / REACTIVACIÓN AUTOMÁTICA:
        // Antes de entregarle los datos al cliente web, revisamos cada ingrediente devuelto.
        for (const item of resultado.rows) {
          // Si el plato estaba inactivo (false), pero su hora de reactivación ya ha sido superada (<= hora actual)...
          if (item.disponible === false && item.tiempo_disponible && new Date(item.tiempo_disponible) <= new Date()) {
            
            // 1. Manda una orden a PostgreSQL para reactivarlo permanentemente en la base de datos.
            await pool.query('UPDATE Platos SET disponible = TRUE, tiempo_disponible = NULL WHERE id_plato = $1 AND tiempo_disponible <= NOW()', [item.id_plato]);
            
            // 2. Modifica el objeto localmente para que el frontend lo vea disponible sin tener que recargar la página.
            item.disponible = true;
            item.tiempo_disponible = null;
          }
        }
        return resultado.rows; // Devuelve los ingredientes limpios y actualizados.
      }));
    }
    
    // Si ya lo habíamos consultado hace unos milisegundos, devuelve la consulta guardada en el caché.
    return consultas.get(plato);
  };

  return {
    items_menu: obtenerItems,
    // LÓGICA DE IMÁGENES DE RESPALDO:
    // Si el menú tiene imagen, usa esa. Si no la tiene, espera a que carguen los ingredientes (obtenerItems),
    // busca el primer ingrediente que sí tenga foto (.find), y usa su imagen como portada del menú.
    imagen_url: async plato => plato.imagen_url || (await obtenerItems(plato)).find(item => item.imagen_url)?.imagen_url || null,
  };
}

export function crearPlatoConItems(pool) {
  return async (_, { id_restaurante, nombre, descripcion, precio, categoria, imagen_url, platos_existentes = [] }) => {
    
    // EXPLICACIÓN DEL MAPEO Y LIMPIEZA DE ARRAYS:
    // 1. (platos_existentes || []): Escudo anti-crasheos. Si es nulo, usa una lista vacía para que .map no falle.
    // 2. .map(String): Recorre toda la lista y convierte cada número estrictamente a Texto (ej: [5] -> ["5"]).
    // 3. new Set(...): Elimina matemáticamente cualquier ID duplicado.
    // 4. [... ]: El Spread Operator desparrama los datos limpios en un nuevo Array normal de JavaScript.
    const ids = [...new Set((platos_existentes || []).map(String))];
    
    const conexion = await pool.connect();
    try {
      // TRANSACCIÓN SQL: Pone los cambios en pausa. Si algo falla, ningún cambio se guardará (ROLLBACK).
      await conexion.query('BEGIN');
      let items = [];
      
      if (ids.length) {
        // ANY($2::int[]): Busca si todos los platos que el usuario quiere meter en este nuevo menú 
        // pertenecen de verdad a su restaurante, evitando que un hacker intente vender platos de la competencia.
        const seleccion = await conexion.query('SELECT * FROM Platos WHERE id_restaurante = $1 AND id_plato = ANY($2::int[]) ORDER BY id_plato', [id_restaurante, ids]);
        if (seleccion.rows.length !== ids.length) throw new Error('Selecciona platos existentes de este local para crear el menú.');
        items = seleccion.rows;
      }
      
      // Crea el Plato/Menú principal primero.
      const resultado = await conexion.query(
        'INSERT INTO Platos (id_restaurante, nombre, descripcion, precio, categoria, imagen_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [id_restaurante, nombre, descripcion, precio, categoria, imagen_url || null]
      );
      const nuevoPlato = resultado.rows[0];
      
      if (ids.length) {
        // EXPLICACIÓN DE UNNEST: INSERCIÓN EN BLOQUE (Bulk Insert)
        // unnest($2::int[]) es magia de PostgreSQL. Toma la lista de JavaScript (ej: [4, 7, 9]),
        // la "desempaqueta" en 3 filas individuales, y le aplica un Casteo estricto a Números Enteros (::int[]).
        // Así, con una sola orden SQL, insertamos de golpe todos los ingredientes en la tabla intermedia.
        await conexion.query('INSERT INTO Menu_Platos (id_menu, id_plato_incluido) SELECT $1, unnest($2::int[])', [nuevoPlato.id_plato, ids]);
      }
      
      // COMMIT: Todo salió perfecto, confirmamos el guardado en disco duro.
      await conexion.query('COMMIT');
      
      return { ...nuevoPlato, items_menu: items };
    } catch (error) {
      // ROLLBACK: Algo falló (ej: el precio venía mal). Deshacemos todo para no dejar un "Menú vacío" colgado en la BD.
      await conexion.query('ROLLBACK');
      throw error;
    } finally {
      conexion.release(); // Libera el cable privado para que vuelva a la piscina.
    }
  };
}