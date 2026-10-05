import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import BotonFavorito from './BotonFavorito'; 
import BotonCorazon from './BotonCorazon';
import { nombreCategoria } from './categoriasPlatos';

import CarruselPlatos from './CarruselPlatos';
import BotonAgregarCarrito from './BotonAgregarCarrito';
import IconoInfoRestaurante from './IconoInfoRestaurante';
import { coordenadasValidas } from '../../shared/zonaEntrega.js';
import './InfoRestauranteModal.css';
import './PerfilRestaurante.css';

const NOMBRES_SIDEBAR = { 'Elegido para ti': 'Para ti', 'Lo más pedido aquí': 'Top ventas' };

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

// Consulta para leer el historial de compras del usuario
const OBTENER_HISTORIAL_COMPRAS = gql`
  query ObtenerHistorialCompras($id_usuario: ID!) {
    obtenerPedidosUsuario(id_usuario: $id_usuario) {
      id_plato
      id_restaurante
      cantidad
    }
  }
`;

const OPCIONES_CATEGORIAS = ['ENTRANTE', 'COMPARTIR', 'PLATO', 'BEBIDA', 'POSTRE', 'OFERTA', 'MENU'];

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
  if (!fechaStr || String(fechaStr).includes('Indefinido')) return 'Sin estimación exacta';
  const timestamp = !isNaN(fechaStr) && String(fechaStr).trim() !== '' ? Number(fechaStr) : fechaStr;
  const fecha = new Date(timestamp);
  if (isNaN(fecha.getTime())) return String(fechaStr); 
  return fecha.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
};

// Generador de IDs seguros para el HTML (necesario para el Scroll Spy)
const getSeccionId = (nombre) => `seccion-${nombre.replace(/[^a-zA-Z0-9]/g, '-')}`;

function InfoRestauranteModal({ restaurante, onClose }) {
  const [direccionObtenida, setDireccionObtenida] = useState(null);
  const [estadoCopia, setEstadoCopia] = useState('');
  const [mapaFallido, setMapaFallido] = useState('');
  const modal = useRef(null);
  const botonCerrar = useRef(null);
  const temporizadorCopia = useRef(null);
  const latitud = restaurante?.latitud;
  const longitud = restaurante?.longitud;
  const direccionGuardada = restaurante?.direccion?.trim() || '';
  const tieneCoordenadas = coordenadasValidas(latitud, longitud);

  useEffect(() => {
    const focoAnterior = document.activeElement;
    botonCerrar.current?.focus();
    return () => {
      clearTimeout(temporizadorCopia.current);
      if (focoAnterior?.isConnected) focoAnterior.focus();
    };
  }, []);

  useEffect(() => {
    if (direccionGuardada || !tieneCoordenadas) return;
    const controlador = new AbortController();
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + latitud + '&lon=' + longitud, { signal: controlador.signal })
      .then(res => {
        if (!res.ok) throw new Error('No se pudo obtener la dirección');
        return res.json();
      })
      .then(data => {
        if (data?.display_name) setDireccionObtenida({
          latitud, longitud, texto: data.display_name.split(', ').slice(0, 3).join(', '),
        });
      })
      .catch(() => {});
    return () => controlador.abort();
  }, [direccionGuardada, tieneCoordenadas, latitud, longitud]);

  if (!restaurante) return null;

  const coordenadasTexto = tieneCoordenadas ? Number(latitud).toFixed(5) + ', ' + Number(longitud).toFixed(5) : '';
  const direccionResuelta = direccionObtenida && direccionObtenida.latitud === latitud && direccionObtenida.longitud === longitud
    ? direccionObtenida.texto : '';
  const direccionTexto = direccionGuardada || direccionResuelta || coordenadasTexto || 'Ubicación no especificada';
  const destino = tieneCoordenadas ? Number(latitud) + ',' + Number(longitud) : direccionGuardada;
  const urlUbicacion = destino ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(destino) : null;
  const urlMapa = tieneCoordenadas
    ? 'https://static-maps.yandex.ru/1.x/?ll=' + longitud + ',' + latitud + '&size=400,200&z=16&l=map&pt=' + longitud + ',' + latitud + ',pm2rdm'
    : null;
  const abierto = Boolean(restaurante.aceptando_pedidos);
  const horario = abierto ? 'Abierto ahora' : restaurante.tiempo_reactivacion
    ? 'Vuelve a abrir: ' + formatearFecha(restaurante.tiempo_reactivacion) : 'Cerrado temporalmente';

  const copiarAlPortapapeles = async () => {
    clearTimeout(temporizadorCopia.current);
    try {
      await navigator.clipboard.writeText(direccionTexto);
      setEstadoCopia('copiado');
      temporizadorCopia.current = setTimeout(() => setEstadoCopia(''), 2000);
    } catch {
      setEstadoCopia('error');
    }
  };

  const controlarTeclado = event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const elementos = [...modal.current.querySelectorAll('button:not(:disabled), a[href]')];
    const primero = elementos[0];
    const ultimo = elementos.at(-1);
    if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo?.focus(); }
    else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero?.focus(); }
  };

  const vistaMapa = <>
    {urlMapa && mapaFallido !== urlMapa
      ? <img src={urlMapa} alt="Ubicación del restaurante en el mapa" onError={() => setMapaFallido(urlMapa)} />
      : <div className="info-restaurante-mapa-alternativo"><IconoInfoRestaurante tipo="ubicacion" /><span>{destino ? 'Ubicación del local' : 'Ubicación no disponible'}</span></div>}
    {urlUbicacion && <span className="info-restaurante-mapa-etiqueta">Ver ubicación <IconoInfoRestaurante tipo="externo" /></span>}
  </>;

  return (
    <div className="info-restaurante-fondo" onClick={onClose}>
      <div ref={modal} id="informacion-restaurante" className="info-restaurante-modal" role="dialog" aria-modal="true" aria-labelledby="info-restaurante-titulo" onKeyDown={controlarTeclado} onClick={event => event.stopPropagation()}>
        <button ref={botonCerrar} type="button" className="info-restaurante-cerrar" aria-label="Cerrar información del restaurante" onClick={onClose}><IconoInfoRestaurante tipo="cerrar" /></button>
        {urlUbicacion
          ? <a className="info-restaurante-mapa" href={urlUbicacion} target="_blank" rel="noopener noreferrer" aria-label={'Ver mapa de ' + restaurante.nombre + ' en Google Maps'}>{vistaMapa}</a>
          : <div className="info-restaurante-mapa">{vistaMapa}</div>}

        <div className="info-restaurante-contenido">
          <h2 id="info-restaurante-titulo">{restaurante.nombre}</h2>
          <p className="info-restaurante-tipo">{restaurante.tipo}</p>

          <div className="info-restaurante-datos">
            <div className="info-restaurante-fila">
              <span className="info-restaurante-icono info-restaurante-icono-direccion"><IconoInfoRestaurante tipo="ubicacion" /></span>
              <div className="info-restaurante-dato">
                <h3>Dirección</h3>
                {urlUbicacion
                  ? <a className="info-restaurante-direccion" href={urlUbicacion} target="_blank" rel="noopener noreferrer" aria-label={'Abrir ubicación de ' + restaurante.nombre + ' en Google Maps'}>{direccionTexto} <IconoInfoRestaurante tipo="externo" /></a>
                  : <p>{direccionTexto}</p>}
                {urlUbicacion && <div className="info-restaurante-acciones">
                  <button type="button" className="info-restaurante-copiar" onClick={copiarAlPortapapeles}><IconoInfoRestaurante tipo={estadoCopia === 'copiado' ? 'copiado' : 'copiar'} /> {estadoCopia === 'copiado' ? 'Copiado' : 'Copiar dirección'}</button>
                </div>}
                <span role="status" className="info-restaurante-copia-estado">{estadoCopia === 'copiado' ? 'Dirección copiada' : estadoCopia === 'error' ? 'No se pudo copiar. Selecciona la dirección para copiarla.' : ''}</span>
              </div>
            </div>

            <div className="info-restaurante-fila">
              <span className="info-restaurante-icono info-restaurante-icono-telefono"><IconoInfoRestaurante tipo="telefono" /></span>
              <div className="info-restaurante-dato">
                <h3>Teléfono de contacto</h3>
                <p>{restaurante.telefono || 'Teléfono no disponible'}</p>
              </div>
            </div>

            <div className="info-restaurante-fila">
              <span className={'info-restaurante-icono ' + (abierto ? 'info-restaurante-icono-horario' : 'info-restaurante-icono-cerrado')}><IconoInfoRestaurante tipo={abierto ? 'horario' : 'horario-cerrado'} /></span>
              <div className="info-restaurante-dato">
                <h3>Horario de pedidos</h3>
                <p className={abierto ? 'info-restaurante-abierto' : 'info-restaurante-cerrado'}>{horario}</p>
              </div>
            </div>

            <div className="info-restaurante-fila">
              <span className="info-restaurante-icono info-restaurante-icono-entrega"><IconoInfoRestaurante tipo="entrega" /></span>
              <div className="info-restaurante-dato">
                <h3>Cobertura de entrega</h3>
                <p>{restaurante.radio_cobertura_km ? 'Aprox. ' + restaurante.radio_cobertura_km + ' km' : 'No definida'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PerfilRestaurante({ idRestaurante, onVolver, onAgregarAlCarrito, onSelectPlato, carrito = [] }) {
  const usuarioLogueado = JSON.parse(localStorage.getItem('user')) || {};
  const idUsuarioActual = usuarioLogueado.id_usuario || "0"; 

  const { loading, error, data } = useQuery(OBTENER_DATOS, { 
    variables: { id: idRestaurante, id_usuario: idUsuarioActual },
    fetchPolicy: 'network-only' 
  });

  const { data: dataHistorial } = useQuery(OBTENER_HISTORIAL_COMPRAS, {
    variables: { id_usuario: idUsuarioActual },
    skip: idUsuarioActual === "0",
    errorPolicy: 'ignore'
  });

  const [alternarFavoritoPlato, { loading: guardandoFavorito }] = useMutation(ALTERNAR_FAVORITO_PLATO);
  const favoritoEnCurso = useRef(false);
  const anclaFavorito = useRef(null);
  const perfil = useRef(null);
  const [busquedaPlato, setBusquedaPlato] = useState('');
  const [favoritosLocales, setFavoritosLocales] = useState([]);
  const [mostrarInfoModal, setMostrarInfoModal] = useState(false); 
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  
  const restaurante = data?.obtenerRestaurantePorId;
  const menuCompleto = data?.obtenerMenuRestaurante || [];
  const platosPopulares = data?.obtenerMasVendidos || []; 
  const listaFavoritos = data?.obtenerFavoritos || [];
  const esFavoritoInicial = listaFavoritos.some(fav => fav.id_restaurante === idRestaurante);
  const platosFavoritos = data?.obtenerPlatosFavoritos;

  useEffect(() => {
    if (platosFavoritos) setFavoritosLocales(platosFavoritos.map(fav => String(fav.id_plato)));
  }, [platosFavoritos]);

  // Si aparece o desaparece "Elegido para ti", el plato pulsado conserva su sitio.
  useLayoutEffect(() => {
    const ancla = anclaFavorito.current;
    anclaFavorito.current = null;
    if (!ancla?.elemento.isConnected) return;
    const desplazamiento = ancla.elemento.getBoundingClientRect().top - ancla.top;
    if (Math.abs(desplazamiento) > 1) window.scrollBy({ top: desplazamiento, behavior: 'instant' });
  }, [favoritosLocales]);

  const todasLasCategorias = Array.from(new Set(
    menuCompleto.flatMap(plato => extraerTags(plato.descripcion, plato.categoria).tagsTotales)
  ));
  const categoriasBaseOrdenadas = OPCIONES_CATEGORIAS.filter(c => todasLasCategorias.includes(c));
  const categoriasCustom = todasLasCategorias.filter(c => !OPCIONES_CATEGORIAS.includes(c)).sort();
  const listaFinalCategorias = [...categoriasBaseOrdenadas, ...categoriasCustom];

  const isPausado = restaurante?.aceptando_pedidos === false;

  const handleCorazonClick = async (idPlato, evento) => {
    if (favoritoEnCurso.current) return;
    favoritoEnCurso.current = true;
    const elemento = evento.currentTarget.closest('.tarjeta-plato');
    const conservarPosicion = () => {
      if (elemento?.isConnected) anclaFavorito.current = { elemento, top: elemento.getBoundingClientRect().top };
    };
    conservarPosicion();
    const idStr = String(idPlato);
    const eraFavorito = favoritosLocales.includes(idStr);
    if (eraFavorito) setFavoritosLocales(prev => prev.filter(id => id !== idStr));
    else setFavoritosLocales(prev => [...prev, idStr]);

    try {
      await alternarFavoritoPlato({
        variables: { id_plato: idPlato },
        update(cache) {
          // Actualiza los favoritos guardados sin desmontar ni volver a cargar el menú.
          cache.updateQuery({ query: OBTENER_DATOS, variables: { id: idRestaurante, id_usuario: idUsuarioActual } }, datos => {
            if (!datos) return datos;
            const favoritos = datos.obtenerPlatosFavoritos || [];
            const plato = datos.obtenerMenuRestaurante.find(p => String(p.id_plato) === idStr);
            return {
              ...datos,
              obtenerPlatosFavoritos: eraFavorito
                ? favoritos.filter(p => String(p.id_plato) !== idStr)
                : favoritos.some(p => String(p.id_plato) === idStr) || !plato ? favoritos : [...favoritos, plato],
            };
          });
        },
      });
    } catch {
      conservarPosicion();
      if (eraFavorito) setFavoritosLocales(prev => [...prev, idStr]);
      else setFavoritosLocales(prev => prev.filter(id => id !== idStr));
      alert('No se ha podido guardar el favorito. Inténtalo de nuevo.');
    } finally {
      favoritoEnCurso.current = false;
    }
  };

  const generarRecomendaciones = () => {
    const puntuacionPlatos = {};
    const gustosEtiquetas = {};

    const historialBackend = dataHistorial?.obtenerPedidosUsuario || [];
    const carritoActual = Array.isArray(carrito) ? carrito : [];
    
    const elementosInteraccion = [...historialBackend, ...carritoActual].filter(item => String(item.id_restaurante) === String(idRestaurante));

    elementosInteraccion.forEach(item => {
      const cantidadComprada = item.cantidad || 1;
      const platoDb = menuCompleto.find(p => String(p.id_plato) === String(item.id_plato));
      
      if (platoDb) {
        puntuacionPlatos[platoDb.id_plato] = (puntuacionPlatos[platoDb.id_plato] || 0) + (cantidadComprada * 10);
        const { tagsTotales } = extraerTags(platoDb.descripcion, platoDb.categoria);
        tagsTotales.forEach(tag => {
          gustosEtiquetas[tag] = (gustosEtiquetas[tag] || 0) + cantidadComprada;
        });
      }
    });

    menuCompleto.forEach(plato => {
      if (!puntuacionPlatos[plato.id_plato]) puntuacionPlatos[plato.id_plato] = 0;
      if (favoritosLocales.includes(String(plato.id_plato))) {
        puntuacionPlatos[plato.id_plato] += 5;
      }
      const { tagsTotales } = extraerTags(plato.descripcion, plato.categoria);
      tagsTotales.forEach(tag => {
        if (gustosEtiquetas[tag]) {
          puntuacionPlatos[plato.id_plato] += (gustosEtiquetas[tag] * 2);
        }
      });
    });

    return [...menuCompleto]
      .filter(plato => puntuacionPlatos[plato.id_plato] > 0)
      .sort((a, b) => puntuacionPlatos[b.id_plato] - puntuacionPlatos[a.id_plato])
      .slice(0, 8); 
  };

  const recomendacionesParaTi = generarRecomendaciones();

  // CONSTRUCCIÓN DEL MENÚ LATERAL
  const platosDeCategoria = cat => menuCompleto.filter(p => {
    const { descLimpia, tagsTotales } = extraerTags(p.descripcion, p.categoria);
    const coincideCategoria = tagsTotales.includes(cat);
    const coincideTexto = busquedaPlato === '' || p.nombre.toLowerCase().includes(busquedaPlato.toLowerCase()) || descLimpia.toLowerCase().includes(busquedaPlato.toLowerCase());
    return coincideCategoria && coincideTexto;
  });
  const categoriasConPlatos = listaFinalCategorias.filter(cat => platosDeCategoria(cat).length > 0);

  const seccionesSidebar = [];
  if (busquedaPlato === '') {
    if (recomendacionesParaTi.length > 0) seccionesSidebar.push('Elegido para ti');
    if (platosPopulares.length > 0) seccionesSidebar.push('Lo más pedido aquí');
  }
  seccionesSidebar.push(...categoriasConPlatos);
  const categoriaSeleccionada = seccionesSidebar.includes(categoriaActiva) ? categoriaActiva : seccionesSidebar[0];
  const tiposLocal = [...new Set((restaurante?.tipo || '').split(',').map(tipo => tipo.trim()).filter(Boolean))];

  // Scroll Spy: Detecta qué sección está en pantalla leyendo el DOM directamente
  useEffect(() => {
    const handleScroll = () => {
      let categoriaActual = null;
      if (!perfil.current) return;
      const limite = parseFloat(getComputedStyle(perfil.current).getPropertyValue('--restaurante-scroll-offset')) || 120;
      const secciones = perfil.current.querySelectorAll('.seccion-scroll');
      
      secciones.forEach(elemento => {
        const rect = elemento.getBoundingClientRect();
        if (rect.top <= limite + 12) {
          categoriaActual = elemento.getAttribute('data-categoria');
        }
      });
      
      const primeraCategoria = secciones[0]?.getAttribute('data-categoria');
      if (categoriaActual || primeraCategoria) setCategoriaActiva(categoriaActual || primeraCategoria);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [data, busquedaPlato]);

  const scrollToCategoria = (cat) => {
    const elemento = document.getElementById(getSeccionId(cat));
    if (elemento) {
      elemento.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      setCategoriaActiva(cat);
    }
  };

  if (loading && !data) return <div style={{ padding: '2rem' }}>Cargando menú...</div>;
  if (error && !data) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error.message}</div>;

  return (
    <div ref={perfil} className="perfil-restaurante">

      {/* CABECERA DEL RESTAURANTE */}
      <div className="restaurante-cabecera">
        <div className="restaurante-portada">
           {restaurante?.imagen_url ? (
              <img src={restaurante.imagen_url} alt={restaurante.nombre} />
           ) : (
              <div className="restaurante-portada-alternativa" aria-hidden="true">
                <svg viewBox="0 0 80 80" width="80" height="80" fill="none" stroke="#9e8f80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 33v32h50V33M12 33l6-17h44l6 17M12 33a7 7 0 0 0 14 0 7 7 0 0 0 14 0 7 7 0 0 0 14 0 7 7 0 0 0 14 0M29 16l-3 17M51 16l3 17M40 16v17M23 65V45h17v20M48 44h10v10H48z" />
                </svg>
              </div>
           )}
           <button type="button" className="restaurante-volver" aria-label="Volver a los restaurantes" title="Volver a los restaurantes" onClick={onVolver}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M20 12H4m7-7-7 7 7 7" /></svg>
           </button>
           <div className="restaurante-favorito">
              <BotonFavorito idRestaurante={idRestaurante} idUsuario={idUsuarioActual} esFavoritoInicial={esFavoritoInicial} nombreRestaurante={restaurante?.nombre} />
           </div>
        </div>

        <div className="restaurante-presentacion">
          <div className="restaurante-nombre-fila">
            <h1 className="restaurante-nombre" id="nombre-restaurante">{restaurante?.nombre}</h1>
            <button type="button" className="boton-info-restaurante" aria-label="Información" title="Información del local" aria-haspopup="dialog" aria-controls="informacion-restaurante" aria-expanded={mostrarInfoModal} onClick={() => setMostrarInfoModal(true)}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" /></svg>
            </button>
          </div>

          <div className="restaurante-resumen">
            {tiposLocal.length > 0 && <div className="restaurante-tipos" aria-label="Tipo de local">
              {tiposLocal.map(tipo => <span className="restaurante-tipo" key={tipo}>{tipo}</span>)}
            </div>}
            <div className={'restaurante-estado' + (isPausado ? ' restaurante-estado-pausado' : '')}>
              <span className="restaurante-estado-punto" aria-hidden="true" />
              {isPausado ? 'Vuelve a abrir: ' + formatearFecha(restaurante.tiempo_reactivacion) : 'Abierto'}
            </div>
          </div>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="restaurante-buscador">
        <input
          type="search"
          aria-label={'Buscar platos en ' + restaurante?.nombre}
          placeholder={`Busca platos en ${restaurante?.nombre} (Ej. Pizza, salsa...)`}
          value={busquedaPlato}
          onChange={(e) => setBusquedaPlato(e.target.value)}
        />
      </div>

      {menuCompleto.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px' }}><p style={{ color: '#666', fontSize: '1.2rem' }}>Aún no hay platos.</p></div>
      ) : (
        <div className="menu-layout">
          
          {/* BARRA LATERAL (SIDEBAR) */}
          <nav className="sidebar-categorias" aria-label="Categorías del menú">
            <p className="menu-navegacion-titulo">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1" /></svg>
              Explora el menú
            </p>
            <div className="menu-categorias-lista">
            {seccionesSidebar.map(cat => {
              const cantidad = cat === 'Elegido para ti' ? recomendacionesParaTi.length : cat === 'Lo más pedido aquí' ? platosPopulares.length : platosDeCategoria(cat).length;
              return (
              <button 
                type="button"
                key={cat} 
                className={`btn-categoria ${categoriaSeleccionada === cat ? 'activa' : ''}`}
                aria-current={categoriaSeleccionada === cat ? 'location' : undefined}
                aria-controls={getSeccionId(cat)}
                onClick={() => scrollToCategoria(cat)}
              >
                <span className="menu-categoria-texto">{(NOMBRES_SIDEBAR[cat] || nombreCategoria(cat)).toUpperCase()}</span>
                <span className="menu-categoria-cantidad" aria-hidden="true">{cantidad}</span>
              </button>
            );})}
            </div>
          </nav>

          {/* CONTENIDO PRINCIPAL (PLATOS) */}
          <div className="contenido-platos">
            
            {/* Carruseles Especiales (Solo si no hay búsqueda activa) */}
            {busquedaPlato === '' && (
              <>
                {recomendacionesParaTi.length > 0 && (
                  <div id={getSeccionId('Elegido para ti')} className="seccion-scroll" data-categoria="Elegido para ti" style={{ marginBottom: '3rem' }}>
                    <CarruselPlatos titulo="Elegido para ti" mostrarIcono={false} platos={recomendacionesParaTi} onSelectPlato={onSelectPlato} onAgregarAlCarrito={onAgregarAlCarrito} />
                  </div>
                )}
                {platosPopulares.length > 0 && (
                  <div id={getSeccionId('Lo más pedido aquí')} className="seccion-scroll" data-categoria="Lo más pedido aquí" style={{ marginBottom: '3rem' }}>
                    <CarruselPlatos titulo="Lo más pedido aquí" mostrarIcono={false} platos={platosPopulares} onSelectPlato={onSelectPlato} onAgregarAlCarrito={onAgregarAlCarrito} />
                  </div>
                )}
              </>
            )}

            {/* Listado de Platos agrupados por Categoría */}
            {categoriasConPlatos.map(cat => {
              const platosCat = platosDeCategoria(cat);

              if (platosCat.length === 0) return null;

              return (
                <div key={cat} id={getSeccionId(cat)} className="seccion-scroll" data-categoria={cat} style={{ marginBottom: '4rem' }}>
                  <div className="restaurante-seccion-cabecera">
                    <h2 className="titulo-menu-seccion">{nombreCategoria(cat)}</h2>
                    <span className="restaurante-seccion-cantidad">{platosCat.length} {platosCat.length === 1 ? 'plato' : 'platos'}</span>
                  </div>
                  
                  <div className="restaurante-platos-grid">
                    {platosCat.map((plato) => {
                      const esPlatoFavorito = favoritosLocales.includes(String(plato.id_plato));
                      const { descLimpia, tagsTotales } = extraerTags(plato.descripcion, plato.categoria);
                      
                      return (
                      <div 
                        key={plato.id_plato} 
                        className="tarjeta-plato"
                        onClick={() => onSelectPlato && onSelectPlato(plato)}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        style={{ position: 'relative', border: '1px solid #e0e0e0', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fff', opacity: (isPausado || plato.disponible === false) ? 0.7 : 1, cursor: 'pointer', transition: 'all 0.2s ease' }}
                      >
                        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}>
                          <BotonCorazon activo={esPlatoFavorito} disabled={guardandoFavorito} onClick={evento => handleCorazonClick(plato.id_plato, evento)} nombre={plato.nombre} />
                        </div>
                        {plato.imagen_url ? <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '200px', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '200px', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>📷</div>}

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                          <div>
                            
                            {/* FILTRO DE ETIQUETAS: Oculta "Entrante", "Compartir", etc. */}
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                              {tagsTotales.filter(tag => !OPCIONES_CATEGORIAS.includes(tag)).map(tag => (
                                <span key={tag} className="plato-etiqueta">
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                              <h3 style={{ margin: '0 0 10px 0', flexGrow: 1 }}>{plato.nombre}</h3>
                            </div>
                            <p style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0' }}>{descLimpia}</p>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', marginTop: '1rem', gap: '10px' }}>
                            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#0066cc' }}>€{plato.precio.toFixed(2)}</span>
                            
                            {isPausado || plato.disponible === false ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                                <span style={{ color: '#d63031', fontWeight: 'bold', fontSize: '0.85rem' }}>{plato.disponible === false ? '❌ Agotado' : '🔴 Pausado'}</span>
                                <BotonAgregarCarrito onAgregar={() => onAgregarAlCarrito(plato)} idPlato={plato.id_plato} nombrePlato={plato.nombre} variante="reserva" />
                              </div>
                            ) : (
                              <BotonAgregarCarrito onAgregar={() => onAgregarAlCarrito(plato)} idPlato={plato.id_plato} nombrePlato={plato.nombre} />
                            )}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      )}

      {mostrarInfoModal && <InfoRestauranteModal restaurante={restaurante} onClose={() => setMostrarInfoModal(false)} />}
    </div>
  );
}
