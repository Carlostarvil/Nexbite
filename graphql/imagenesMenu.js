export function crearResolversImagenesMenu(pool) {
  const consultas = new WeakMap();
  const obtenerItems = plato => {
    if (Array.isArray(plato.items_menu)) return Promise.resolve(plato.items_menu);
    const categorias = Array.isArray(plato.categoria) ? plato.categoria : String(plato.categoria || '').replace(/[{}"\[\]]/g, '').split(',').map(c => c.trim());
    if (!categorias.includes('MENU')) return Promise.resolve([]);
    if (!consultas.has(plato)) {
      consultas.set(plato, pool.query(`
        SELECT incluido.* FROM Menu_Platos vinculo
        JOIN Platos incluido ON incluido.id_plato = vinculo.id_plato_incluido
        JOIN Platos menu ON menu.id_plato = vinculo.id_menu
        WHERE vinculo.id_menu = $1 AND incluido.id_restaurante = menu.id_restaurante
        ORDER BY incluido.id_plato
      `, [plato.id_plato]).then(resultado => resultado.rows));
    }
    return consultas.get(plato);
  };

  return {
    items_menu: obtenerItems,
    imagen_url: async plato => plato.imagen_url || (await obtenerItems(plato)).find(item => item.imagen_url)?.imagen_url || null,
  };
}

export function crearPlatoConItems(pool) {
  return async (_, { id_restaurante, nombre, descripcion, precio, categoria, imagen_url, platos_existentes = [] }) => {
    const ids = [...new Set((platos_existentes || []).map(String))];
    const conexion = await pool.connect();
    try {
      await conexion.query('BEGIN');
      let items = [];
      if (ids.length) {
        const seleccion = await conexion.query('SELECT * FROM Platos WHERE id_restaurante = $1 AND id_plato = ANY($2::int[]) ORDER BY id_plato', [id_restaurante, ids]);
        if (seleccion.rows.length !== ids.length) throw new Error('Selecciona platos existentes de este local para crear el menú.');
        items = seleccion.rows;
      }
      const resultado = await conexion.query(
        'INSERT INTO Platos (id_restaurante, nombre, descripcion, precio, categoria, imagen_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [id_restaurante, nombre, descripcion, precio, categoria, imagen_url || null]
      );
      const nuevoPlato = resultado.rows[0];
      if (ids.length) {
        await conexion.query('INSERT INTO Menu_Platos (id_menu, id_plato_incluido) SELECT $1, unnest($2::int[])', [nuevoPlato.id_plato, ids]);
      }
      await conexion.query('COMMIT');
      return { ...nuevoPlato, items_menu: items };
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    } finally {
      conexion.release();
    }
  };
}
