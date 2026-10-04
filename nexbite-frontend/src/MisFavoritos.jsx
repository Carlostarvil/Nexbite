import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

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

// MODIFICADO: Añadido onSelectPlato a los parámetros
export default function MisFavoritos({ idUsuario, onSelectRestaurante, onVolver, onAgregarAlCarrito, onSelectPlato, ubicacionEntrega, modoEntrega }) {
  const [pestañaActiva, setPestañaActiva] = useState('RESTAURANTES'); 

  const { loading, error, data, refetch } = useQuery(OBTENER_FAVORITOS_GENERALES, {
    variables: { id_usuario: idUsuario, latitud: ubicacionEntrega?.lat, longitud: ubicacionEntrega?.lng, solo_con_entrega: modoEntrega === 'DOMICILIO' },
    skip: !ubicacionEntrega,
    fetchPolicy: 'network-only' 
  });

  const [quitarFavoritoRestaurante] = useMutation(ALTERNAR_FAVORITO);
  const [quitarFavoritoPlato] = useMutation(ALTERNAR_FAVORITO_PLATO);

  const handleEliminarRestaurante = async (id_restaurante) => {
    await quitarFavoritoRestaurante({ variables: { id_restaurante } });
    refetch(); 
  };

  const handleEliminarPlato = async (id_plato) => {
    await quitarFavoritoPlato({ variables: { id_plato } });
    refetch(); 
  };

  const handleAgregarAlCarrito = (plato) => {
    if (typeof onAgregarAlCarrito === 'function') {
      onAgregarAlCarrito(plato);
    } else {
      alert("⚠️ Error: La función del carrito no está conectada correctamente en App.jsx.");
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Cargando tus favoritos...</div>;
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error al cargar.</div>;

  const restaurantes = data.obtenerFavoritos || [];
  const platos = data.obtenerPlatosFavoritos || [];

  const pestañaStyle = (activa) => ({
    padding: '0.8rem 1.5rem',
    border: 'none',
    borderBottom: activa ? '3px solid #ff4500' : '3px solid transparent',
    background: 'transparent',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    cursor: 'pointer',
    color: activa ? '#ff4500' : '#666',
    transition: 'all 0.2s ease'
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={onVolver} style={{ padding: '0.5rem 1rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '2rem', fontWeight: 'bold' }}>← Volver</button>
      
      <h2 style={{ color: '#ff4500', marginBottom: '1rem' }}>❤️ Mis Favoritos</h2>

      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '2rem' }}>
        <button onClick={() => setPestañaActiva('RESTAURANTES')} style={pestañaStyle(pestañaActiva === 'RESTAURANTES')}>
          🏪 Restaurantes ({restaurantes.length})
        </button>
        <button onClick={() => setPestañaActiva('PLATOS')} style={pestañaStyle(pestañaActiva === 'PLATOS')}>
          🍽️ Platos ({platos.length})
        </button>
      </div>

      {pestañaActiva === 'RESTAURANTES' && (
        <>
          {restaurantes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '12px' }}>
              <h3>No hay restaurantes favoritos disponibles aquí</h3>
              <p style={{ color: '#666' }}>Tus favoritos siguen guardados. Puedes cambiar la ubicación o elegir recogida para ver otros locales.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {restaurantes.map(restaurante => (
                <div key={restaurante.id_restaurante} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid #eee', borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {restaurante.imagen_url ? (
                        <img src={restaurante.imagen_url} alt={restaurante.nombre} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                    ) : (
                        <div style={{ width: '80px', height: '80px', backgroundColor: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🏪</div>
                    )}
                    
                    <div>
                      <h3 style={{ margin: '0 0 8px 0' }}>{restaurante.nombre}</h3>
                      <span style={{ fontSize: '12px', background: '#ffe4cc', color: '#ff4500', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                        {restaurante.tipo}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                      onClick={() => onSelectRestaurante(restaurante.id_restaurante)}
                      style={{ padding: '0.6rem 1.2rem', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Ir al menú 🍽️
                    </button>
                    
                    <button 
                      onClick={() => handleEliminarRestaurante(restaurante.id_restaurante)}
                      style={{ padding: '0.6rem', background: '#ff7675', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1.2rem' }}
                      title="Eliminar de favoritos"
                    >
                      🗑️
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </>
      )}

      {pestañaActiva === 'PLATOS' && (
        <>
          {platos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '12px' }}>
              <h3>No hay platos favoritos disponibles aquí</h3>
              <p style={{ color: '#666' }}>Entra en los menús de los restaurantes y marca el 🤍 para guardar tus platos preferidos aquí.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {platos.map(plato => (
                <div 
                  key={plato.id_plato} 
                  onClick={() => onSelectPlato && onSelectPlato(plato)} // MODIFICADO: Abrir el plato
                  style={{ border: '1px solid #e0e0e0', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fff', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {plato.imagen_url ? (
                    <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '150px', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>📷</div>
                  )}

                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>{plato.nombre}</h3>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEliminarPlato(plato.id_plato); }} // Detener propagación
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', padding: '0 0 0 10px' }}
                        title="Quitar de favoritos"
                      >
                        ❤️
                      </button>
                    </div>
                    <p style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0', flexGrow: 1 }}>{plato.descripcion}</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#0066cc' }}>€{plato.precio.toFixed(2)}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSelectRestaurante(plato.id_restaurante); }} // Detener propagación
                        style={{ padding: '0.8rem', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}
                      >
                        🏪 Ver local
                      </button>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAgregarAlCarrito(plato); }} // Detener propagación
                        style={{ padding: '0.8rem', background: '#ff4500', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}
                      >
                        🛒 Añadir
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
