import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import Auth from './Auth'; 
import Header from './Header'; 
import Footer from './Footer';
import MapView from './MapView'; 
import RegistroRestaurante from './RegistroRestaurante';
import PerfilRestaurante from './PerfilRestaurante';
import Carrito from './Carrito';
import MisFavoritos from './MisFavoritos';
import MisLocales from './MisLocales'; 
import GestorMenu from './GestorMenu'; 
import GestorPedidos from './GestorPedidos'; 
import ErrorBoundary from './ErrorBoundary'; 
import DetallePlato from './DetallePlato'; 
import PerfilUsuario from './PerfilUsuario';
import CarruselPlatos from './CarruselPlatos';
import TituloSeccion, { ControlesCarrusel } from './TituloSeccion';
import BotonAgregarCarrito from './BotonAgregarCarrito';
import AvisoCarrito from './AvisoCarrito';
import ConfirmacionPedido from './ConfirmacionPedido';
import { EstadoCarritoContext } from './estadoCarrito';
import SelectorUbicacion from './SelectorUbicacion';
import { leerUbicacionEntrega, guardarUbicacionEntrega } from './ubicacionEntrega';

const OBTENER_DATOS_INICIO = gql`
  query ObtenerDatosInicio($id_usuario: ID!, $latitud: Float!, $longitud: Float!, $solo_con_entrega: Boolean!) {
    obtenerMejoresRestaurantes(latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_restaurante, nombre, tipo, imagen_url }
    obtenerFavoritos(id_usuario: $id_usuario, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_restaurante, nombre, tipo, imagen_url }
    obtenerPlatosDestacados(latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_plato, id_restaurante, nombre, descripcion, precio, imagen_url, nombre_restaurante, categoria }
    obtenerUltimosPedidos(id_usuario: $id_usuario, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) {
      id_pedido, id_restaurante, id_plato, nombre_plato, precio_plato
      estado, nombre_restaurante, imagen_restaurante, plato_disponible, restaurante_abierto
      fecha_pedido, descripcion_plato, imagen_plato
    }
    obtenerPlatosFavoritos(id_usuario: $id_usuario, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_plato }
  }
`;

// Burbujas de categorías para la portada (Estilo Uber Eats)
const CATEGORIAS_PORTADA = [
  { id: 'Hamburguesas', emoji: '🍔' },
  { id: 'Pizza', emoji: '🍕' },
  { id: 'Desayuno', emoji: '☕' },
  { id: 'Asiática', emoji: '🍣' },
  { id: 'Sana', emoji: '🥗' },
  { id: 'Americana', emoji: '🌭' },
  { id: 'Postres', emoji: '🍰' },
  { id: 'Sándwiches', emoji: '🥪' },
  { id: 'Mexicana', emoji: '🌮' },
  { id: 'Pollo', emoji: '🍗' }
];

const obtenerDatosDesdeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    return { id_usuario: JSON.parse(atob(payload)).id_usuario, rol: JSON.parse(atob(payload)).rol };
  } catch (e) { return null; }
};

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

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userRol, setUserRol] = useState(null);
  const [ubicacionEntrega, setUbicacionEntrega] = useState(() => {
    const datos = obtenerDatosDesdeToken(localStorage.getItem('nexbite_token') || '');
    return leerUbicacionEntrega(datos?.id_usuario);
  });
  const [mostrarSelectorUbicacion, setMostrarSelectorUbicacion] = useState(false);
  const [modoEntrega, setModoEntrega] = useState('DOMICILIO');
  
  const [restauranteActivo, setRestauranteActivo] = useState(null);
  const [platoActivo, setPlatoActivo] = useState(null); 
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  
  const [carrito, setCarrito] = useState([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [confirmacionPedido, setConfirmacionPedido] = useState(null);
  const [avisoCarrito, setAvisoCarrito] = useState(null);
  const [destinoCarrito, setDestinoCarrito] = useState({ irAPago: false, idRestaurante: null });
  const numeroAviso = useRef(0);
  const cerrarAvisoCarrito = useCallback(() => setAvisoCarrito(null), []);
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false); 

  const [vistaVendedor, setVistaVendedor] = useState('MIS_LOCALES'); 
  const [localSeleccionado, setLocalSeleccionado] = useState(null); 
  
  const [categoriaFiltroInicio, setCategoriaFiltroInicio] = useState(null);

  const repetimosRef = useRef(null);

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
    numeroAviso.current += 1;
    setAvisoCarrito({ ...plato, id_restaurante: idRestauranteDelPlato, id: numeroAviso.current });
  };

  const restarDelCarrito = useCallback(idPlato => {
    setCarrito(anterior => anterior.flatMap(plato => {
      if (String(plato.id_plato) !== String(idPlato)) return [plato];
      const cantidad = plato.cantidad || 1;
      return cantidad > 1 ? [{ ...plato, cantidad: cantidad - 1 }] : [];
    }));
  }, []);

  const abrirCarrito = (irAPago = false, idRestaurante = null) => {
    setDestinoCarrito({ irAPago, idRestaurante });
    setMostrarCarrito(true);
    setMostrarFavoritos(false);
    setMostrarPerfil(false);
    setRestauranteActivo(null);
    setPlatoActivo(null);
    cerrarAvisoCarrito();
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('resetToken')) {
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

  const { loading, error, data: datosInicio } = useQuery(OBTENER_DATOS_INICIO, {
    variables: { id_usuario: userId, latitud: ubicacionEntrega?.lat, longitud: ubicacionEntrega?.lng, solo_con_entrega: modoEntrega === 'DOMICILIO' },
    skip: !isLoggedIn || !userId || userRol === 'VENDEDOR' || !ubicacionEntrega,
    fetchPolicy: 'network-only' 
  });

  const data = loading ? undefined : datosInicio;

  const handleCerrarSesion = () => {
    localStorage.removeItem('nexbite_token');
    localStorage.removeItem('user');
    window.location.href = '/'; 
  };

  const handleInicio = () => {
    setRestauranteActivo(null); setPlatoActivo(null); setMostrarCarrito(false);
    setMostrarFavoritos(false); setMostrarPerfil(false); setVistaVendedor('MIS_LOCALES'); 
    setCategoriaFiltroInicio(null); 
  };

  const navegarDesdeFooter = destino => {
    if (destino === 'carrito') return abrirCarrito();
    if (destino === 'ubicacion') {
      if (ubicacionEntrega) setMostrarSelectorUbicacion(true);
      else { handleInicio(); document.getElementById('direccion-entrega')?.focus(); }
      return;
    }
    handleInicio();
    cerrarAvisoCarrito();
    if (destino === 'perfil' || destino === 'pedidos') setMostrarPerfil(true);
    if (destino === 'favoritos') setMostrarFavoritos(true);
    if (destino === 'registrar' && userRol === 'VENDEDOR') setVistaVendedor('REGISTRAR');
    window.scrollTo(0, 0);
  };

  const handleRecomprarRapido = (e, pedido) => {
    e.stopPropagation();
    agregarAlCarrito({ id_plato: pedido.id_plato, id_restaurante: pedido.id_restaurante, nombre: pedido.nombre_plato, precio: pedido.precio_plato, imagen_url: pedido.imagen_plato });
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
    if (repetimosRef.current) repetimosRef.current.scrollBy({ left: desplazamiento, behavior: 'smooth' });
  };

  if (!isLoggedIn) {
    return <div className="nexbite-acceso">
      <main className="nexbite-acceso-contenido">
        <Auth onLogin={() => {
          const token = localStorage.getItem('nexbite_token');
          const datos = obtenerDatosDesdeToken(token);
          setUbicacionEntrega(leerUbicacionEntrega(datos?.id_usuario));
          setUserId(datos?.id_usuario); setUserRol(datos?.rol); setIsLoggedIn(true);
        }} />
      </main>
      <Footer onAcceder={() => {
        window.scrollTo(0, 0);
        document.querySelector('.nexbite-acceso-contenido input')?.focus({ preventScroll: true });
      }} />
    </div>;
  }

  const totalArticulos = carrito.reduce((acc, p) => acc + (p.cantidad || 1), 0);
  const platoDelAviso = avisoCarrito && carrito.find(plato => String(plato.id_plato) === String(avisoCarrito.id_plato));

  const generarRecomendacionesGlobales = () => {
    if (!data?.obtenerPlatosDestacados) return [];
    const puntuacionPlatos = {};
    const gustosEtiquetas = {};
    const favoritosLocales = data?.obtenerPlatosFavoritos?.map(fav => String(fav.id_plato)) || [];
    const historialBackend = data?.obtenerUltimosPedidos || [];
    const carritoActual = Array.isArray(carrito) ? carrito : [];
    const elementosInteraccion = [...historialBackend, ...carritoActual];

    elementosInteraccion.forEach(item => {
      const cantidadComprada = item.cantidad || 1;
      const platoDb = data.obtenerPlatosDestacados.find(p => String(p.id_plato) === String(item.id_plato)) || item;
      if (platoDb && (platoDb.categoria || platoDb.descripcion)) {
        const { tagsTotales } = extraerTags(platoDb.descripcion || platoDb.descripcion_plato, platoDb.categoria);
        tagsTotales.forEach(tag => { gustosEtiquetas[tag] = (gustosEtiquetas[tag] || 0) + cantidadComprada; });
      }
    });

    data.obtenerPlatosDestacados.forEach(plato => {
      if (!puntuacionPlatos[plato.id_plato]) puntuacionPlatos[plato.id_plato] = 0;
      if (favoritosLocales.includes(String(plato.id_plato))) puntuacionPlatos[plato.id_plato] += 5; 
      const { tagsTotales } = extraerTags(plato.descripcion, plato.categoria);
      tagsTotales.forEach(tag => {
        if (gustosEtiquetas[tag]) puntuacionPlatos[plato.id_plato] += (gustosEtiquetas[tag] * 2);
      });
    });

    return [...data.obtenerPlatosDestacados]
      .filter(plato => puntuacionPlatos[plato.id_plato] > 0)
      .sort((a, b) => puntuacionPlatos[b.id_plato] - puntuacionPlatos[a.id_plato])
      .slice(0, 8); 
  };

  const platosRecomendados = generarRecomendacionesGlobales();

  const restaurantesFiltrados = data?.obtenerMejoresRestaurantes?.filter(rest => {
    if (!categoriaFiltroInicio) return true;
    return rest.tipo?.toLowerCase().includes(categoriaFiltroInicio.toLowerCase());
  }) || [];

  return (
    <EstadoCarritoContext.Provider value={{ carrito, restarDelCarrito }}>
    <ErrorBoundary>
      <div style={{ fontFamily: 'system-ui', margin: 0, padding: 0, minHeight: '100vh', backgroundColor: '#f8f9fa', position: 'relative' }}>
        <div className="header-contenedor" inert={mostrarSelectorUbicacion || Boolean(confirmacionPedido)}>
        <Header 
          onInicio={handleInicio} onLogout={handleCerrarSesion} 
          cantidadCarrito={totalArticulos} 
          onAbrirCarrito={() => abrirCarrito()}
          onAbrirFavoritos={() => { setMostrarFavoritos(true); setMostrarCarrito(false); setRestauranteActivo(null); setPlatoActivo(null); setMostrarPerfil(false); }}
          onSelectRestaurante={id => { handleInicio(); setRestauranteActivo(id); cerrarAvisoCarrito(); window.scrollTo(0, 0); }}
          onSelectPlato={plato => { handleInicio(); setRestauranteActivo(plato.id_restaurante); setPlatoActivo(plato); cerrarAvisoCarrito(); window.scrollTo(0, 0); }}
          onAbrirPerfil={() => { setMostrarPerfil(true); setMostrarCarrito(false); setMostrarFavoritos(false); setRestauranteActivo(null); setPlatoActivo(null); }}
          vistaActiva={mostrarPerfil ? 'perfil' : mostrarCarrito ? 'carrito' : mostrarFavoritos ? 'favoritos' : 'inicio'}
          userRol={userRol}
          ubicacionEntrega={ubicacionEntrega}
          modoEntrega={modoEntrega}
          onCambiarUbicacion={() => {
            if (ubicacionEntrega) setMostrarSelectorUbicacion(true);
            else { handleInicio(); document.getElementById('direccion-entrega')?.focus(); }
          }}
          onCambiarModoEntrega={modo => { setModoEntrega(modo); handleInicio(); }}
        />
        </div>

        <main className="nexbite-contenido" inert={mostrarSelectorUbicacion || Boolean(confirmacionPedido)} style={{ padding: 'clamp(1rem, 4vw, 2rem)', maxWidth: '1200px', margin: '0 auto' }}>
          
          {mostrarPerfil ? (
            <PerfilUsuario onVolver={() => setMostrarPerfil(false)} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={abrirDetalleDesdePedido} />
          
          ) : userRol === 'VENDEDOR' ? (
            vistaVendedor === 'REGISTRAR' ? <RegistroRestaurante />
            : vistaVendedor === 'GESTOR_MENU' ? <GestorMenu idRestaurante={localSeleccionado.id_restaurante} nombreRestaurante={localSeleccionado.nombre} />
            : vistaVendedor === 'GESTOR_PEDIDOS' ? <GestorPedidos idRestaurante={localSeleccionado.id_restaurante} nombreRestaurante={localSeleccionado.nombre} estadoPausa={localSeleccionado.aceptando_pedidos} />
            : <MisLocales onCrearNuevo={() => setVistaVendedor('REGISTRAR')} onGestionarMenu={(local) => { setLocalSeleccionado(local); setVistaVendedor('GESTOR_MENU'); }} onGestionarPedidos={(local) => { setLocalSeleccionado(local); setVistaVendedor('GESTOR_PEDIDOS'); }} />
          ) : (
            
            !ubicacionEntrega ? (
              <SelectorUbicacion onConfirmar={ubicacion => { guardarUbicacionEntrega(userId, ubicacion); setUbicacionEntrega(ubicacion); }} />
            ) : mostrarCarrito ? (
              <Carrito key={destinoCarrito.irAPago ? 'pago-' + destinoCarrito.idRestaurante : 'carrito'} carrito={carrito} setCarrito={setCarrito} onVolver={() => setMostrarCarrito(false)} vaciarCarrito={() => setCarrito([])} idUsuario={userId} ubicacionEntrega={ubicacionEntrega} onCambiarUbicacion={() => setMostrarSelectorUbicacion(true)} tipoEntregaInicial={modoEntrega} idRestauranteInicial={destinoCarrito.idRestaurante} irAPago={destinoCarrito.irAPago} onPedidoConfirmado={pedido => { cerrarAvisoCarrito(); setConfirmacionPedido(pedido); }} />
            ) : mostrarFavoritos ? (
              <MisFavoritos idUsuario={userId} ubicacionEntrega={ubicacionEntrega} modoEntrega={modoEntrega} onVolver={() => setMostrarFavoritos(false)} onSelectRestaurante={(id) => { setRestauranteActivo(id); setMostrarFavoritos(false); }} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={setPlatoActivo} />
            
            ) : restauranteActivo ? (
              <PerfilRestaurante idRestaurante={restauranteActivo} idUsuario={userId} onVolver={() => setRestauranteActivo(null)} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={setPlatoActivo} carrito={carrito} />
            ) : (
              <>
                <TituloSeccion titulo="¿Qué te apetece hoy?" descripcion="Encuentra tu próximo favorito entre los locales de tu zona." nivel={1} destacado />

                <div className="ocultar-scrollbar" style={{ display: 'flex', gap: '15px', overflowX: 'auto', padding: '15px 0', marginTop: '10px' }}>
                  <style>{`.ocultar-scrollbar::-webkit-scrollbar { display: none; } .ocultar-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                  
                  {CATEGORIAS_PORTADA.map(cat => {
                    const isSelected = categoriaFiltroInicio === cat.id;
                    return (
                      <div 
                        key={cat.id} 
                        onClick={() => setCategoriaFiltroInicio(isSelected ? null : cat.id)}
                        style={{ 
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', minWidth: '75px',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ 
                          width: '65px', height: '65px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                          backgroundColor: isSelected ? '#ff4500' : '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', border: isSelected ? '2px solid #ff4500' : '2px solid transparent'
                        }}>
                          <span style={{ filter: isSelected ? 'brightness(0) invert(1)' : 'none' }}>{cat.emoji}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: isSelected ? 'bold' : '600', color: isSelected ? '#ff4500' : '#444' }}>{cat.id}</span>
                      </div>
                    );
                  })}
                </div>

                {platosRecomendados.length > 0 && !categoriaFiltroInicio && (
                  <div style={{ marginTop: '2rem', padding: '1rem', background: 'linear-gradient(to right, #fff0eb, #ffe4cc)', borderRadius: '16px' }}>
                    <CarruselPlatos titulo="Elegido para ti" descripcion="Platos recomendados según tus gustos." cabeceraInicio mostrarIcono={false} platos={platosRecomendados} onSelectPlato={setPlatoActivo} onAgregarAlCarrito={agregarAlCarrito} />
                  </div>
                )}

                {!categoriaFiltroInicio && (
                  <div style={{ marginTop: '2rem' }}>
                    <CarruselPlatos titulo="Platos Top" descripcion="Descubre los platos destacados de tu zona." cabeceraInicio mostrarIcono={false} platos={data?.obtenerPlatosDestacados} onSelectPlato={setPlatoActivo} onAgregarAlCarrito={agregarAlCarrito} />
                  </div>
                )}

                {data?.obtenerUltimosPedidos && data.obtenerUltimosPedidos.length > 0 && !categoriaFiltroInicio && (
                  <div style={{ marginTop: '1rem', marginBottom: '3rem', position: 'relative' }}>
                    <TituloSeccion titulo="¿Repetimos?" descripcion="Vuelve a pedir lo que ya te gusta." acciones={<ControlesCarrusel titulo="¿Repetimos?" onAnterior={() => scrollRepetimos(-300)} onSiguiente={() => scrollRepetimos(300)} />} />
                    
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
                            
                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                              <span style={{ fontWeight: 'bold', color: '#0066cc' }}>€{pedido.precio_plato?.toFixed(2)}</span>
                              {puedeRecomprar ? (
                                <BotonAgregarCarrito onAgregar={event => handleRecomprarRapido(event, pedido)} idPlato={pedido.id_plato} nombrePlato={pedido.nombre_plato} variante="repetir" />
                              ) : (
                                <span style={{ fontSize: '11px', color: '#dc3545', fontWeight: 'bold' }}>No disponible</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '12px' }}>
                      <button type="button" onClick={() => setMostrarPerfil(true)} className="titulo-seccion-enlace">Ver historial completo <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></button>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: categoriaFiltroInicio ? '0' : '2rem' }}>
                  <TituloSeccion titulo={categoriaFiltroInicio ? `Locales de ${categoriaFiltroInicio}` : 'Los Mejores Restaurantes'} descripcion="Locales disponibles para tu ubicación." />
                </div>
                
                {!loading && !error && restaurantesFiltrados.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: '12px' }}>
                    <p style={{ fontSize: '1.2rem', color: '#666' }}>{categoriaFiltroInicio ? `No hay locales de ${categoriaFiltroInicio} disponibles aquí.` : modoEntrega === 'DOMICILIO' ? 'Todavía no hay locales que entreguen en esta dirección.' : 'Todavía no hay locales para recoger a menos de 50 km.'}</p>
                    {categoriaFiltroInicio && <button onClick={() => setCategoriaFiltroInicio(null)} className="ubicacion-boton" style={{ marginTop: '16px' }}>Ver todos</button>}
                    <button onClick={() => setMostrarSelectorUbicacion(true)} className="ubicacion-cambiar" style={{ display: 'block', margin: '16px auto 0' }}>Cambiar ubicación</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                    {restaurantesFiltrados.map((restaurante) => (
                      <div key={restaurante.id_restaurante} onClick={() => setRestauranteActivo(restaurante.id_restaurante)} style={{ backgroundColor: '#fff', border: '1px solid #eaeaea', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}>
                        {restaurante.imagen_url ? (
                            <img src={restaurante.imagen_url} alt={restaurante.nombre} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px 8px 0 0', marginBottom: '10px' }} />
                        ) : (
                            <div style={{ width: '100%', height: '140px', backgroundColor: '#eee', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', fontSize: '2rem' }}>🏪</div>
                        )}
                        <h3 style={{ margin: '0 0 10px 0' }}>{restaurante.nombre}</h3>
                        
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {restaurante.tipo ? restaurante.tipo.split(',').map((t, idx) => (
                            <span key={idx} style={{ background: '#ffe4cc', color: '#ff4500', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                              {t.trim()}
                            </span>
                          )) : (
                            <span style={{ background: '#ffe4cc', color: '#ff4500', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>
                              RESTAURANTE
                            </span>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                )}

                {!categoriaFiltroInicio && (
                  <>
                    <div style={{ marginTop: '3rem' }}>
                      <TituloSeccion titulo="Descubre qué hay cerca de ti" descripcion="Explora el mapa y encuentra los locales de tu zona." />
                    </div>
                    <MapView key={`${ubicacionEntrega.lat}-${ubicacionEntrega.lng}-${modoEntrega}`} ubicacion={ubicacionEntrega} soloConEntrega={modoEntrega === 'DOMICILIO'} onSelectRestaurante={setRestauranteActivo} />
                  </>
                )}

                {loading && <p style={{ marginTop: '2rem' }}>Cargando datos de la plataforma...</p>}
                {error && <p style={{ marginTop: '2rem', color: 'red' }}>Error: {error.message}</p>}
                
              </>
            )
          )}
        </main>

        <Footer userRol={userRol} onNavegar={navegarDesdeFooter}
          bloqueado={mostrarSelectorUbicacion || Boolean(confirmacionPedido) || Boolean(platoActivo)} />

        {mostrarSelectorUbicacion && userRol !== 'VENDEDOR' && <div className="ubicacion-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-ubicacion">
          <SelectorUbicacion ubicacion={ubicacionEntrega} onCancelar={() => setMostrarSelectorUbicacion(false)} onConfirmar={ubicacion => {
            guardarUbicacionEntrega(userId, ubicacion);
            setUbicacionEntrega(ubicacion);
            setMostrarSelectorUbicacion(false);
            if (!mostrarCarrito) handleInicio();
          }} />
        </div>}

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
        {platoDelAviso && <div inert={mostrarSelectorUbicacion || Boolean(confirmacionPedido)}>
          <AvisoCarrito aviso={{ ...platoDelAviso, ...avisoCarrito }} cantidad={platoDelAviso.cantidad || 1}
            onCerrar={cerrarAvisoCarrito} onVerCarrito={() => abrirCarrito()}
            onPagar={() => abrirCarrito(true, platoDelAviso.id_restaurante)} />
        </div>}
        {confirmacionPedido && <ConfirmacionPedido pedido={confirmacionPedido} onCerrar={() => setConfirmacionPedido(null)} onVerPedidos={() => { setConfirmacionPedido(null); handleInicio(); setMostrarPerfil(true); window.scrollTo(0, 0); }} />}
      </div>
    </ErrorBoundary>
    </EstadoCarritoContext.Provider>
  );
}

export default App;
