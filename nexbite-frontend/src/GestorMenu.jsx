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
  const [marcarAgotado, { loading }] = useMutation(MARCAR_AGOTADO, { 
    refetchQueries: [{ query: OBTENER_MENU, variables: { id: idRestaurante } }] 
  });

  const handleEstado = (estadoNuevo) => {
    marcarAgotado({ variables: { id_plato: plato.id_plato, disponible: estadoNuevo, tiempo: estadoNuevo ? null : tiempo } });
  };

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: plato.disponible === false ? 0.7 : 1 }}>
      {plato.imagen_url ? <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '120px', objectFit: 'cover' }} /> : <div style={{ height: '120px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</div>}
      
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '5px' }}>
          {Array.isArray(plato.categoria) && plato.categoria.map(cat => (
            <span key={cat} style={{ fontSize: '10px', background: '#ffe4cc', color: '#ff4500', padding: '2px 6px', borderRadius: '10px' }}>{cat}</span>
          ))}
        </div>
        <h4 style={{ margin: '5px 0' }}>{plato.nombre}</h4>
        <b style={{ color: '#0066cc' }}>€{plato.precio}</b>
        
        <div style={{ margin: '15px 0' }}>
          {plato.disponible === false ? (
            <div style={{ backgroundColor: '#ffeaa7', padding: '10px', borderRadius: '5px', textAlign: 'center' }}>
              <p style={{ color: '#d63031', fontWeight: 'bold', margin: '0 0 5px 0', fontSize: '0.9rem' }}>⚠️ Agotado (Hasta: {formatearFecha(plato.tiempo_disponible)})</p>
              <button onClick={() => handleEstado(true)} disabled={loading} style={{ width: '100%', background: '#00b894', color: 'white', padding: '5px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✅ Volver a activar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <select value={tiempo} onChange={(e) => setTiempo(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="30 minutos">30 minutos</option><option value="1 hora">1 hora</option><option value="2 horas">2 horas</option><option value="1 día">1 día</option><option value="2 días">2 días</option><option value="1 semana">1 semana</option><option value="Indefinido">Indefinido</option>
              </select>
              <button onClick={() => handleEstado(false)} disabled={loading} style={{ width: '100%', background: '#d63031', color: 'white', padding: '5px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>❌ Pausar Plato</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => cargarParaEditar(plato)} style={{ flex: 1, padding: '5px', background: '#ffc107', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✏️ Editar</button>
          <button onClick={() => eliminarPlato({ variables: { id: plato.id_plato } })} style={{ padding: '5px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
        </div>
      </div>
    </div>
  );
}

const OPCIONES_CATEGORIAS = ['ENTRANTE', 'COMPARTIR', 'PLATO', 'BEBIDA', 'POSTRE', 'OFERTA', 'MENU'];

export default function GestorMenu({ idRestaurante, nombreRestaurante }) {
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', precio: '', categoria: ['ENTRANTE'], imagen_url: '' });
  const fileInputRef = useRef(null);
  
  const [platosSeleccionados, setPlatosSeleccionados] = useState([]);
  
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
      if (cat === 'MENU') {
        return { ...prev, categoria: prev.categoria.includes('MENU') ? [] : ['MENU'] };
      } else {
        const categoriasSinMenu = prev.categoria.filter(c => c !== 'MENU');
        const nuevasCategorias = categoriasSinMenu.includes(cat) ? categoriasSinMenu.filter(c => c !== cat) : [...categoriasSinMenu, cat];            
        return { ...prev, categoria: nuevasCategorias };
      }
    });
  };

  const recalcularMenu = (seleccionadosActuales) => {
    const platosExistentes = seleccionadosActuales
      .map(id => platosDisponibles.find(p => p.id_plato === id))
      .filter(Boolean);

    const nombres = platosExistentes.map(p => p.nombre);
    const nuevaDescripcion = nombres.length > 0 ? "Incluye: " + nombres.join(', ') : "";

    const sumaPrecios = platosExistentes.reduce((sum, p) => sum + parseFloat(p.precio || 0), 0);
    
    setFormData(prev => ({
      ...prev,
      descripcion: nuevaDescripcion || prev.descripcion, 
      precio: sumaPrecios > 0 ? (sumaPrecios * 0.85).toFixed(2) : prev.precio 
    }));
  };

  const agregarPlatoExistente = (id_plato) => {
    setPlatosSeleccionados((prev) => {
      const esSeleccionado = prev.includes(id_plato);
      const nuevosSeleccionados = esSeleccionado ? prev.filter(id => id !== id_plato) : [...prev, id_plato];
      
      recalcularMenu(nuevosSeleccionados);
      return nuevosSeleccionados;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.categoria.length === 0) return alert("Debes seleccionar al menos una categoría.");
    
    if (formData.categoria.includes('MENU') && platosSeleccionados.length === 0) {
       return alert("Un menú debe incluir al menos un plato de la carta.");
    }

    try {
      await crearPlato({ 
        variables: { 
          ...formData, 
          id_restaurante: idRestaurante, 
          precio: parseFloat(formData.precio),
          platos_existentes: formData.categoria.includes('MENU') ? platosSeleccionados : []
        } 
      });
      setFormData({ nombre: '', descripcion: '', precio: '', categoria: ['ENTRANTE'], imagen_url: '' });
      setPlatosSeleccionados([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) { alert("Error al guardar."); }
  };

  const cargarParaEditar = (plato) => {
    setFormData({ nombre: plato.nombre, descripcion: plato.descripcion, precio: plato.precio, categoria: Array.isArray(plato.categoria) ? plato.categoria : [plato.categoria], imagen_url: plato.imagen_url || '' });
    eliminarPlato({ variables: { id: plato.id_plato } });
    window.scrollTo(0, 0); 
  };

  const esMenu = formData.categoria.includes('MENU');

  return (
    <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2 style={{ color: '#ff4500', marginTop: 0 }}>📋 Gestor de Menú: {nombreRestaurante}</h2>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <form onSubmit={handleSubmit} style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
          
          <h3 style={{ marginTop: 0, color: '#333' }}>✨ Añadir Nuevo Plato o Combo</h3>

          <input type="text" placeholder="Nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required style={inputStyle} />
          
          <textarea placeholder="Descripción" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} required style={{ ...inputStyle, minHeight: '80px' }} />
          <input type="number" step="0.01" placeholder="Precio (€)" value={formData.precio} onChange={(e) => setFormData({ ...formData, precio: e.target.value })} required style={inputStyle} />
          
          <div style={{ ...inputStyle, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>Categorías:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {OPCIONES_CATEGORIAS.map(cat => (
                <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', cursor: 'pointer', background: formData.categoria.includes(cat) ? '#ffe4cc' : '#eee', padding: '5px 10px', borderRadius: '20px', transition: '0.2s' }}>
                  <input type="checkbox" checked={formData.categoria.includes(cat)} onChange={() => manejarCambioCheckbox(cat)} style={{ display: 'none' }} />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          {esMenu && (
            <div style={{ backgroundColor: '#fff', border: '2px dashed #0066cc', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#0066cc' }}>🍔 Configurar Menú/Combo</h4>
              <p style={{ fontSize: '12px', color: '#666', marginTop: 0 }}>*Selecciona productos de tu carta. La descripción y el precio (con 15% de descuento) se autocompletarán.</p>
              
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                {platosDisponibles.length === 0 ? <p style={{ fontSize: '13px', color: '#666' }}>No hay platos en la carta.</p> : platosDisponibles.map(p => (
                  <label key={p.id_plato} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={platosSeleccionados.includes(p.id_plato)} onChange={() => agregarPlatoExistente(p.id_plato)} />
                    {p.nombre} ({p.precio}€)
                  </label>
                ))}
              </div>
            </div>
          )}

          <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} style={{ ...inputStyle, cursor: 'pointer' }} />
          {formData.imagen_url && <img src={formData.imagen_url} alt="Previa" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }} />}
          <button type="submit" disabled={loading} style={{ padding: '1rem', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{loading ? 'Subiendo...' : 'Guardar Plato'}</button>
        </form>

        <div style={{ flex: '2 1 400px' }}>
          <h3>Carta Actual ({menuData?.obtenerMenuRestaurante.length || 0} ítems)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {menuData?.obtenerMenuRestaurante.map(plato => (
              <TarjetaPlato key={plato.id_plato} plato={plato} idRestaurante={idRestaurante} cargarParaEditar={cargarParaEditar} eliminarPlato={eliminarPlato} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { padding: '0.8rem', borderRadius: '6px', border: '1px solid #ccc' };