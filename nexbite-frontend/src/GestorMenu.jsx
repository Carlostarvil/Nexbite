import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

const CREAR_PLATO = gql`
  mutation CrearPlato($id_restaurante: ID!, $nombre: String!, $descripcion: String!, $precio: Float!, $categoria: [String]!, $imagen_url: String, $platos_existentes: [ID!]) { 
    crearPlato(id_restaurante: $id_restaurante, nombre: $nombre, descripcion: $descripcion, precio: $precio, categoria: $categoria, imagen_url: $imagen_url, platos_existentes: $platos_existentes) { 
      id_plato 
    } 
  }
`;
const ELIMINAR_PLATO = gql`mutation EliminarPlato($id: ID!) { eliminarPlato(id_plato: $id) }`;
const OBTENER_MENU = gql`query ObtenerMenu($id: ID!) { obtenerMenuRestaurante(id_restaurante: $id) { id_plato, nombre, descripcion, precio, categoria, imagen_url, disponible, tiempo_disponible } }`;
const MARCAR_AGOTADO = gql`mutation MarcarPlatoAgotado($id_plato: ID!, $disponible: Boolean!, $tiempo: String) { marcarPlatoAgotado(id_plato: $id_plato, disponible: $disponible, tiempo: $tiempo) { id_plato, disponible, tiempo_disponible } }`;

const OPCIONES_CATEGORIAS = ['ENTRANTE', 'COMPARTIR', 'PLATO', 'BEBIDA', 'POSTRE', 'OFERTA', 'MENU'];

// Traductor universal que extrae los TAGS ocultos de la descripción para saltarse el bloqueo de la BD
const parseCategorias = (catData) => {
  if (!catData) return [];
  try {
    if (typeof catData === 'string') return catData.replace(/[{}"[\]\\]/g, '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (Array.isArray(catData)) return catData.flatMap(c => typeof c === 'string' ? c.replace(/[{}"[\]\\]/g, '').split(',').map(s => s.trim().toUpperCase()) : String(c).toUpperCase()).filter(Boolean);
  } catch(e) {}
  return [];
};

const extraerTags = (descripcion, categoriasBackend) => {
  let descLimpia = descripcion || '';
  let tagsExtra = [];
  if (descLimpia.includes(' |TAGS:')) {
    const partes = descLimpia.split(' |TAGS:');
    descLimpia = partes[0];
    tagsExtra = partes[1].split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  }
  return { descLimpia, tagsTotales: [...parseCategorias(categoriasBackend), ...tagsExtra] };
};

const formatearFecha = (fechaStr) => {
  if (!fechaStr || fechaStr === 'Indefinido') return 'Indefinido';
  try {
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return fechaStr; 
    return fecha.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } catch(e) { return fechaStr; }
};

function TarjetaPlato({ plato, idRestaurante, cargarParaEditar, eliminarPlato }) {
  const [tiempo, setTiempo] = useState('1 hora');
  const [marcarAgotado, { loading }] = useMutation(MARCAR_AGOTADO, { refetchQueries: [{ query: OBTENER_MENU, variables: { id: idRestaurante } }] });

  const handleEstado = (estadoNuevo) => {
    marcarAgotado({ variables: { id_plato: plato.id_plato, disponible: estadoNuevo, tiempo: estadoNuevo ? null : tiempo } });
  };

  const { tagsTotales } = extraerTags(plato.descripcion, plato.categoria);

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: plato.disponible === false ? 0.7 : 1, backgroundColor: '#fff' }}>
      {plato.imagen_url ? <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '120px', objectFit: 'cover' }} /> : <div style={{ height: '120px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</div>}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '5px' }}>
          {tagsTotales.map(cat => {
            const esBase = OPCIONES_CATEGORIAS.includes(cat);
            return (
              <span key={cat} style={{ fontSize: '10px', background: esBase ? '#ffe4cc' : '#e3f2fd', color: esBase ? '#ff4500' : '#0066cc', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {cat}
              </span>
            );
          })}
        </div>
        <h4 style={{ margin: '5px 0' }}>{plato.nombre}</h4>
        <b style={{ color: '#0066cc' }}>€{plato.precio}</b>
        
        <div style={{ margin: '15px 0', marginTop: 'auto' }}>
          {plato.disponible === false ? (
            <div style={{ backgroundColor: '#ffeaa7', padding: '10px', borderRadius: '5px', textAlign: 'center' }}>
              <p style={{ color: '#d63031', fontWeight: 'bold', margin: '0 0 5px 0', fontSize: '0.9rem' }}>⚠️ Agotado</p>
              <button onClick={() => handleEstado(true)} disabled={loading} style={{ width: '100%', background: '#00b894', color: 'white', padding: '5px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✅ Volver a activar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <select value={tiempo} onChange={(e) => setTiempo(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="30 minutos">30 min</option><option value="1 hora">1 hora</option><option value="2 horas">2 horas</option><option value="Indefinido">Indefinido</option>
              </select>
              <button onClick={() => handleEstado(false)} disabled={loading} style={{ width: '100%', background: '#d63031', color: 'white', padding: '5px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>❌ Pausar Plato</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => cargarParaEditar(plato)} style={{ flex: 1, padding: '5px', background: '#ffc107', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✏️ Editar</button>
          <button onClick={() => eliminarPlato({ variables: { id: plato.id_plato } })} style={{ padding: '5px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
        </div>
      </div>
    </div>
  );
}

export default function GestorMenu({ idRestaurante, nombreRestaurante }) {
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', precio: '', categoria: ['ENTRANTE'], imagen_url: '' });
  const fileInputRef = useRef(null);
  
  const [platosSeleccionados, setPlatosSeleccionados] = useState([]);
  const [inputValueTag, setInputValueTag] = useState('');
  
  const { data: menuData } = useQuery(OBTENER_MENU, { variables: { id: idRestaurante } });
  const [crearPlato, { loading }] = useMutation(CREAR_PLATO, { refetchQueries: [{ query: OBTENER_MENU, variables: { id: idRestaurante } }] });
  const [eliminarPlato] = useMutation(ELIMINAR_PLATO, { refetchQueries: [{ query: OBTENER_MENU, variables: { id: idRestaurante } }] });
  
  const platosDisponibles = menuData?.obtenerMenuRestaurante || [];

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, imagen_url: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const manejarCambioCheckbox = (cat) => {
    setFormData((prev) => {
      if (cat === 'MENU') return { ...prev, categoria: prev.categoria.includes('MENU') ? [] : ['MENU'] };
      const categoriasSinMenu = prev.categoria.filter(c => c !== 'MENU');
      return { ...prev, categoria: categoriasSinMenu.includes(cat) ? categoriasSinMenu.filter(c => c !== cat) : [...categoriasSinMenu, cat] };
    });
  };

  // Convertimos en función externa para usarla tanto con Enter como al salir del recuadro
  const procesarNuevaEtiqueta = () => {
    const newTag = inputValueTag.trim().toUpperCase();
    if (newTag && !formData.categoria.includes(newTag)) {
      setFormData(prev => ({ ...prev, categoria: [...prev.categoria, newTag] }));
    }
    setInputValueTag('');
  };

  const handleKeyDownTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); 
      procesarNuevaEtiqueta();
    }
  };

  const eliminarTag = (tagAEliminar) => setFormData(prev => ({ ...prev, categoria: prev.categoria.filter(c => c !== tagAEliminar) }));

  const recalcularMenu = (seleccionadosActuales) => {
    const platosExistentes = seleccionadosActuales.map(id => platosDisponibles.find(p => p.id_plato === id)).filter(Boolean);
    const nombres = platosExistentes.map(p => p.nombre);
    const sumaPrecios = platosExistentes.reduce((sum, p) => sum + parseFloat(p.precio || 0), 0);
    setFormData(prev => ({
      ...prev,
      descripcion: nombres.length > 0 ? "Incluye: " + nombres.join(', ') : prev.descripcion, 
      precio: sumaPrecios > 0 ? (sumaPrecios * 0.85).toFixed(2) : prev.precio 
    }));
  };

  const agregarPlatoExistente = (id_plato) => {
    setPlatosSeleccionados((prev) => {
      const nuevos = prev.includes(id_plato) ? prev.filter(id => id !== id_plato) : [...prev, id_plato];
      recalcularMenu(nuevos);
      return nuevos;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Capturamos cualquier etiqueta que el usuario haya escrito pero no haya confirmado con Enter
    let categoriasFinales = [...formData.categoria];
    const tagPendiente = inputValueTag.trim().toUpperCase();
    if (tagPendiente && !categoriasFinales.includes(tagPendiente)) {
      categoriasFinales.push(tagPendiente);
    }

    const categoriasBase = categoriasFinales.filter(c => OPCIONES_CATEGORIAS.includes(c));
    const categoriasExtra = categoriasFinales.filter(c => !OPCIONES_CATEGORIAS.includes(c));
    
    if (categoriasBase.length === 0 && categoriasExtra.length === 0) return alert("Debes seleccionar al menos una categoría.");
    if (categoriasFinales.includes('MENU') && platosSeleccionados.length === 0) return alert("Un menú debe incluir platos.");

    // EL TRUCO: Camuflamos los tags en la descripción
    const catParaEnviar = categoriasBase.length > 0 ? categoriasBase : ['PLATO'];
    const descFinal = categoriasExtra.length > 0 ? `${formData.descripcion} |TAGS:${categoriasExtra.join(',')}` : formData.descripcion;

    try {
      await crearPlato({ 
        variables: { 
          ...formData, 
          descripcion: descFinal,
          categoria: catParaEnviar,
          id_restaurante: idRestaurante, 
          precio: parseFloat(formData.precio),
          platos_existentes: categoriasFinales.includes('MENU') ? platosSeleccionados : []
        } 
      });
      setFormData({ nombre: '', descripcion: '', precio: '', categoria: ['ENTRANTE'], imagen_url: '' });
      setPlatosSeleccionados([]);
      setInputValueTag('');
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) { alert("Error al guardar."); }
  };

  const cargarParaEditar = (plato) => {
    const { descLimpia, tagsTotales } = extraerTags(plato.descripcion, plato.categoria);
    setFormData({ nombre: plato.nombre, descripcion: descLimpia, precio: plato.precio, categoria: tagsTotales, imagen_url: plato.imagen_url || '' });
    setPlatosSeleccionados(Array.isArray(plato.platos_existentes) ? plato.platos_existentes : []);
    eliminarPlato({ variables: { id: plato.id_plato } });
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const esMenu = formData.categoria.includes('MENU');

  return (
    <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2 style={{ color: '#ff4500', marginTop: 0 }}>📋 Gestor de Menú: {nombreRestaurante}</h2>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <form onSubmit={handleSubmit} style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eaeaea' }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>✨ Añadir Nuevo Plato o Combo</h3>
          <input type="text" placeholder="Nombre del plato" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required style={inputStyle} />
          <textarea placeholder="Descripción (Ingredientes, tamaño...)" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} required style={{ ...inputStyle, minHeight: '80px', fontFamily: 'inherit' }} />
          <input type="number" step="0.01" placeholder="Precio (€)" value={formData.precio} onChange={(e) => setFormData({ ...formData, precio: e.target.value })} required style={inputStyle} />
          
          <div style={{ ...inputStyle, display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>Categorías Base:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {OPCIONES_CATEGORIAS.map(cat => (
                <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', background: formData.categoria.includes(cat) ? '#ff4500' : '#f0f0f0', color: formData.categoria.includes(cat) ? '#fff' : '#333', padding: '6px 12px', borderRadius: '20px', transition: 'all 0.2s', fontWeight: formData.categoria.includes(cat) ? 'bold' : 'normal' }}>
                  <input type="checkbox" checked={formData.categoria.includes(cat)} onChange={() => manejarCambioCheckbox(cat)} style={{ display: 'none' }} />
                  {cat}
                </label>
              ))}
            </div>

            <div style={{ borderTop: '1px dashed #ccc', marginTop: '5px', paddingTop: '10px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#555', display: 'block', marginBottom: '8px' }}>Etiquetas Personalizadas:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {formData.categoria.filter(c => !OPCIONES_CATEGORIAS.includes(c)).map(tag => (
                  <span key={tag} style={{ background: '#e3f2fd', color: '#0066cc', padding: '5px 12px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {tag}
                    <span onClick={() => eliminarTag(tag)} style={{ cursor: 'pointer', background: '#bbdefb', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', marginLeft: '2px' }}>×</span>
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Escribe y pulsa Enter (ej. Vegano...)" 
                value={inputValueTag} 
                onChange={(e) => setInputValueTag(e.target.value)} 
                onKeyDown={handleKeyDownTag}
                onBlur={procesarNuevaEtiqueta} 
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          {esMenu && (
            <div style={{ backgroundColor: '#fff', border: '2px dashed #0066cc', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#0066cc' }}>🍔 Configurar Menú/Combo</h4>
              <p style={{ fontSize: '12px', color: '#666', marginTop: 0 }}>*Selecciona productos de tu carta. La descripción y el precio (con 15% de descuento) se autocompletarán.</p>
              
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                {platosDisponibles.length === 0 ? <p style={{ fontSize: '13px', color: '#666' }}>No hay platos en la carta.</p> : platosDisponibles.map(p => (
                  <label key={p.id_plato} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '5px', background: platosSeleccionados.includes(p.id_plato) ? '#e6f2ff' : 'transparent', borderRadius: '4px' }}>
                    <input type="checkbox" checked={platosSeleccionados.includes(p.id_plato)} onChange={() => agregarPlatoExistente(p.id_plato)} />
                    {p.nombre} <b style={{ color: '#0066cc' }}>({p.precio}€)</b>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...inputStyle, background: '#fff' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#555', display: 'block', marginBottom: '8px' }}>Imagen del plato:</span>
            <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} style={{ width: '100%', cursor: 'pointer', fontSize: '13px' }} />
          </div>

          {formData.imagen_url && <img src={formData.imagen_url} alt="Previa" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #eee' }} />}
          <button type="submit" disabled={loading} style={{ padding: '1rem', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', transition: 'background 0.2s', marginTop: '10px' }}>
            {loading ? 'Guardando...' : '💾 Guardar Plato en la Carta'}
          </button>
        </form>

        <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Carta Actual <span style={{ background: '#eee', padding: '2px 8px', borderRadius: '12px', fontSize: '14px' }}>{menuData?.obtenerMenuRestaurante.length || 0}</span></h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {menuData?.obtenerMenuRestaurante.map(plato => (
              <TarjetaPlato key={plato.id_plato} plato={plato} idRestaurante={idRestaurante} cargarParaEditar={cargarParaEditar} eliminarPlato={eliminarPlato} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '15px' };