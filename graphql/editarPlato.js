// La edición conserva el producto y sus referencias en pedidos y menús.

/**
 * FÁBRICA DEL EDITOR DE PLATOS
 * @param {object} pool - La conexión (piscina) a la base de datos PostgreSQL. 
 * Se pasa desde fuera para que esta función pueda lanzar consultas SQL.
 */
export function crearEditorPlato(pool) {
  
  // PARÁMETROS DE GRAPHQL (Función Flecha '=>'):
  // 1. '_' (Guion bajo): Ignora el parámetro padre.
  // 2. '{ id_plato... }': Desestructura (extrae) los datos enviados por el usuario. 
  //    'platos_existentes = []' asegura que si el usuario no envía nada, sea una lista vacía y no dé error.
  // 3. 'contexto': Es la caja que contiene los datos de la sesión del usuario (quién está logueado).
  return async (_, { id_plato, id_restaurante, nombre, descripcion, precio, categoria, imagen_url, platos_existentes = [] }, contexto) => {
    
    // Validación de seguridad: Comprueba que el usuario sea VENDEDOR.
    if (contexto?.usuario?.rol !== 'VENDEDOR') throw new Error('Inicia sesión como vendedor para editar productos.');
    if (!nombre.trim() || !descripcion.trim()) throw new Error('Completa el nombre y la descripción del producto.');
    if (!Number.isFinite(precio) || precio < 0) throw new Error('El precio debe ser un número válido, igual o mayor que cero.');
    
    // SANITIZACIÓN DE CATEGORÍAS (Cadena de montaje):
    // 1. (categoria || []): Si no enviaron categorías, usa una lista vacía.
    // 2. .map(...): Convierte cada categoría a texto, borra espacios (.trim) y la pasa a MAYÚSCULAS.
    // 3. .filter(Boolean): Borra las categorías que hayan quedado vacías ("").
    // 4. new Set(...): Elimina cualquier categoría duplicada (ej: ["PIZZA", "PIZZA"] -> "PIZZA").
    // 5. [... ]: El Spread Operator desparrama el Set de vuelta a un Array normal de JavaScript.
    const categorias = [...new Set((categoria || []).map(c => String(c).trim().toUpperCase()).filter(Boolean))];
    
    if (!categorias.length) throw new Error('Selecciona al menos una categoría.');
    
    const esMenu = categorias.includes('MENU');
    
    // OPERADOR TERNARIO: Si el plato es un Menú (esMenu = true), limpia la lista de 
    // IDs de los platos que lo componen eliminando duplicados. Si no es menú, devuelve lista vacía [].
    const ids = esMenu ? [...new Set((platos_existentes || []).map(String))] : [];
    
    // Si el usuario dijo que esto es un Menú, pero no incluyó ningún plato dentro (!ids.length).
    if (esMenu && !ids.length) throw new Error('Selecciona los productos que incluye este menú.');
    
    // VALIDACIÓN DE IDs (Anti-Hackeo y Anti-Bucles):
    // .some(...) verifica si ALGÚN ID de la lista incumple las reglas:
    // 1. !/^[1-9]\d*$/.test(id): Expresión Regular para evitar texto basura (debe ser un número).
    // 2. id === String(id_plato): Evita que un Menú se contenga a sí mismo, evitando un bucle infinito.
    if (ids.some(id => !/^[1-9]\d*$/.test(id) || id === String(id_plato))) throw new Error('Un menú no puede incluirse a sí mismo. Selecciona productos válidos.');
    
    // Extrae un "cable privado" de la base de datos para hacer transacciones seguras.
    const conexion = await pool.connect();
    
    try {
      // TRANSACCIÓN SQL: Inicia un bloque seguro. Si algo falla más adelante, 
      // se hará un 'ROLLBACK' y ningún cambio se guardará en la base de datos.
      await conexion.query('BEGIN');
      
      // FOR UPDATE: Bloquea la fila de este plato en la BD para que nadie más lo edite mientras nosotros lo hacemos.
      const existente = await conexion.query(`
        SELECT p.* FROM Platos p JOIN Restaurantes r ON r.id_restaurante = p.id_restaurante
        WHERE p.id_plato = $1 AND p.id_restaurante = $2 AND r.id_usuario_dueño = $3
        FOR UPDATE OF p
      `, [id_plato, id_restaurante, contexto.usuario.id_usuario]);
      
      if (!existente.rows[0]) throw new Error('El producto no existe o no pertenece a uno de tus locales.');
      
      let items = [];
      if (esMenu) {
        // NORMALIZACIÓN DE DATOS DE POSTGRESQL (Array vs Texto):
        // A veces la base de datos devuelve arrays como texto bruto: "{PIZZA, VEGANA}".
        // - Array.isArray: Pregunta "¿Esto ya es una lista limpia de JavaScript?".
        // - Si lo es (?), guárdala tal cual.
        // - Si no lo es (:), conviértelo a texto, usa .replace(/[{}"\[\]]/g, '') para 
        //   borrar todos los símbolos raros (llaves, corchetes), y córtalo por las comas (.split).
        const categoriasExistentes = Array.isArray(existente.rows[0].categoria) ? existente.rows[0].categoria : String(existente.rows[0].categoria || '').replace(/[{}"\[\]]/g, '').split(',');
        
        // .some(...) verifica si en la lista de categorías antiguas, ALGUNA de ellas es la palabra 'MENU'.
        const yaEsMenu = categoriasExistentes.some(c => String(c).trim().toUpperCase() === 'MENU');
        
        if (!yaEsMenu) {
          // Compartir platos entre menús es válido. Solo se bloquea convertir
          // un producto individual incluido, para no crear un menú anidado.
          
          // SUBCONSULTA SQL COMPLEJA (NOT EXISTS):
          // Verifica que el plato esté como ingrediente de otro Menú, PERO se asegura
          // de que él mismo no sea ya un Menú. Previene "Menús dentro de Menús".
          const referencias = await conexion.query('SELECT 1 FROM Menu_Platos WHERE id_plato_incluido = $1 AND NOT EXISTS (SELECT 1 FROM Menu_Platos WHERE id_menu = $1) LIMIT 1', [id_plato]);
          
          if (referencias.rows.length) throw new Error('Este producto individual está incluido en otro menú. Para crear un menú con estos platos, crea un producto nuevo en vez de convertir este.');
        }
        
        // ANY($2::int[]): Busca todos los platos cuyos IDs coincidan con la lista proporcionada por el usuario.
        const seleccion = await conexion.query('SELECT * FROM Platos WHERE id_restaurante = $1 AND id_plato = ANY($2::int[]) ORDER BY id_plato', [id_restaurante, ids]);
        if (seleccion.rows.length !== ids.length) throw new Error('Selecciona productos existentes de este local.');
        
        // Evalúa de nuevo las categorías de los platos seleccionados para asegurarse de que el usuario no metió un menú dentro del nuevo menú.
        if (seleccion.rows.some(p => (Array.isArray(p.categoria) ? p.categoria : String(p.categoria || '').replace(/[{}"\[\]]/g, '').split(',')).some(c => String(c).trim().toUpperCase() === 'MENU'))) throw new Error('Un menú solo puede incluir productos individuales.');
        items = seleccion.rows;
      }
      
      // Actualiza los datos base del plato
      const resultado = await conexion.query(`
        UPDATE Platos SET nombre = $1, descripcion = $2, precio = $3, categoria = $4, imagen_url = $5
        WHERE id_plato = $6 AND id_restaurante = $7 RETURNING *
      `, [nombre.trim(), descripcion.trim(), precio, categorias, imagen_url || null, id_plato, id_restaurante]);
      
      // Borra los ingredientes antiguos de la tabla intermedia y añade los nuevos usando unnest.
      await conexion.query('DELETE FROM Menu_Platos WHERE id_menu = $1', [id_plato]);
      if (ids.length) await conexion.query('INSERT INTO Menu_Platos (id_menu, id_plato_incluido) SELECT $1, unnest($2::int[])', [id_plato, ids]);
      
      // COMMIT: Todo salió bien, le dice a PostgreSQL que guarde todos los cambios definitivamente.
      await conexion.query('COMMIT');
      
      // Devuelve el objeto del plato editado inyectándole la lista completa de items_menu actualizados.
      return { ...resultado.rows[0], items_menu: items };
      
    } catch (error) {
      // ROLLBACK: Si cualquier cosa falla (error de datos, caída de la BD), deshace todos
      // los cambios en bloque para no dejar la base de datos corrupta, y lanza el error.
      await conexion.query('ROLLBACK');
      throw error;
      
    } finally { 
      // FINALLY: Se ejecuta siempre. Devuelve el "cable" privado a la piscina de conexiones 
      // para que otro usuario pueda usarlo.
      conexion.release(); 
    }
  };
}