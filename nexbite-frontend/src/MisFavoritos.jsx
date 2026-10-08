import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import BotonAgregarCarrito from './BotonAgregarCarrito';
import BotonCorazon from './BotonCorazon';

const OBTENER_FAVORITOS_GENERALES = gql`
  query ObtenerFavoritosGenerales($id_usuario: ID!, $latitud: Float!, $longitud: Float!, $solo_con_entrega: Boolean!) {
    obtenerFavoritos(id_usuario: $id_usuario, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) {
      id_restaurante
      nombre
      tipo
      imagen_url
    }
    obtenerPlatosFavoritos(id_usuario: $id_usuario, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) {
      id_plato
      id_restaurante 
      nombre
      descripcion
      precio
      imagen_url
      categoria
      disponible
      tiempo_disponible
    }
  }
`;

const ALTERNAR_FAVORITO = gql`
  mutation AlternarFavorito($id_restaurante: ID!) {
    alternarFavorito(id_restaurante: $id_restaurante)
  }
`;

const ALTERNAR_FAVORITO_PLATO = gql`
  mutation AlternarFavoritoPlato($id_plato: ID!) {
    alternarFavoritoPlato(id_plato: $id_plato)
  }
`;

export default function MisFavoritos({ idUsuario, onSelectRestaurante, onVolver, onAgregarAlCarrito, onSelectPlato, ubicacionEntrega, modoEntrega }) {
  const [pestañaActiva, setPestañaActiva] = useState('RESTAURANTES'); 

  const { loading, error, data, refetch } = useQuery(OBTENER_FAVORITOS_GENERALES, {
    variables: { id_usuario: idUsuario, latitud: ubicacionEntrega?.lat, longitud: ubicacionEntrega?.lng, solo_con_entrega: modoEntrega === 'DOMICILIO' },
    skip: !ubicacionEntrega,
    fetchPolicy: 'network-only' 
  });

  const [quitarFavoritoRestaurante] = useMutation(ALTERNAR_FAVORITO);
  const [quitarFavoritoPlato] = useMutation(ALTERNAR_FAVORITO_PLATO);

  const handleEliminarRestaurante = async (id_restaurante, e) => {
    e.stopPropagation(); // Evitar que haga clic en la tarjeta
    await quitarFavoritoRestaurante({ variables: { id_restaurante } });
    refetch(); 
  };

  const handleEliminarPlato = async (id_plato, e) => {
    e?.stopPropagation();
    await quitarFavoritoPlato({ variables: { id_plato } });
    refetch(); 
  };

  const handleAgregarAlCarrito = (plato) => {
    if (typeof onAgregarAlCarrito === 'function') {
      return onAgregarAlCarrito(plato);
    } else {
      alert("⚠️ Error: La función del carrito no está conectada correctamente en App.jsx.");
      return false;
    }
  };

  if (loading && !data) return <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>Cargando tus favoritos...</div>;
  if (error && !data) return <div style={{ padding: '3rem', textAlign: 'center', color: '#d63031' }}>Error al cargar. Inténtalo de nuevo.</div>;

  const restaurantes = data.obtenerFavoritos || [];
  const platos = data.obtenerPlatosFavoritos || [];

  return (
    <div style={{ padding: '1rem 0', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* BOTÓN VOLVER Y TÍTULO */}
      <div style={{ marginBottom: '2rem' }}>
        <button 
          onClick={onVolver} 
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '1rem', fontSize: '15px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 0, transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Volver
        </button>
        
        <h2 style={{ fontSize: '2rem', color: '#1a1a1a', margin: '0 0 1.5rem 0', letterSpacing: '-0.5px' }}>Mis Favoritos</h2>
        
        {/* PESTAÑAS (TABS) MODERNAS */}
        <div style={{ display: 'flex', gap: '20px', borderBottom: '2px solid #eaeaea', paddingBottom: '0' }}>
          <button 
            onClick={() => setPestañaActiva('RESTAURANTES')} 
            style={{
              background: 'none', border: 'none', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', padding: '0 0 12px 0', marginBottom: '-2px', transition: 'color 0.2s ease',
              color: pestañaActiva === 'RESTAURANTES' ? '#ff4500' : '#888',
              borderBottom: pestañaActiva === 'RESTAURANTES' ? '3px solid #ff4500' : '3px solid transparent'
            }}
          >
            Restaurantes ({restaurantes.length})
          </button>
          <button 
            onClick={() => setPestañaActiva('PLATOS')} 
            style={{
              background: 'none', border: 'none', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', padding: '0 0 12px 0', marginBottom: '-2px', transition: 'color 0.2s ease',
              color: pestañaActiva === 'PLATOS' ? '#ff4500' : '#888',
              borderBottom: pestañaActiva === 'PLATOS' ? '3px solid #ff4500' : '3px solid transparent'
            }}
          >
            Platos ({platos.length})
          </button>
        </div>
      </div>

      {/* CONTENIDO PESTAÑA RESTAURANTES */}
      {pestañaActiva === 'RESTAURANTES' && (
        <>
          {restaurantes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fafafa', borderRadius: '16px', border: '1px dashed #ccc' }}>
              <div style={{ width: '64px', height: '64px', margin: '0 auto 15px', backgroundColor: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              </div>
              <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Aún no tienes locales favoritos</h3>
              <p style={{ color: '#666', margin: 0 }}>Pulsa el icono del corazón en tus restaurantes preferidos para guardarlos aquí.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {restaurantes.map(restaurante => (
                <div 
                  key={restaurante.id_restaurante} 
                  onClick={() => onSelectRestaurante(restaurante.id_restaurante)}
                  style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', border: '1px solid #eaeaea', borderRadius: '16px', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#ff4500'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)'; e.currentTarget.style.borderColor = '#eaeaea'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    {restaurante.imagen_url ? (
                        <img src={restaurante.imagen_url} alt={restaurante.nombre} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '12px' }} />
                    ) : (
                        <div style={{ width: '70px', height: '70px', backgroundColor: '#f5f5f5', color: '#999', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v2H3z"></path><path d="M4 11v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9"></path><path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"></path><path d="M12 11v10"></path></svg>
                        </div>
                    )}
                    
                    <div>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', color: '#1a1a1a' }}>{restaurante.nombre}</h3>
                      <span style={{ fontSize: '11px', background: '#f5f5f5', color: '#555', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {restaurante.tipo || 'Restaurante'}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onSelectRestaurante(restaurante.id_restaurante); }}
                      style={{ flex: 1, padding: '12px', background: '#ff4500', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#e63e00'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ff4500'}
                    >
                      Ir al menú
                    </button>
                    
                    {/* PAPELERA SVG MODERNA */}
                    <button 
                      onClick={(e) => handleEliminarRestaurante(restaurante.id_restaurante, e)}
                      style={{ width: '42px', height: '42px', background: '#fff0f0', color: '#dc3545', border: '1px solid #ffcdd2', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', padding: 0 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#ffebee'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff0f0'; e.currentTarget.style.transform = 'scale(1)'; }}
                      title="Eliminar de favoritos"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* CONTENIDO PESTAÑA PLATOS */}
      {pestañaActiva === 'PLATOS' && (
        <>
          {platos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fafafa', borderRadius: '16px', border: '1px dashed #ccc' }}>
              <div style={{ width: '64px', height: '64px', margin: '0 auto 15px', backgroundColor: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              </div>
              <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>No has guardado ningún plato</h3>
              <p style={{ color: '#666', margin: 0 }}>Entra en los menús de los restaurantes y pulsa el corazón para guardar tus platos preferidos aquí.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {platos.map(plato => (
                <div 
                  key={plato.id_plato} 
                  className="tarjeta-plato"
                  onClick={() => onSelectPlato && onSelectPlato(plato)} 
                  style={{ position: 'relative', border: '1px solid #eaeaea', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fff', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#ff4500'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.03)'; e.currentTarget.style.borderColor = '#eaeaea'; }}
                >
                  <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}>
                    <BotonCorazon activo onClick={(e) => handleEliminarPlato(plato.id_plato, e)} nombre={plato.nombre} />
                  </div>
                  
                  {plato.imagen_url ? (
                    <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '160px', objectFit: 'cover', imageRendering: '-webkit-optimize-contrast' }} />
                  ) : (
                    <div style={{ width: '100%', height: '160px', backgroundColor: '#fcfcfc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>
                    </div>
                  )}

                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#1a1a1a', lineHeight: '1.3' }}>{plato.nombre}</h3>
                    <p style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0', flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {plato.descripcion || 'Sin descripción disponible.'}
                    </p>
                    
                    <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#000', marginBottom: '15px' }}>{plato.precio.toFixed(2)}&nbsp;€</span>

                    <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                      
                      <BotonAgregarCarrito onAgregar={() => handleAgregarAlCarrito(plato)} idPlato={plato.id_plato} nombrePlato={plato.nombre} />
                      
                      {/* BOTÓN VER LOCAL SVG */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSelectRestaurante(plato.id_restaurante); }}
                        style={{ padding: '12px', background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', fontSize: '14px' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v2H3z"></path><path d="M4 11v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9"></path><path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"></path><path d="M12 11v10"></path></svg>
                        Ver menú del local
                      </button>
                      
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );
}