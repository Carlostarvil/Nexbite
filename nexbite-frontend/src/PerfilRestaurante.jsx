import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import BotonFavorito from './BotonFavorito'; 
import CarruselPlatos from './CarruselPlatos';

const OBTENER_DATOS = gql`
  query ObtenerDatosPerfil($id: ID!, $id_usuario: ID!) {
    obtenerRestaurantePorId(id_restaurante: $id) { 
      id_restaurante
      nombre
      tipo
      latitud
      longitud
      imagen_url
      aceptando_pedidos
      tiempo_reactivacion 
      radio_cobertura_km
      telefono
      direccion
    }
    obtenerMenuRestaurante(id_restaurante: $id) { id_plato, id_restaurante, nombre, descripcion, precio, categoria, imagen_url, disponible, tiempo_disponible }
    obtenerMasVendidos(id_restaurante: $id) { id_plato, id_restaurante, nombre, descripcion, precio, imagen_url, disponible }
    obtenerFavoritos(id_usuario: $id_usuario) { id_restaurante }
    obtenerPlatosFavoritos(id_usuario: $id_usuario) { id_plato }
  }
`;

const ALTERNAR_FAVORITO_PLATO = gql`
  mutation AlternarFavoritoPlato($id_plato: ID!) {
    alternarFavoritoPlato(id_plato: $id_plato)
  }
`;

const formatearFecha = (fechaStr) => {
  if (!fechaStr || String(fechaStr).includes('Indefinido')) return 'Sin estimación exacta';
  const timestamp = !isNaN(fechaStr) && String(fechaStr).trim() !== '' ? Number(fechaStr) : fechaStr;
  const fecha = new Date(timestamp);
  if (isNaN(fecha.getTime())) return String(fechaStr); 
  return fecha.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
};

// Componente para el Modal de Información del Restaurante
function InfoRestauranteModal({ restaurante, onClose }) {
  const [direccionTexto, setDireccionTexto] = useState('Buscando dirección exacta...');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    // Si la BD ya nos da una dirección de texto, la usamos
    if (restaurante?.direccion) {
      setDireccionTexto(restaurante.direccion);
    } 
    // Si es un restaurante antiguo sin dirección pero con coordenadas, calculamos la calle
    else if (restaurante?.latitud && restaurante?.longitud) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${restaurante.latitud}&lon=${restaurante.longitud}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
            const partes = data.display_name.split(', ');
            const direccionCorta = partes.slice(0, 3).join(', ');
            setDireccionTexto(direccionCorta);
          } else {
            setDireccionTexto('Dirección no encontrada');
          }
        })
        .catch(() => setDireccionTexto('Error al obtener la dirección'));
    } else {
      setDireccionTexto('Ubicación no especificada');
    }
  }, [restaurante]);

  const copiarAlPortapapeles = () => {
    navigator.clipboard.writeText(direccionTexto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (!restaurante) return null;

  let horario = "Cerrado temporalmente";
  let colorHorario = "#d63031";

  if (restaurante.aceptando_pedidos) {
    horario = "Abierto ahora";
    colorHorario = "#00cc66";
  } else if (restaurante.tiempo_reactivacion) {
    horario = `Vuelve a abrir: ${formatearFecha(restaurante.tiempo_reactivacion)}`;
  }

  const urlMapa = (restaurante.latitud && restaurante.longitud) 
    ? `https://static-maps.yandex.ru/1.x/?ll=${restaurante.longitud},${restaurante.latitud}&size=400,200&z=16&l=map&pt=${restaurante.longitud},${restaurante.latitud},pm2rdm` 
    : null;

  return (
    <div 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1rem' }}
      onClick={onClose} 
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
        >
          ❌
        </button>

        {urlMapa ? (
           <img src={urlMapa} alt="Ubicación en el mapa" style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
        ) : (
           <div style={{ width: '100%', height: '160px', backgroundColor: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>Mapa no disponible</div>
        )}

        <div style={{ padding: '2rem' }}>
          <h2 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '1.5rem' }}>{restaurante.nombre}</h2>
          <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '1rem' }}>{restaurante.tipo}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>📍</span>
              <div style={{ flexGrow: 1 }}>
                <p style={{ margin: 0, color: '#333', fontWeight: 'bold' }}>Dirección</p>
                <p style={{ margin: '3px 0 8px 0', color: '#666', fontSize: '14px', lineHeight: '1.4' }}>
                  {direccionTexto}
                </p>
                <button 
                  onClick={copiarAlPortapapeles}
                  style={{ background: copiado ? '#e8f5e9' : '#f5f5f5', color: copiado ? '#2e7d32' : '#333', border: '1px solid #ddd', padding: '5px 10px', borderRadius: '15px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                >
                  {copiado ? '✅ Copiado' : '📋 Copiar dirección'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>📞</span>
              <div>
                <p style={{ margin: 0, color: '#333', fontWeight: 'bold' }}>Teléfono de contacto</p>
                <p style={{ margin: '3px 0 0 0', color: '#0066cc', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {restaurante.telefono || "Teléfono no disponible"}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>🕒</span>
              <div>
                <p style={{ margin: 0, color: '#333', fontWeight: 'bold' }}>Horario de pedidos</p>
                <p style={{ margin: '3px 0 0 0', color: colorHorario, fontSize: '14px', fontWeight: 'bold' }}>{horario}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>🛵</span>
              <div>
                <p style={{ margin: 0, color: '#333', fontWeight: 'bold' }}>Cobertura de entrega</p>
                <p style={{ margin: '3px 0 0 0', color: '#666', fontSize: '14px' }}>
                  Aprox. {restaurante.radio_cobertura_km ? `${restaurante.radio_cobertura_km} km` : 'No definida'}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function PerfilRestaurante({ idRestaurante, onVolver, onAgregarAlCarrito, onSelectPlato }) {
  const usuarioLogueado = JSON.parse(localStorage.getItem('user')) || {};
  const idUsuarioActual = usuarioLogueado.id_usuario || "0"; 

  const { loading, error, data, refetch } = useQuery(OBTENER_DATOS, { 
    variables: { id: idRestaurante, id_usuario: idUsuarioActual },
    fetchPolicy: 'network-only' 
  });

  const [alternarFavoritoPlato] = useMutation(ALTERNAR_FAVORITO_PLATO);
  const [filtroActivo, setFiltroActivo] = useState('TODOS');
  const [busquedaPlato, setBusquedaPlato] = useState('');
  const [favoritosLocales, setFavoritosLocales] = useState([]);
  const [mostrarInfoModal, setMostrarInfoModal] = useState(false); 

  const restaurante = data?.obtenerRestaurantePorId;
  const menuCompleto = data?.obtenerMenuRestaurante || [];
  const platosPopulares = data?.obtenerMasVendidos || []; 
  const listaFavoritos = data?.obtenerFavoritos || [];
  const esFavoritoInicial = listaFavoritos.some(fav => fav.id_restaurante === idRestaurante);
  const platosFavoritos = data?.obtenerPlatosFavoritos || [];

  useEffect(() => {
    if (data) setFavoritosLocales(platosFavoritos.map(fav => String(fav.id_plato)));
  }, [data]);

  const menuFiltrado = menuCompleto.filter(plato => {
    const coincideCategoria = filtroActivo === 'TODOS' || (Array.isArray(plato.categoria) && plato.categoria.includes(filtroActivo));
    const terminoBusqueda = busquedaPlato.toLowerCase();
    const coincideTexto = terminoBusqueda === '' || plato.nombre.toLowerCase().includes(terminoBusqueda) || (plato.descripcion && plato.descripcion.toLowerCase().includes(terminoBusqueda));
    return coincideCategoria && coincideTexto;
  });

  const isPausado = restaurante?.aceptando_pedidos === false;

  const handleCorazonClick = async (idPlato) => {
    const idStr = String(idPlato);
    const eraFavorito = favoritosLocales.includes(idStr);
    if (eraFavorito) setFavoritosLocales(prev => prev.filter(id => id !== idStr));
    else setFavoritosLocales(prev => [...prev, idStr]);

    try {
      await alternarFavoritoPlato({ variables: { id_plato: idPlato } });
      refetch(); 
    } catch (e) {
      if (eraFavorito) setFavoritosLocales(prev => [...prev, idStr]);
      else setFavoritosLocales(prev => prev.filter(id => id !== idStr));
      alert(e.message.replace("GraphQL error: ", ""));
    }
  };

  const botonFiltroStyle = (categoria) => ({
    padding: '0.6rem 1.2rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
    backgroundColor: filtroActivo === categoria ? '#ff4500' : '#eee', color: filtroActivo === categoria ? 'white' : '#333', transition: 'all 0.2s ease'
  });

  if (loading) return <div style={{ padding: '2rem' }}>Cargando menú...</div>;
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error.message}</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '2rem', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', position: 'relative' }}>
        
        <div style={{ height: '200px', width: '100%', position: 'relative', backgroundColor: '#f5f5f5' }}>
           {restaurante?.imagen_url ? (
              <img src={restaurante.imagen_url} alt={restaurante.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
           ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>🏪</div>
           )}
           
           <button onClick={onVolver} style={{ position: 'absolute', top: '15px', left: '15px', width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
              ←
           </button>
           
           <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px' }}>
              <div style={{ background: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                 <BotonFavorito idRestaurante={idRestaurante} idUsuario={idUsuarioActual} esFavoritoInicial={esFavoritoInicial} />
              </div>
           </div>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '2rem', color: '#333' }}>{restaurante?.nombre}</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '1rem' }}>{restaurante?.tipo}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
             
             <div 
                onClick={() => setMostrarInfoModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8f9fa', padding: '10px 15px', borderRadius: '12px', cursor: 'pointer', border: '1px solid #eaeaea', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
             >
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontWeight: 'bold', fontSize: '12px' }}>i</div>
                <div>
                   <p style={{ margin: 0, color: '#333', fontWeight: 'bold', fontSize: '14px' }}>Información</p>
                   <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Horario, ubicación...</p>
                </div>
                <span style={{ color: '#aaa', marginLeft: '5px' }}>&gt;</span>
             </div>

             {!isPausado ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e8f5e9', color: '#2e7d32', padding: '10px 15px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px' }}>
                   <span>🟢</span> Abierto
                </div>
             ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffebee', color: '#c62828', padding: '10px 15px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px' }}>
                   <span>🔴</span> Vuelve a abrir: {formatearFecha(restaurante.tiempo_reactivacion)}
                </div>
             )}
          </div>
        </div>
      </div>

      {menuCompleto.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px' }}>
           <p style={{ color: '#666', fontSize: '1.2rem' }}>Este restaurante aún no ha añadido platos a su menú.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder={`🔍 Busca platos en ${restaurante?.nombre} (Ej. Pizza, salsa...)`}
              value={busquedaPlato}
              onChange={(e) => setBusquedaPlato(e.target.value)}
              style={{ width: '100%', padding: '15px 20px', fontSize: '1.05rem', borderRadius: '12px', border: '1px solid #ccc', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}
              onFocus={(e) => e.target.style.borderColor = '#ff4500'}
              onBlur={(e) => e.target.style.borderColor = '#ccc'}
            />
          </div>

          {busquedaPlato === '' && filtroActivo === 'TODOS' && platosPopulares.length > 0 && (
            <CarruselPlatos 
              titulo="Lo más pedido aquí" 
              platos={platosPopulares} 
              onSelectPlato={onSelectPlato} 
              onAgregarAlCarrito={onAgregarAlCarrito} 
            />
          )}

          <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <button onClick={() => setFiltroActivo('TODOS')} style={botonFiltroStyle('TODOS')}>Todos</button>
            <button onClick={() => setFiltroActivo('ENTRANTE')} style={botonFiltroStyle('ENTRANTE')}>Entrantes</button>
            <button onClick={() => setFiltroActivo('COMPARTIR')} style={botonFiltroStyle('COMPARTIR')}>Compartir</button>
            <button onClick={() => setFiltroActivo('PLATO')} style={botonFiltroStyle('PLATO')}>Principales</button>
            <button onClick={() => setFiltroActivo('BEBIDA')} style={botonFiltroStyle('BEBIDA')}>Bebidas</button>
            <button onClick={() => setFiltroActivo('POSTRE')} style={botonFiltroStyle('POSTRE')}>Postres</button>
            <button onClick={() => setFiltroActivo('MENU')} style={botonFiltroStyle('MENU')}>Menús</button>
          </div>

          {menuFiltrado.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}><p>No se encontraron platos. 😥</p></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {menuFiltrado.map((plato) => {
                const esPlatoFavorito = favoritosLocales.includes(String(plato.id_plato));
                
                return (
                <div 
                  key={plato.id_plato} 
                  onClick={() => onSelectPlato && onSelectPlato(plato)}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  style={{ border: '1px solid #e0e0e0', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fff', opacity: (isPausado || plato.disponible === false) ? 0.7 : 1, cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  {plato.imagen_url ? <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '200px', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '200px', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>📷</div>}

                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {Array.isArray(plato.categoria) && plato.categoria.map(cat => <span key={cat} style={{ fontSize: '11px', background: '#ffe4cc', color: '#ff4500', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{cat}</span>)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ margin: '0 0 10px 0', flexGrow: 1 }}>{plato.nombre}</h3>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCorazonClick(plato.id_plato); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', padding: '0 0 0 10px', transition: 'transform 0.2s ease', transform: esPlatoFavorito ? 'scale(1.2)' : 'scale(1)' }}
                        >
                          {esPlatoFavorito ? '❤️' : '🤍'}
                        </button>
                      </div>
                      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0' }}>{plato.descripcion}</p>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#0066cc' }}>€{plato.precio.toFixed(2)}</span>
                      
                      {isPausado || plato.disponible === false ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                          <span style={{ color: '#d63031', fontWeight: 'bold', fontSize: '0.85rem' }}>{plato.disponible === false ? '❌ Agotado' : '🔴 Pausado'}</span>
                          <button onClick={(e) => { e.stopPropagation(); onAgregarAlCarrito(plato); }} style={{ padding: '0.6rem 1.2rem', background: '#ffc107', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
                            🛒 Reserva
                          </button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); onAgregarAlCarrito(plato); }} style={{ padding: '0.6rem 1.2rem', background: '#ff4500', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                          Añadir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </>
      )}

      {/* Modal de Info */}
      {mostrarInfoModal && (
        <InfoRestauranteModal 
          restaurante={restaurante} 
          onClose={() => setMostrarInfoModal(false)} 
        />
      )}
    </div>
  );
}