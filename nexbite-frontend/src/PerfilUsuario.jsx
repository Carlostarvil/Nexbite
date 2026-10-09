import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import BotonAgregarCarrito from './BotonAgregarCarrito';
import MensajeAccion, { IconoEstado } from './MensajeAccion';

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
  const [mensajePerfil, setMensajePerfil] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  useEffect(() => {
    if (dataPerfil && dataPerfil.obtenerPerfilUsuario) {
      setTelefono(dataPerfil.obtenerPerfilUsuario.telefono || '');
      setDireccion(dataPerfil.obtenerPerfilUsuario.direccion || '');
    }
  }, [dataPerfil]);

  useEffect(() => {
    if (mensajePerfil?.tipo !== 'exito') return;
    const timer = setTimeout(() => setMensajePerfil(null), 5000);
    return () => clearTimeout(timer);
  }, [mensajePerfil]);

  const handleGuardarCambios = async () => {
    if (guardando) return;
    setMensajePerfil(null);
    try {
      await actualizarPerfil({ variables: { id_usuario: idUsuarioActual, telefono, direccion } });
      setMensajePerfil({ tipo: 'exito', titulo: '¡Cambios guardados!', descripcion: 'Tu teléfono y dirección se han actualizado correctamente.' });
    } catch {
      setMensajePerfil({ tipo: 'error', titulo: 'No se pudieron guardar los cambios', descripcion: 'Comprueba tu conexión y vuelve a intentarlo. Los datos que has escrito siguen aquí.' });
    }
  };

  const manejarCambioDireccion = (texto) => {
    setMensajePerfil(null);
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
    setMensajePerfil(null);
    setDireccion(direccionElegida.display_name);
    setSugerencias([]); 
  };

  const handleRecomprar = (e, pedido) => {
    e.stopPropagation(); 
    return onAgregarAlCarrito({ id_plato: pedido.id_plato, id_restaurante: pedido.id_restaurante, nombre: pedido.nombre_plato, precio: pedido.precio_plato });
  };

  const inputStyle = { width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e0e0e0', marginTop: '8px', boxSizing: 'border-box', fontSize: '1rem', outline: 'none', backgroundColor: '#fff', transition: 'border-color 0.2s' };
  const labelStyle = { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#555', fontSize: '14px' };

  if (loadingPerfil) return <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Cargando tu perfil...</div>;
  const perfil = dataPerfil?.obtenerPerfilUsuario || usuarioLogueado;
  const pedidos = dataPedidos?.obtenerPedidosCliente || [];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div>
        <button 
          onClick={onVolver} 
          style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '15px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Volver
        </button>
        
        <div style={{ background: 'white', borderRadius: '20px', padding: '2.5rem', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', border: '1px solid #eaeaea' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '2rem', borderBottom: '1px solid #f0f0f0', paddingBottom: '2rem' }}>
            <div style={{ width: '85px', height: '85px', flexShrink: 0, borderRadius: '50%', backgroundColor: '#fff5f2', color: '#ff4500', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', border: '2px solid #ff4500' }}>
              {perfil.nombre ? perfil.nombre.charAt(0).toUpperCase() : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              )}
            </div>
            <div>
              <h1 style={{ margin: '0 0 5px 0', color: '#1a1a1a', fontSize: '1.8rem', letterSpacing: '-0.5px' }}>{perfil.nombre}</h1>
              <span style={{ color: '#888', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}></span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
            
            <div>
              <label htmlFor="perfil-email" style={labelStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                Correo Electrónico
              </label>
              <input id="perfil-email" type="email" value={perfil.email} disabled style={{ ...inputStyle, backgroundColor: '#f9f9f9', color: '#888', cursor: 'not-allowed', borderColor: '#eee' }} />
            </div>

            <div>
              <label htmlFor="perfil-telefono" style={labelStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                Teléfono de Contacto
              </label>
              <input id="perfil-telefono" type="tel" value={telefono} disabled={guardando} onChange={(e) => { setTelefono(e.target.value); setMensajePerfil(null); }} style={inputStyle} onFocus={(e) => e.target.style.borderColor = '#ff4500'} onBlur={(e) => e.target.style.borderColor = '#e0e0e0'} />
            </div>

            <div style={{ position: 'relative' }}>
              <label htmlFor="perfil-direccion" style={labelStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                Dirección de Entrega Principal
              </label>
              <input id="perfil-direccion" type="text" value={direccion} disabled={guardando} onChange={(e) => manejarCambioDireccion(e.target.value)} style={inputStyle} onFocus={(e) => e.target.style.borderColor = '#ff4500'} onBlur={(e) => setTimeout(() => setSugerencias([]), 200)} />
              {sugerencias.length > 0 && (
                <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '12px', zIndex: 100, listStyle: 'none', padding: 0, margin: '5px 0 0 0', boxShadow: '0 8px 15px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  {sugerencias.map((sug, index) => (
                    <li key={index} onMouseDown={() => seleccionarDireccion(sug)} style={{ padding: '12px 15px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: '14px', color: '#333' }}>
                      <b>{sug.address?.road || sug.address?.pedestrian || sug.address?.suburb || 'Ubicación'} {sug.address?.house_number || ''}</b>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{sug.display_name}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button type="button" className="boton-con-estado" onClick={handleGuardarCambios} disabled={guardando} aria-busy={guardando} style={{ marginTop: '1rem', padding: '16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1, transition: 'background 0.2s' }}>
              {(guardando || mensajePerfil?.tipo === 'exito') && <IconoEstado tipo={guardando ? 'cargando' : 'exito'} tamano={22} />}
              {guardando ? 'Guardando...' : mensajePerfil?.tipo === 'exito' ? 'Cambios guardados' : 'Guardar Cambios'}
            </button>
            <MensajeAccion mensaje={mensajePerfil} onCerrar={() => setMensajePerfil(null)} />
          </div>
        </div>
      </div>

      {perfil.rol !== 'VENDEDOR' && (
        <div style={{ marginTop: '1rem' }}>
          <h2 style={{ color: '#1a1a1a', borderBottom: '2px solid #ff4500', paddingBottom: '10px', display: 'inline-block', fontSize: '1.5rem', marginBottom: '1.5rem' }}>Tus Pedidos Anteriores</h2>
          
          {loadingPedidos ? <p style={{ color: '#666' }}>Cargando tu historial...</p> : pedidos.length === 0 ? (
            <div style={{ background: '#fafafa', padding: '3rem', borderRadius: '16px', textAlign: 'center', color: '#666', border: '1px dashed #ccc' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px' }}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>Aún no has realizado ningún pedido.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pedidos.map(pedido => {
                const puedeRecomprar = pedido.restaurante_abierto && pedido.plato_disponible;
                let motivoBloqueo = "";
                if (!pedido.nombre_restaurante) motivoBloqueo = "Restaurante ya no existe";
                else if (!pedido.nombre_plato) motivoBloqueo = "Plato retirado";
                else if (!pedido.restaurante_abierto) motivoBloqueo = "Local cerrado";
                else if (!pedido.plato_disponible) motivoBloqueo = "Plato agotado";

                return (
                  <div 
                    key={pedido.id_pedido} 
                    onClick={() => onSelectPlato(pedido)} 
                    style={{ position: 'relative', background: 'white', border: '1px solid #eaeaea', borderRadius: '16px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = '#ff4500'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.02)'; e.currentTarget.style.borderColor = '#eaeaea'; }}
                  >
                    {/* ETIQUETA CON EL ID DEL PEDIDO */}
                    <span style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '11px', color: '#666', fontWeight: 'bold', background: '#f5f5f5', padding: '4px 10px', borderRadius: '8px' }}>
                      Pedido #{pedido.id_pedido}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '10px' }}>
                      {pedido.imagen_restaurante ? (
                        <img src={pedido.imagen_restaurante} alt={pedido.nombre_restaurante} style={{ width: '65px', height: '65px', borderRadius: '12px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '65px', height: '65px', borderRadius: '12px', backgroundColor: '#f0f0f0', color: '#999', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v2H3z"></path><path d="M4 11v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9"></path><path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"></path><path d="M12 11v10"></path></svg>
                        </div>
                      )}
                      
                      <div>
                        <h3 style={{ margin: '0 0 6px 0', color: '#1a1a1a', fontSize: '1.1rem' }}>{pedido.nombre_plato || 'Plato desconocido'}</h3>
                        <p style={{ margin: '0 0 4px 0', color: '#555', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <b>{pedido.nombre_restaurante || 'Desconocido'}</b>
                        </p>
                        <p style={{ margin: '0 0 6px 0', color: '#888', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          {formatearFecha(pedido.fecha_pedido)}
                        </p>
                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: pedido.estado === 'ENTREGADO' ? '#e8f5e9' : '#f5f5f5', color: pedido.estado === 'ENTREGADO' ? '#166534' : '#666' }}>
                          Estado: {pedido.estado}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', width: '200px', maxWidth: '100%', marginTop: '10px' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ff4500' }}>{pedido.precio_plato?.toFixed(2)}&nbsp;€</span>
                      {puedeRecomprar ? (
                        <BotonAgregarCarrito onAgregar={event => handleRecomprar(event, pedido)} idPlato={pedido.id_plato} nombrePlato={pedido.nombre_plato} variante="repetir" />
                      ) : (
                        <span style={{ fontSize: '12px', color: '#d63031', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', background: '#ffebee', padding: '6px 12px', borderRadius: '20px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                          {motivoBloqueo}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
