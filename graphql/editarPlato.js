// La edición conserva el producto y sus referencias en pedidos y menús.
export function crearEditorPlato(pool) {
  return async (_, { id_plato, id_restaurante, nombre, descripcion, precio, categoria, imagen_url, platos_existentes = [] }, contexto) => {
    if (contexto?.usuario?.rol !== 'VENDEDOR') throw new Error('Inicia sesión como vendedor para editar productos.');
    if (!nombre.trim() || !descripcion.trim()) throw new Error('Completa el nombre y la descripción del producto.');
    if (!Number.isFinite(precio) || precio < 0) throw new Error('El precio debe ser un número válido, igual o mayor que cero.');
    const categorias = [...new Set((categoria || []).map(c => String(c).trim().toUpperCase()).filter(Boolean))];
    if (!categorias.length) throw new Error('Selecciona al menos una categoría.');
    const esMenu = categorias.includes('MENU');
    const ids = esMenu ? [...new Set((platos_existentes || []).map(String))] : [];
    if (esMenu && !ids.length) throw new Error('Selecciona los productos que incluye este menú.');
    if (ids.some(id => !/^[1-9]\d*$/.test(id) || id === String(id_plato))) throw new Error('Un menú no puede incluirse a sí mismo. Selecciona productos válidos.');
    const conexion = await pool.connect();
    try {
      await conexion.query('BEGIN');
      const existente = await conexion.query(`
        SELECT p.* FROM Platos p JOIN Restaurantes r ON r.id_restaurante = p.id_restaurante
        WHERE p.id_plato = $1 AND p.id_restaurante = $2 AND r.id_usuario_dueño = $3
        FOR UPDATE OF p
      `, [id_plato, id_restaurante, contexto.usuario.id_usuario]);
      if (!existente.rows[0]) throw new Error('El producto no existe o no pertenece a uno de tus locales.');
      let items = [];
      if (esMenu) {
        const referencias = await conexion.query('SELECT 1 FROM Menu_Platos WHERE id_plato_incluido = $1 LIMIT 1', [id_plato]);
        if (referencias.rows.length) throw new Error('Este producto ya forma parte de otro menú. No se puede convertir en un menú.');
        const seleccion = await conexion.query('SELECT * FROM Platos WHERE id_restaurante = $1 AND id_plato = ANY($2::int[]) ORDER BY id_plato', [id_restaurante, ids]);
        if (seleccion.rows.length !== ids.length) throw new Error('Selecciona productos existentes de este local.');
        if (seleccion.rows.some(p => (Array.isArray(p.categoria) ? p.categoria : String(p.categoria || '').replace(/[{}"\[\]]/g, '').split(',')).some(c => String(c).trim().toUpperCase() === 'MENU'))) throw new Error('Un menú solo puede incluir productos individuales.');
        items = seleccion.rows;
      }
      const resultado = await conexion.query(`
        UPDATE Platos SET nombre = $1, descripcion = $2, precio = $3, categoria = $4, imagen_url = $5
        WHERE id_plato = $6 AND id_restaurante = $7 RETURNING *
      `, [nombre.trim(), descripcion.trim(), precio, categorias, imagen_url || null, id_plato, id_restaurante]);
      await conexion.query('DELETE FROM Menu_Platos WHERE id_menu = $1', [id_plato]);
      if (ids.length) await conexion.query('INSERT INTO Menu_Platos (id_menu, id_plato_incluido) SELECT $1, unnest($2::int[])', [id_plato, ids]);
      await conexion.query('COMMIT');
      return { ...resultado.rows[0], items_menu: items };
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    } finally { conexion.release(); }
  };
}
