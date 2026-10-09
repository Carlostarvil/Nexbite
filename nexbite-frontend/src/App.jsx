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
import EspacioVendedor from './EspacioVendedor';
import PerfilVendedor from './PerfilVendedor';
import ErrorBoundary from './ErrorBoundary'; 
import DetallePlato from './DetallePlato'; 
import PerfilUsuario from './PerfilUsuario';
import CarruselPlatos from './CarruselPlatos';
import CategoriasInicio from './CategoriasInicio';
import EtiquetasLocal from './EtiquetasLocal';
import SelectorRecomendaciones from './SelectorRecomendaciones';
import TituloSeccion, { ControlesCarrusel } from './TituloSeccion';
import BotonAgregarCarrito from './BotonAgregarCarrito';
import ImagenPlato from './ImagenPlato';
import EstadoDisponibilidad from './EstadoDisponibilidad';
import AvisoCarrito from './AvisoCarrito';
import ConfirmacionPedido from './ConfirmacionPedido';
import { EstadoCarritoContext } from './estadoCarrito';
import SelectorUbicacion from './SelectorUbicacion';
import { leerUbicacionEntrega, guardarUbicacionEntrega } from './ubicacionEntrega';

// Importaciones de los nuevos componentes en el frontend
import AvisoCookies from './AvisoCookies'; 
import ChatSoporteIA from './ChatSoporteIA';

const OBTENER_DATOS_INICIO = gql`
  query ObtenerDatosInicio($id_usuario: ID!, $latitud: Float!, $longitud: Float!, $solo_con_entrega: Boolean!) {
    obtenerMejoresRestaurantes(latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_restaurante, nombre, tipo, imagen_url, aceptando_pedidos, tiempo_reactivacion, calificacion }
    obtenerFavoritos(id_usuario: $id_usuario, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_restaurante, nombre, tipo, imagen_url, aceptando_pedidos, tiempo_reactivacion, calificacion }
    obtenerPlatosDestacados(latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_plato, id_restaurante, nombre, descripcion, precio, imagen_url, nombre_restaurante, categoria, disponible, tiempo_disponible, items_menu { id_plato nombre imagen_url } }
    obtenerUltimosPedidos(id_usuario: $id_usuario) {
      id_pedido, id_restaurante, id_plato, nombre_plato, precio_plato
      estado, nombre_restaurante, imagen_restaurante, plato_disponible, restaurante_abierto
      fecha_pedido, descripcion_plato, imagen_plato
    }
    obtenerPlatosFavoritos(id_usuario: $id_usuario, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_plato }
  }
`;

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
  let precioAnterior = null;

  const matchAntes = descLimpia.match(/\|ANTES:\s*([\d.,]+)/i);
  if (matchAntes) {
    precioAnterior = parseFloat(matchAntes[1].replace(',', '.'));
    descLimpia = descLimpia.replace(matchAntes[0], '').trim();
  }

  if (descLimpia.includes(' |TAGS:')) {
    const partes = descLimpia.split(' |TAGS:');
    descLimpia = partes[0];
    tagsExtra = partes[1].split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  } else if (descLimpia.includes('|TAGS:')) {
    const partes = descLimpia.split('|TAGS:');
    descLimpia = partes[0].trim();
    tagsExtra = partes[1].split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  }

  return { descLimpia, tagsTotales: [...parseCategorias(categoriasBackend), ...tagsExtra], precioAnterior };
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
  const [irAPedidosPerfil, setIrAPedidosPerfil] = useState(false);
  
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
  const [mensajeVendedor, setMensajeVendedor] = useState(null);
  
  const [categoriaFiltroInicio, setCategoriaFiltroInicio] = useState(null);
  
  const [pestañaElegidoParaTi, setPestañaElegidoParaTi] = useState('LOCALES');

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

  const abrirPerfil = (irAPedidos = false) => {
    setIrAPedidosPerfil(irAPedidos);
    setMostrarPerfil(true);
    setMostrarCarrito(false);
    setMostrarFavoritos(false);
    setRestauranteActivo(null);
    setPlatoActivo(null);
    cerrarAvisoCarrito();
    if (!irAPedidos) window.scrollTo(0, 0);
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
    if (destino === 'perfil' || destino === 'pedidos') return abrirPerfil(destino === 'pedidos');
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
    return (
      <div style={{ fontFamily: 'system-ui', margin: 0, padding: 0, minHeight: '100vh', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
        
        <div className="header-contenedor">
          <Header isLoggedIn={false} onInicio={() => window.scrollTo(0,0)} />
        </div>
        
        <main className="nexbite-acceso-contenido" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div style={{ width: '100%', maxWidth: '450px' }}>
            <Auth onLogin={() => {
              const token = localStorage.getItem('nexbite_token');
              const datos = obtenerDatosDesdeToken(token);
              setUbicacionEntrega(leerUbicacionEntrega(datos?.id_usuario));
              setUserId(datos?.id_usuario); setUserRol(datos?.rol); setIsLoggedIn(true);
            }} />
          </div>
        </main>
        
        <Footer onNavegar={() => {
          window.scrollTo(0, 0);
          document.querySelector('input')?.focus({ preventScroll: true });
        }} />
        
        <AvisoCookies />
      </div>
    );
  }

  const totalArticulos = carrito.reduce((acc, p) => acc + (p.cantidad || 1), 0);
  const platoDelAviso = avisoCarrito && carrito.find(plato => String(plato.id_plato) === String(avisoCarrito.id_plato));

  const favoritosLocales = data?.obtenerPlatosFavoritos?.map(fav => String(fav.id_plato)) || [];
  const historialBackend = data?.obtenerUltimosPedidos || [];
  const restaurantesFavoritos = data?.obtenerFavoritos?.map(fav => String(fav.id_restaurante)) || [];

  const generarRecomendacionesGlobales = () => {
    if (!data?.obtenerPlatosDestacados) return [];
    const puntuacionPlatos = {};
    const gustosEtiquetas = {};
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

  const generarRestaurantesRecomendados = () => {
    if (!data?.obtenerMejoresRestaurantes) return [];
    const puntuacionRestaurantes = {};
    
    data.obtenerMejoresRestaurantes.forEach(rest => {
      puntuacionRestaurantes[rest.id_restaurante] = rest.calificacion ? rest.calificacion * 2 : 0;
      if (restaurantesFavoritos.includes(String(rest.id_restaurante))) {
        puntuacionRestaurantes[rest.id_restaurante] += 10;
      }
    });

    historialBackend.forEach(pedido => {
      if (puntuacionRestaurantes[pedido.id_restaurante] !== undefined) {
        puntuacionRestaurantes[pedido.id_restaurante] += 5;
      }
    });

    return [...data.obtenerMejoresRestaurantes]
      .filter(rest => puntuacionRestaurantes[rest.id_restaurante] > 5)
      .sort((a, b) => puntuacionRestaurantes[b.id_restaurante] - puntuacionRestaurantes[a.id_restaurante])
      .slice(0, 4); 
  };

  const platosRecomendados = generarRecomendacionesGlobales();
  const restaurantesRecomendados = generarRestaurantesRecomendados();

  const restaurantesFiltrados = data?.obtenerMejoresRestaurantes?.filter(rest => {
    if (!categoriaFiltroInicio) return true;
    return rest.tipo?.toLowerCase().includes(categoriaFiltroInicio.toLowerCase());
  }) || [];

  const asignarEstadoRestaurante = (listaPlatos) => {
    if (!listaPlatos) return [];
    const restaurantes = data?.obtenerMejoresRestaurantes || [];
    return listaPlatos.map(plato => {
      const rest = restaurantes.find(r => String(r.id_restaurante) === String(plato.id_restaurante));
      return {
        ...plato,
        restaurante_abierto: rest ? rest.aceptando_pedidos : true,
        tiempo_reactivacion_restaurante: rest ? rest.tiempo_reactivacion : null
      };
    });
  };

  const platosEnOferta = data?.obtenerPlatosDestacados?.filter(plato => {
    const { tagsTotales } = extraerTags(plato.descripcion, plato.categoria);
    return tagsTotales.includes('OFERTA');
  }) || [];

  return (
    <EstadoCarritoContext.Provider value={{ carrito, restarDelCarrito }}>
    <ErrorBoundary>
      <div style={{ fontFamily: 'system-ui', margin: 0, padding: 0, minHeight: '100vh', backgroundColor: userRol === 'VENDEDOR' ? '#f7f9f5' : '#ffffff', position: 'relative' }}>
        <div className="header-contenedor" inert={mostrarSelectorUbicacion || Boolean(confirmacionPedido)}>
        <Header 
          onInicio={handleInicio} onLogout={handleCerrarSesion} 
          cantidadCarrito={totalArticulos} 
          onAbrirCarrito={() => abrirCarrito()}
          onAbrirFavoritos={() => { setMostrarFavoritos(true); setMostrarCarrito(false); setRestauranteActivo(null); setPlatoActivo(null); setMostrarPerfil(false); }}
          onSelectRestaurante={id => { handleInicio(); setRestauranteActivo(id); cerrarAvisoCarrito(); window.scrollTo(0, 0); }}
          onSelectPlato={plato => { handleInicio(); setRestauranteActivo(plato.id_restaurante); setPlatoActivo(plato); cerrarAvisoCarrito(); window.scrollTo(0, 0); }}
          onAbrirPerfil={() => abrirPerfil()}
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

        <main className="nexbite-contenido" inert={mostrarSelectorUbicacion || Boolean(confirmacionPedido)} style={{ padding: 'clamp(1rem, 4vw, 2rem)', maxWidth: userRol === 'VENDEDOR' ? '1440px' : '1200px', margin: '0 auto' }}>
          
          {userRol === 'VENDEDOR' ? (
            <EspacioVendedor vista={mostrarPerfil ? 'PERFIL' : vistaVendedor} local={localSeleccionado} onNavegar={vista => {
              if (vista === 'PERFIL') abrirPerfil();
              else { setMostrarPerfil(false); setVistaVendedor(vista); }
            }}>
              {mostrarPerfil ? <PerfilVendedor idUsuario={userId} onVerLocales={() => { setMostrarPerfil(false); setVistaVendedor('MIS_LOCALES'); }} />
              : vistaVendedor === 'REGISTRAR' ? <RegistroRestaurante onCancelar={() => setVistaVendedor('MIS_LOCALES')} onGuardado={local => {
                setMensajeVendedor({ tipo: 'exito', titulo: '¡Tu local ya está en NexBite!', descripcion: local.nombre + ' está listo. Añade tus productos desde «Menú».' });
                setVistaVendedor('MIS_LOCALES');
              }} />
              : vistaVendedor === 'GESTOR_MENU' && localSeleccionado ? <GestorMenu key={localSeleccionado.id_restaurante} idRestaurante={localSeleccionado.id_restaurante} nombreRestaurante={localSeleccionado.nombre} />
              : vistaVendedor === 'GESTOR_PEDIDOS' && localSeleccionado ? <GestorPedidos key={localSeleccionado.id_restaurante} idRestaurante={localSeleccionado.id_restaurante} nombreRestaurante={localSeleccionado.nombre} estadoPausa={localSeleccionado.aceptando_pedidos} onEstadoLocal={cambios => setLocalSeleccionado(local => ({ ...local, ...cambios }))} />
              : <MisLocales mensajeInicial={mensajeVendedor} onCerrarMensaje={() => setMensajeVendedor(null)} onCrearNuevo={() => setVistaVendedor('REGISTRAR')} onGestionarMenu={local => { setLocalSeleccionado(local); setVistaVendedor('GESTOR_MENU'); }} onGestionarPedidos={local => { setLocalSeleccionado(local); setVistaVendedor('GESTOR_PEDIDOS'); }} onLocalActualizado={local => setLocalSeleccionado(anterior => anterior?.id_restaurante === local.id_restaurante ? local : anterior)} />}
            </EspacioVendedor>
          ) : mostrarPerfil ? (
            <PerfilUsuario irAPedidos={irAPedidosPerfil} onVolver={() => setMostrarPerfil(false)} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={abrirDetalleDesdePedido} />
          
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

                <style>{`.ocultar-scrollbar::-webkit-scrollbar { display: none; } .ocultar-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                <CategoriasInicio seleccionada={categoriaFiltroInicio} onSeleccionar={setCategoriaFiltroInicio} />

                {platosEnOferta.length > 0 && !categoriaFiltroInicio && (
                  <div style={{ marginTop: '2rem', padding: '1rem', background: '#ffebee', borderRadius: '16px', border: '1px solid #ffcdd2' }}>
                    <CarruselPlatos titulo="Ofertas Especiales" descripcion="Aprovecha estos descuentos y chollos increíbles." cabeceraInicio mostrarIcono={false} platos={asignarEstadoRestaurante(platosEnOferta)} onSelectPlato={setPlatoActivo} onAgregarAlCarrito={agregarAlCarrito} />
                  </div>
                )}

                {!categoriaFiltroInicio && (restaurantesRecomendados.length > 0 || platosRecomendados.length > 0) && (
                  <section className="elegido-para-ti" aria-label="Para ti">
                    <TituloSeccion titulo="Para ti" descripcion="Recomendaciones personalizadas según tu actividad." />
                    <SelectorRecomendaciones seleccionada={pestañaElegidoParaTi} onSeleccionar={setPestañaElegidoParaTi} />

                    {/* VISTA DE LOCALES RECOMENDADOS */}
                    <div role="tabpanel" id="recomendaciones-panel-locales" aria-labelledby="recomendaciones-tab-locales" hidden={pestañaElegidoParaTi !== 'LOCALES'} tabIndex={0}>
                      {restaurantesRecomendados.length > 0 ? (
                      <div className="elegido-para-ti-locales">
                        {restaurantesRecomendados.map(restaurante => {
                          const tieneOferta = platosEnOferta.some(p => String(p.id_restaurante) === String(restaurante.id_restaurante));
                          return (
                            <div key={`rec-rest-${restaurante.id_restaurante}`} role="button" tabIndex={0} aria-label={'Ver ' + restaurante.nombre} onKeyDown={evento => { if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); setRestauranteActivo(restaurante.id_restaurante); } }} onClick={() => setRestauranteActivo(restaurante.id_restaurante)} style={{ backgroundColor: '#fff', border: '1px solid #ffcca3', padding: '1.2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease', opacity: restaurante.aceptando_pedidos === false ? 0.7 : 1 }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(255,69,0,0.1)'; e.currentTarget.style.borderColor = '#ff4500'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#ffcca3'; }}>
                              <div style={{ position: 'relative' }}>
                                {restaurante.imagen_url ? (
                                    <img src={restaurante.imagen_url} alt={restaurante.nombre} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '15px' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '120px', backgroundColor: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', fontSize: '1.5rem' }}>🏪</div>
                                )}
                                
                                {tieneOferta && (
                                  <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#c62828', color: '#fff', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', textTransform: 'uppercase' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                                    Ofertas
                                  </div>
                                )}
                              </div>
                              
                              <EtiquetasLocal tipo={restaurante.tipo || 'RESTAURANTE'} className="etiquetas-local-inicio" />
                              <h3 style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <span style={{ fontSize: '1.1rem', color: '#1a1a1a' }}>{restaurante.nombre}</span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', backgroundColor: '#fff5f2', color: '#ff4500', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffc107" stroke="#ffc107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    {restaurante.calificacion > 0 ? restaurante.calificacion.toFixed(1) : 'Nuevo'}
                                  </span>
                                </div>
                              </h3>
                              {restaurante.aceptando_pedidos === false && <div style={{ marginBottom: '10px' }}><EstadoDisponibilidad cerrado fecha={restaurante.tiempo_reactivacion} compacto /></div>}
                              
                            </div>
                          );
                        })}
                      </div>
                      ) : (
                        <p className="elegido-para-ti-vacio" role="status"><strong>Aún no tenemos locales para recomendarte.</strong>Añade locales a favoritos o prueba alguno de tu zona.</p>
                      )}
                    </div>

                    {/* VISTA DE PRODUCTOS RECOMENDADOS */}
                    <div role="tabpanel" id="recomendaciones-panel-productos" aria-labelledby="recomendaciones-tab-productos" hidden={pestañaElegidoParaTi !== 'PRODUCTOS'} tabIndex={0}>
                      {pestañaElegidoParaTi === 'PRODUCTOS' && (platosRecomendados.length > 0 ? (
                        <CarruselPlatos titulo="" descripcion="" cabeceraInicio={false} mostrarIcono={false} platos={asignarEstadoRestaurante(platosRecomendados)} onSelectPlato={setPlatoActivo} onAgregarAlCarrito={agregarAlCarrito} />
                      ) : (
                        <p className="elegido-para-ti-vacio" role="status"><strong>Aún no tenemos productos para recomendarte.</strong>Añade productos a favoritos para descubrir recomendaciones.</p>
                      ))}
                    </div>

                  </section>
                )}

                {!categoriaFiltroInicio && (
                  <div style={{ marginTop: '2rem' }}>
                    <CarruselPlatos titulo="Top Ventas" descripcion="Descubre los platos destacados de tu zona." cabeceraInicio mostrarIcono={false} platos={asignarEstadoRestaurante(data?.obtenerPlatosDestacados)} onSelectPlato={setPlatoActivo} onAgregarAlCarrito={agregarAlCarrito} />
                  </div>
                )}

                {data?.obtenerUltimosPedidos && data.obtenerUltimosPedidos.length > 0 && !categoriaFiltroInicio && (
                  <div style={{ marginTop: '1rem', marginBottom: '3rem', position: 'relative' }}>
                    <TituloSeccion titulo="¿Repetimos?" descripcion={historialBackend.length === 1 ? 'Tu último pedido.' : `Tus últimos ${historialBackend.length} pedidos.`} acciones={<ControlesCarrusel titulo="¿Repetimos?" onAnterior={() => scrollRepetimos(-300)} onSiguiente={() => scrollRepetimos(300)} />} />
                    
                    <div ref={repetimosRef} className="ocultar-scrollbar" style={{ position: 'relative', maxWidth: '100%', display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px', scrollBehavior: 'smooth' }}>
                      {data.obtenerUltimosPedidos.map(pedido => {
                        const puedeRecomprar = pedido.restaurante_abierto && pedido.plato_disponible;
                        // NUEVA COMPROBACIÓN DE OFERTAS
                        const esOferta = platosEnOferta.some(p => String(p.id_plato) === String(pedido.id_plato));

                        return (
                          <div 
                            key={`reciente-${pedido.id_pedido}`} 
                            onClick={() => abrirDetalleDesdePedido(pedido)}
                            style={{ minWidth: '280px', maxWidth: '300px', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', padding: '1.2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.2s', opacity: puedeRecomprar ? 1 : 0.7 }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; }}
                          >
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                              <ImagenPlato plato={{ nombre: pedido.nombre_plato || 'Plato retirado', imagen_url: pedido.imagen_plato }} style={{ width: '50px', height: '50px', borderRadius: '8px' }} />
                              <div>
                                <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {pedido.nombre_plato || 'Plato retirado'}
                                  {/* ETIQUETA DE OFERTA EN REPETIMOS */}
                                  {esOferta && (
                                    <span style={{ background: '#c62828', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '2px', textTransform: 'uppercase' }}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                                      Oferta
                                    </span>
                                  )}
                                </h4>
                                <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>{pedido.nombre_restaurante || 'Restaurante cerrado'}</p>
                              </div>
                            </div>
                            
                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                              <span style={{ fontWeight: 'bold', color: '#000000' }}>{pedido.precio_plato?.toFixed(2)}&nbsp;€</span>
                              {puedeRecomprar ? (
                                <BotonAgregarCarrito onAgregar={event => handleRecomprarRapido(event, pedido)} idPlato={pedido.id_plato} nombrePlato={pedido.nombre_plato} variante="repetir" />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                                  <span style={{ fontSize: '11px', color: '#dc3545', fontWeight: 'bold' }}>No disponible</span>
                                  <BotonAgregarCarrito onAgregar={event => handleRecomprarRapido(event, pedido)} idPlato={pedido.id_plato} nombrePlato={pedido.nombre_plato} variante="reserva" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '8px' }}>
                      <button type="button" className="titulo-seccion-enlace" onClick={() => abrirPerfil(true)}>
                        Ver todos mis pedidos
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: categoriaFiltroInicio ? '0' : '2rem' }}>
                  {categoriaFiltroInicio && (
                    <button 
                      onClick={() => setCategoriaFiltroInicio(null)} 
                      style={{ 
                        padding: '10px 16px', background: '#f5f5f5', border: 'none', borderRadius: '8px', 
                        cursor: 'pointer', marginBottom: '1rem', fontWeight: 'bold', display: 'inline-flex', 
                        alignItems: 'center', gap: '8px', color: '#333', transition: 'background 0.2s' 
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#eaeaea'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    >
                      &larr; Volver a todas las categorías
                    </button>
                  )}
                  <TituloSeccion titulo={categoriaFiltroInicio ? `Locales de ${categoriaFiltroInicio}` : 'Los Mejores Locales'} descripcion="Locales disponibles para tu ubicación." />
                </div>
                
                {!loading && !error && restaurantesFiltrados.length === 0 ? (
                  <div style={{ 
                    padding: '4rem 2rem', textAlign: 'center', background: '#fcfcfc', 
                    borderRadius: '16px', border: '1px dashed #ccc', display: 'flex', 
                    flexDirection: 'column', alignItems: 'center', gap: '15px' 
                  }}>
                    <div style={{ background: '#fff5f2', padding: '20px', borderRadius: '50%', color: '#ff4500' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <path d="M11 8v2"></path>
                        <path d="M11 14h.01"></path>
                      </svg>
                    </div>
                    <h3 style={{ margin: '0', fontSize: '1.5rem', color: '#333' }}>¡Vaya! No hemos encontrado locales</h3>
                    <p style={{ margin: '0', fontSize: '1.1rem', color: '#666', maxWidth: '400px', lineHeight: '1.5' }}>
                      {categoriaFiltroInicio 
                        ? `En este momento no hay restaurantes de la categoría "${categoriaFiltroInicio}" que entreguen en tu ubicación.` 
                        : modoEntrega === 'DOMICILIO' 
                          ? 'Todavía no hay locales que entreguen en esta dirección.' 
                          : 'Todavía no hay locales para recoger a menos de 50 km.'}
                    </p>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {categoriaFiltroInicio && (
                        <button 
                          onClick={() => setCategoriaFiltroInicio(null)} 
                          style={{ 
                            padding: '12px 24px', background: '#333', color: '#fff', border: 'none', 
                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', 
                            transition: 'background 0.2s' 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#000'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#333'}
                        >
                          Ver todos los locales
                        </button>
                      )}
                      <button 
                        onClick={() => setMostrarSelectorUbicacion(true)} 
                        style={{ 
                          padding: '12px 24px', background: '#fff', color: '#ff4500', border: '1px solid #ff4500', 
                          borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', 
                          transition: 'all 0.2s' 
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fff5f2'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                      >
                        Cambiar ubicación
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                    {restaurantesFiltrados.map((restaurante) => {
                      const tieneOferta = platosEnOferta.some(p => String(p.id_restaurante) === String(restaurante.id_restaurante));

                      return (
                      <div key={restaurante.id_restaurante} onClick={() => setRestauranteActivo(restaurante.id_restaurante)} style={{ backgroundColor: '#fff', border: '1px solid #eaeaea', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s ease', opacity: restaurante.aceptando_pedidos === false ? 0.7 : 1 }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; }}>
                        
                        <div style={{ position: 'relative' }}>
                          {restaurante.imagen_url ? (
                              <img src={restaurante.imagen_url} alt={restaurante.nombre} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginBottom: '15px' }} />
                          ) : (
                              <div style={{ width: '100%', height: '140px', backgroundColor: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', fontSize: '2rem' }}>🏪</div>
                          )}
                          
                          {tieneOferta && (
                            <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#c62828', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                              Ofertas
                            </div>
                          )}
                        </div>
                        
                        <EtiquetasLocal tipo={restaurante.tipo || 'RESTAURANTE'} className="etiquetas-local-inicio" />
                        <h3 style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '1.2rem', color: '#1a1a1a' }}>{restaurante.nombre}</span>
                            
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', backgroundColor: '#fff5f2', color: '#ff4500', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold', width: 'fit-content' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffc107" stroke="#ffc107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                              {restaurante.calificacion > 0 ? restaurante.calificacion.toFixed(1) : 'Nuevo'}
                            </span>
                          </div>

                        </h3>
                        {restaurante.aceptando_pedidos === false && <div style={{ marginBottom: '10px' }}><EstadoDisponibilidad cerrado fecha={restaurante.tiempo_reactivacion} compacto /></div>}
                        

                      </div>
                    )})}
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
        
        <AvisoCookies />
        {userRol !== 'VENDEDOR' && <ChatSoporteIA />}
        
      </div>
    </ErrorBoundary>
    </EstadoCarritoContext.Provider>
  );
}

export default App;
