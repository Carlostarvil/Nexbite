import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import Auth from './Auth'; 
import Header from './Header'; 
import MapView from './MapView'; 
import RegistroRestaurante from './RegistroRestaurante';
import PerfilRestaurante from './PerfilRestaurante';
import Carrito from './Carrito';
import MisFavoritos from './MisFavoritos';
import MisLocales from './MisLocales'; 
import GestorMenu from './GestorMenu'; 
import GestorPedidos from './GestorPedidos'; 
import ErrorBoundary from './ErrorBoundary'; 
import Buscador from './Buscador'; 
import DetallePlato from './DetallePlato'; 
import PerfilUsuario from './PerfilUsuario';
import CarruselPlatos from './CarruselPlatos';

const OBTENER_DATOS_INICIO = gql`
  query ObtenerDatosInicio($id_usuario: ID!) {
    obtenerMejoresRestaurantes { id_restaurante, nombre, tipo, imagen_url }
    obtenerFavoritos(id_usuario: $id_usuario) { id_restaurante, nombre, tipo, imagen_url }
    obtenerPlatosDestacados { id_plato, id_restaurante, nombre, descripcion, precio, imagen_url, nombre_restaurante }
    obtenerUltimosPedidos(id_usuario: $id_usuario) {
      id_pedido, id_restaurante, id_plato, nombre_plato, precio_plato
      estado, nombre_restaurante, imagen_restaurante, plato_disponible, restaurante_abierto
      fecha_pedido, descripcion_plato, imagen_plato
    }
  }
`;

const obtenerDatosDesdeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    return { id_usuario: JSON.parse(atob(payload)).id_usuario, rol: JSON.parse(atob(payload)).rol };
  } catch (e) { return null; }
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userRol, setUserRol] = useState(null);
  
  const [restauranteActivo, setRestauranteActivo] = useState(null);
  const [platoActivo, setPlatoActivo] = useState(null); 
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  
  const [carrito, setCarrito] = useState([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false); 

  const [vistaVendedor, setVistaVendedor] = useState('MIS_LOCALES'); 
  const [localSeleccionado, setLocalSeleccionado] = useState(null); 

  const repetimosRef = useRef(null);

  // NUEVO: Ahora el carrito detecta si el plato ya existe y suma +1 a la cantidad en lugar de duplicarlo
  const agregarAlCarrito = (plato) => {
    const idRestauranteDelPlato = plato.id_restaurante || restauranteActivo;
    
    setCarrito(prevCarrito => {
      const index = prevCarrito.findIndex(p => String(p.id_plato) === String(plato.id_plato));
      if (index !== -1) {
        const nuevoCarrito = [...prevCarrito];
        nuevoCarrito[index] = { ...nuevoCarrito[index], cantidad: (nuevoCarrito[index].cantidad || 1) + 1 };
        return nuevoCarrito;
      } else {
        return [...prevCarrito, { ...plato, id_restaurante: idRestauranteDelPlato, cantidad: 1 }];
      }
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('resetToken');
    if (resetToken) {
      localStorage.removeItem('nexbite_token');
      localStorage.removeItem('user');
      setIsLoggedIn(false);
      return; 
    }
    const token = localStorage.getItem('nexbite_token');
    if (token) {
      const datos = obtenerDatosDesdeToken(token);
      if (datos) { setIsLoggedIn(true); setUserId(datos.id_usuario); setUserRol(datos.rol); }
    }
  }, []);

  const { loading, error, data } = useQuery(OBTENER_DATOS_INICIO, {
    variables: { id_usuario: userId }, skip: !isLoggedIn || !userId || userRol === 'VENDEDOR',
    fetchPolicy: 'network-only' 
  });

  const handleCerrarSesion = () => {
    localStorage.removeItem('nexbite_token');
    localStorage.removeItem('user');
    window.location.href = '/'; 
  };

  const handleInicio = () => {
    setRestauranteActivo(null); setPlatoActivo(null); setMostrarCarrito(false);
    setMostrarFavoritos(false); setMostrarPerfil(false); setVistaVendedor('MIS_LOCALES'); 
  };

  const handleRecomprarRapido = (e, pedido) => {
    e.stopPropagation();
    agregarAlCarrito({ id_plato: pedido.id_plato, id_restaurante: pedido.id_restaurante, nombre: pedido.nombre_plato, precio: pedido.precio_plato });
  };

  const abrirDetalleDesdePedido = (pedido) => {
    setMostrarPerfil(false);
    setRestauranteActivo(null);
    setPlatoActivo({
      id_plato: pedido.id_plato, id_restaurante: pedido.id_restaurante,
      nombre: pedido.nombre_plato, precio: pedido.precio_plato,
      descripcion: pedido.descripcion_plato, imagen_url: pedido.imagen_plato
    });
  };

  const scrollRepetimos = (desplazamiento) => {
    if (repetimosRef.current) {
      repetimosRef.current.scrollBy({ left: desplazamiento, behavior: 'smooth' });
    }
  };

  if (!isLoggedIn) {
    return <Auth onLogin={() => {
      const token = localStorage.getItem('nexbite_token');
      const datos = obtenerDatosDesdeToken(token);
      setUserId(datos?.id_usuario); setUserRol(datos?.rol); setIsLoggedIn(true);
    }} />;
  }

  // Calculamos el número de artículos reales sumando las cantidades
  const totalArticulos = carrito.reduce((acc, p) => acc + (p.cantidad || 1), 0);

  return (
    <ErrorBoundary>
      <div style={{ fontFamily: 'system-ui', margin: 0, padding: 0, minHeight: '100vh', backgroundColor: '#f8f9fa', position: 'relative' }}>
        <Header 
          onInicio={handleInicio} onLogout={handleCerrarSesion} 
          cantidadCarrito={totalArticulos} 
          onAbrirCarrito={() => { setMostrarCarrito(true); setMostrarFavoritos(false); setRestauranteActivo(null); setPlatoActivo(null); setMostrarPerfil(false); }} 
          onAbrirFavoritos={() => { setMostrarFavoritos(true); setMostrarCarrito(false); setRestauranteActivo(null); setPlatoActivo(null); setMostrarPerfil(false); }}
          onSelectRestaurante={(id) => { setRestauranteActivo(id); setMostrarCarrito(false); setMostrarFavoritos(false); setPlatoActivo(null); setMostrarPerfil(false); }} 
          onAbrirPerfil={() => { setMostrarPerfil(true); setMostrarCarrito(false); setMostrarFavoritos(false); setRestauranteActivo(null); setPlatoActivo(null); }}
          userRol={userRol}
        />

        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          
          {mostrarPerfil ? (
            <PerfilUsuario onVolver={() => setMostrarPerfil(false)} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={abrirDetalleDesdePedido} />
          
          ) : userRol === 'VENDEDOR' ? (
            vistaVendedor === 'REGISTRAR' ? <RegistroRestaurante />
            : vistaVendedor === 'GESTOR_MENU' ? <GestorMenu idRestaurante={localSeleccionado.id_restaurante} nombreRestaurante={localSeleccionado.nombre} />
            : vistaVendedor === 'GESTOR_PEDIDOS' ? <GestorPedidos idRestaurante={localSeleccionado.id_restaurante} nombreRestaurante={localSeleccionado.nombre} estadoPausa={localSeleccionado.aceptando_pedidos} />
            : <MisLocales onCrearNuevo={() => setVistaVendedor('REGISTRAR')} onGestionarMenu={(local) => { setLocalSeleccionado(local); setVistaVendedor('GESTOR_MENU'); }} onGestionarPedidos={(local) => { setLocalSeleccionado(local); setVistaVendedor('GESTOR_PEDIDOS'); }} />
          ) : (
            
            mostrarCarrito ? (
              <Carrito carrito={carrito} setCarrito={setCarrito} onVolver={() => setMostrarCarrito(false)} vaciarCarrito={() => setCarrito([])} idUsuario={userId} />
            ) : mostrarFavoritos ? (
              <MisFavoritos idUsuario={userId} onVolver={() => setMostrarFavoritos(false)} onSelectRestaurante={(id) => { setRestauranteActivo(id); setMostrarFavoritos(false); }} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={setPlatoActivo} />
            
            ) : restauranteActivo ? (
              <PerfilRestaurante idRestaurante={restauranteActivo} idUsuario={userId} onVolver={() => setRestauranteActivo(null)} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={setPlatoActivo} />
            ) : (
              <>
                <h2 style={{ color: '#333' }}>¿Qué te apetece hoy? 🔍</h2>
                <Buscador onSelectRestaurante={setRestauranteActivo} onSelectPlato={setPlatoActivo} />

                <CarruselPlatos 
                  titulo="Platos Destacados" 
                  platos={data?.obtenerPlatosDestacados} 
                  onSelectPlato={setPlatoActivo} 
                  onAgregarAlCarrito={agregarAlCarrito} 
                />

                {data?.obtenerUltimosPedidos && data.obtenerUltimosPedidos.length > 0 && (
                  <div style={{ marginTop: '1rem', marginBottom: '3rem', position: 'relative' }}>
                    <style>
                      {`
                        .ocultar-scrollbar::-webkit-scrollbar { display: none; }
                        .ocultar-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                      `}
                    </style>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ff4500', paddingBottom: '10px', marginBottom: '1.5rem' }}>
                      <h2 style={{ margin: 0, color: '#333' }}>🔄 ¿Repetimos?</h2>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={() => scrollRepetimos(-300)} 
                            style={{ width: '35px', height: '35px', borderRadius: '50%', border: '1px solid #ccc', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', transition: 'background 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            ←
                          </button>
                          <button 
                            onClick={() => scrollRepetimos(300)} 
                            style={{ width: '35px', height: '35px', borderRadius: '50%', border: '1px solid #ccc', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', transition: 'background 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            →
                          </button>
                        </div>
                        <button onClick={() => setMostrarPerfil(true)} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', fontWeight: 'bold' }}>Ver historial completo &rarr;</button>
                      </div>
                    </div>
                    
                    <div ref={repetimosRef} className="ocultar-scrollbar" style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px', scrollBehavior: 'smooth' }}>
                      {data.obtenerUltimosPedidos.map(pedido => {
                        const puedeRecomprar = pedido.restaurante_abierto && pedido.plato_disponible;
                        
                        return (
                          <div 
                            key={`reciente-${pedido.id_pedido}`} 
                            onClick={() => abrirDetalleDesdePedido(pedido)}
                            style={{ minWidth: '280px', maxWidth: '300px', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', padding: '1.2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; }}
                          >
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                              {pedido.imagen_restaurante ? (
                                <img src={pedido.imagen_restaurante} alt={pedido.nombre_restaurante} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '50px', height: '50px', borderRadius: '8px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🏪</div>
                              )}
                              <div>
                                <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '15px' }}>{pedido.nombre_plato || 'Plato retirado'}</h4>
                                <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>{pedido.nombre_restaurante || 'Restaurante cerrado'}</p>
                              </div>
                            </div>
                            
                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 'bold', color: '#0066cc' }}>€{pedido.precio_plato?.toFixed(2)}</span>
                              {puedeRecomprar ? (
                                <button 
                                  onClick={(e) => handleRecomprarRapido(e, pedido)}
                                  style={{ padding: '6px 12px', background: '#00cc66', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  + Añadir
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#dc3545', fontWeight: 'bold' }}>No disponible</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <h2 style={{ color: '#333' }}>Descubre qué hay cerca de ti 📍</h2>
                <MapView onSelectRestaurante={setRestauranteActivo} />
                
                {loading && <p style={{ marginTop: '2rem' }}>Cargando datos de la plataforma...</p>}
                {error && <p style={{ marginTop: '2rem', color: 'red' }}>Error: {error.message}</p>}
                
                <h2 style={{ color: '#333', marginTop: '3rem' }}>🏆 Los Mejores Restaurantes (Global)</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                  {data?.obtenerMejoresRestaurantes.map((restaurante) => (
                    <div key={restaurante.id_restaurante} onClick={() => setRestauranteActivo(restaurante.id_restaurante)} style={{ backgroundColor: '#fff', border: '1px solid #eaeaea', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}>
                      {restaurante.imagen_url ? (
                          <img src={restaurante.imagen_url} alt={restaurante.nombre} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px 8px 0 0', marginBottom: '10px' }} />
                      ) : (
                          <div style={{ width: '100%', height: '140px', backgroundColor: '#eee', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', fontSize: '2rem' }}>🏪</div>
                      )}
                      <h3 style={{ margin: '0 0 10px 0' }}>{restaurante.nombre}</h3>
                      <span style={{ background: '#ffe4cc', color: '#ff4500', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{restaurante.tipo}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          )}
        </main>

        {platoActivo && (
          <DetallePlato 
            plato={platoActivo} 
            onVolver={() => setPlatoActivo(null)} 
            onAgregarAlCarrito={agregarAlCarrito} 
            onIrARestaurante={(idRestaurante) => {
              setRestauranteActivo(idRestaurante);
              setPlatoActivo(null); 
              setMostrarPerfil(false); 
              setMostrarFavoritos(false); 
              setMostrarCarrito(false);
              window.scrollTo(0, 0); 
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;