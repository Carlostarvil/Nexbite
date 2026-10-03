import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

const OBTENER_PERFIL = gql`
  query ObtenerPerfilUsuario($id_usuario: ID!) {
    obtenerPerfilUsuario(id_usuario: $id_usuario) {
      id_usuario, nombre, email, rol, telefono, direccion
    }
  }
`;

const OBTENER_MIS_PEDIDOS = gql`
  query ObtenerPedidosCliente($id_usuario: ID!) {
    obtenerPedidosCliente(id_usuario: $id_usuario) {
      id_pedido, id_restaurante, id_plato, nombre_plato, precio_plato
      estado, nombre_restaurante, imagen_restaurante, plato_disponible, restaurante_abierto
      fecha_pedido, descripcion_plato, imagen_plato
    }
  }
`;

const ACTUALIZAR_PERFIL = gql`
  mutation ActualizarPerfilUsuario($id_usuario: ID!, $telefono: String, $direccion: String) {
    actualizarPerfilUsuario(id_usuario: $id_usuario, telefono: $telefono, direccion: $direccion) {
      telefono, direccion
    }
  }
`;

const formatearFecha = (timestampStr) => {
  if (!timestampStr) return 'Fecha desconocida';
  const fecha = new Date(Number(timestampStr) || timestampStr);
  return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function PerfilUsuario({ onVolver, onAgregarAlCarrito, onSelectPlato }) {
  const usuarioLogueado = JSON.parse(localStorage.getItem('user')) || {};
  const idUsuarioActual = usuarioLogueado.id_usuario;

  const { data: dataPerfil, loading: loadingPerfil } = useQuery(OBTENER_PERFIL, { variables: { id_usuario: idUsuarioActual }, fetchPolicy: 'network-only' });
  const { data: dataPedidos, loading: loadingPedidos } = useQuery(OBTENER_MIS_PEDIDOS, { variables: { id_usuario: idUsuarioActual }, fetchPolicy: 'network-only' });

  const [actualizarPerfil, { loading: guardando }] = useMutation(ACTUALIZAR_PERFIL);

  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  useEffect(() => {
    if (dataPerfil && dataPerfil.obtenerPerfilUsuario) {
      setTelefono(dataPerfil.obtenerPerfilUsuario.telefono || '');
      setDireccion(dataPerfil.obtenerPerfilUsuario.direccion || '');
    }
  }, [dataPerfil]);

  const handleGuardarCambios = async () => {
    try {
      await actualizarPerfil({ variables: { id_usuario: idUsuarioActual, telefono, direccion } });
      alert('✅ ¡Datos guardados correctamente!');
    } catch (err) { alert('Hubo un error al guardar.'); }
  };

  const manejarCambioDireccion = (texto) => {
    setDireccion(texto);
    if (timeoutId) clearTimeout(timeoutId);
    if (texto.length < 4) { setSugerencias([]); setBuscandoDireccion(false); return; }
    setBuscandoDireccion(true);
    const nuevoTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${texto}&limit=5&addressdetails=1`);
        const resultados = await res.json();
        setSugerencias(resultados);
      } catch (err) { console.error(err); } finally { setBuscandoDireccion(false); }
    }, 600);
    setTimeoutId(nuevoTimeout);
  };

  const seleccionarDireccion = (direccionElegida) => {
    setDireccion(direccionElegida.display_name);
    setSugerencias([]); 
  };

  const handleRecomprar = (e, pedido) => {
    e.stopPropagation(); 
    onAgregarAlCarrito({ id_plato: pedido.id_plato, id_restaurante: pedido.id_restaurante, nombre: pedido.nombre_plato, precio: pedido.precio_plato });
  };

  const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '5px', boxSizing: 'border-box', fontSize: '1rem', outline: 'none' };

  if (loadingPerfil) return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando tu perfil...</div>;
  const perfil = dataPerfil?.obtenerPerfilUsuario || usuarioLogueado;
  const pedidos = dataPedidos?.obtenerPedidosCliente || [];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 'bold' }}>&larr; Volver</button>
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1.5rem' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#ff4500', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold' }}>
              {perfil.nombre ? perfil.nombre.charAt(0).toUpperCase() : '👤'}
            </div>
            <div>
              <h1 style={{ margin: '0 0 5px 0', color: '#333' }}>{perfil.nombre}</h1>
              <span style={{ background: '#eee', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
                Rol: {perfil.rol === 'VENDEDOR' ? '👨‍🍳 Vendedor' : '🍔 Cliente'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div><label style={{ fontWeight: 'bold', color: '#555' }}>✉️ Correo Electrónico</label><input type="email" value={perfil.email} disabled style={{ ...inputStyle, backgroundColor: '#f5f5f5', color: '#888', cursor: 'not-allowed' }} /></div>
            <div><label style={{ fontWeight: 'bold', color: '#555' }}>📞 Teléfono de Contacto</label><input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} style={inputStyle} onFocus={(e) => e.target.style.borderColor = '#ff4500'} onBlur={(e) => e.target.style.borderColor = '#ccc'} /></div>
            <div style={{ position: 'relative' }}>
              <label style={{ fontWeight: 'bold', color: '#555' }}>📍 Dirección de Entrega Principal</label>
              <input type="text" value={direccion} onChange={(e) => manejarCambioDireccion(e.target.value)} style={inputStyle} onFocus={(e) => e.target.style.borderColor = '#ff4500'} onBlur={(e) => setTimeout(() => setSugerencias([]), 200)} />
              {sugerencias.length > 0 && (
                <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', zIndex: 100, listStyle: 'none', padding: 0, margin: '5px 0 0 0', boxShadow: '0 8px 15px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  {sugerencias.map((sug, index) => (
                    <li key={index} onMouseDown={() => seleccionarDireccion(sug)} style={{ padding: '12px 15px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '14px', color: '#333' }}>
                      <b>{sug.address?.road || sug.address?.pedestrian || sug.address?.suburb || 'Ubicación'} {sug.address?.house_number || ''}</b>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{sug.display_name}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={handleGuardarCambios} disabled={guardando} style={{ marginTop: '1rem', padding: '1rem', background: '#00cc66', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1 }}>
              {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 style={{ color: '#333', borderBottom: '2px solid #ff4500', paddingBottom: '10px', display: 'inline-block' }}>🕒 Tus Pedidos Anteriores</h2>
        {loadingPedidos ? <p>Cargando tu historial...</p> : pedidos.length === 0 ? (
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', textAlign: 'center', color: '#666', border: '1px dashed #ccc' }}>Aún no has realizado ningún pedido.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {pedidos.map(pedido => {
              const puedeRecomprar = pedido.restaurante_abierto && pedido.plato_disponible;
              let motivoBloqueo = "";
              if (!pedido.nombre_restaurante) motivoBloqueo = "Restaurante ya no existe";
              else if (!pedido.nombre_plato) motivoBloqueo = "Plato retirado del menú";
              else if (!pedido.restaurante_abierto) motivoBloqueo = "Local cerrado";
              else if (!pedido.plato_disponible) motivoBloqueo = "Plato agotado";

              return (
                <div 
                  key={pedido.id_pedido} 
                  onClick={() => onSelectPlato(pedido)} // CORRECCIÓN: Usamos la función robusta que viene de App.jsx
                  style={{ background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
                >
                  
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    {pedido.imagen_restaurante ? (
                      <img src={pedido.imagen_restaurante} alt={pedido.nombre_restaurante} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '60px', height: '60px', borderRadius: '8px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🏪</div>
                    )}
                    
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', color: '#333' }}>{pedido.nombre_plato || 'Plato desconocido'}</h3>
                      <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>De: <b>{pedido.nombre_restaurante || 'Desconocido'}</b></p>
                      <p style={{ margin: '3px 0 0 0', color: '#999', fontSize: '12px' }}>📅 {formatearFecha(pedido.fecha_pedido)}</p>
                      <span style={{ display: 'inline-block', marginTop: '5px', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: pedido.estado === 'ENTREGADO' ? '#e8f5e9' : '#f5f5f5', color: pedido.estado === 'ENTREGADO' ? '#2e7d32' : '#666' }}>
                        Estado: {pedido.estado}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ff4500' }}>€{pedido.precio_plato?.toFixed(2)}</span>
                    {puedeRecomprar ? (
                      <button 
                        onClick={(e) => handleRecomprar(e, pedido)}
                        style={{ padding: '8px 16px', background: '#00cc66', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        🔄 Volver a pedir
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#dc3545', fontWeight: 'bold' }}>⛔ {motivoBloqueo}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}