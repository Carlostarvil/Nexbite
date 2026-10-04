import { useState, useEffect, useRef } from 'react';
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
  const urlIndicaciones = destino ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destino) : null;
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
    {urlIndicaciones && <span className="info-restaurante-mapa-etiqueta">Ver ubicación <IconoInfoRestaurante tipo="externo" /></span>}
  </>;

  return (
    <div className="info-restaurante-fondo" onClick={onClose}>
      <div ref={modal} id="informacion-restaurante" className="info-restaurante-modal" role="dialog" aria-modal="true" aria-labelledby="info-restaurante-titulo" onKeyDown={controlarTeclado} onClick={event => event.stopPropagation()}>
        <button ref={botonCerrar} type="button" className="info-restaurante-cerrar" aria-label="Cerrar información del restaurante" onClick={onClose}><IconoInfoRestaurante tipo="cerrar" /></button>
        {urlIndicaciones
          ? <a className="info-restaurante-mapa" href={urlIndicaciones} target="_blank" rel="noopener noreferrer" aria-label={'Ver mapa de ' + restaurante.nombre + ' en Google Maps'}>{vistaMapa}</a>
          : <div className="info-restaurante-mapa">{vistaMapa}</div>}

        <div className="info-restaurante-contenido">
          <h2 id="info-restaurante-titulo">{restaurante.nombre}</h2>
          <p className="info-restaurante-tipo">{restaurante.tipo}</p>

          <div className="info-restaurante-datos">
            <div className="info-restaurante-fila">
              <span className="info-restaurante-icono info-restaurante-icono-direccion"><IconoInfoRestaurante tipo="ubicacion" /></span>
              <div className="info-restaurante-dato">
                <h3>Dirección</h3>
                {urlIndicaciones
                  ? <a className="info-restaurante-direccion" href={urlIndicaciones} target="_blank" rel="noopener noreferrer" aria-label={'Abrir ubicación de ' + restaurante.nombre + ' en Google Maps'}>{direccionTexto} <IconoInfoRestaurante tipo="externo" /></a>
                  : <p>{direccionTexto}</p>}
                {urlIndicaciones && <div className="info-restaurante-acciones">
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

  const { loading, error, data, refetch } = useQuery(OBTENER_DATOS, { 
    variables: { id: idRestaurante, id_usuario: idUsuarioActual },
    fetchPolicy: 'network-only' 
  });

  const { data: dataHistorial } = useQuery(OBTENER_HISTORIAL_COMPRAS, {
    variables: { id_usuario: idUsuarioActual },
    skip: idUsuarioActual === "0",
    errorPolicy: 'ignore'
  });

  const [alternarFavoritoPlato] = useMutation(ALTERNAR_FAVORITO_PLATO);
  const [busquedaPlato, setBusquedaPlato] = useState('');
  const [favoritosLocales, setFavoritosLocales] = useState([]);
  const [mostrarInfoModal, setMostrarInfoModal] = useState(false); 
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  
  const restaurante = data?.obtenerRestaurantePorId;
  const menuCompleto = data?.obtenerMenuRestaurante || [];
  const platosPopulares = data?.obtenerMasVendidos || []; 
  const listaFavoritos = data?.obtenerFavoritos || [];
  const esFavoritoInicial = listaFavoritos.some(fav => fav.id_restaurante === idRestaurante);
  const platosFavoritos = data?.obtenerPlatosFavoritos || [];

  useEffect(() => {
    if (data) setFavoritosLocales(platosFavoritos.map(fav => String(fav.id_plato)));
  }, [data]);

  const todasLasCategorias = Array.from(new Set(
    menuCompleto.flatMap(plato => extraerTags(plato.descripcion, plato.categoria).tagsTotales)
  ));
  const categoriasBaseOrdenadas = OPCIONES_CATEGORIAS.filter(c => todasLasCategorias.includes(c));
  const categoriasCustom = todasLasCategorias.filter(c => !OPCIONES_CATEGORIAS.includes(c)).sort();
  const listaFinalCategorias = [...categoriasBaseOrdenadas, ...categoriasCustom];

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
  const categoriasConPlatos = listaFinalCategorias.filter(cat => {
    return menuCompleto.some(p => {
      const { descLimpia, tagsTotales } = extraerTags(p.descripcion, p.categoria);
      const coincideCategoria = tagsTotales.includes(cat);
      const coincideTexto = busquedaPlato === '' || p.nombre.toLowerCase().includes(busquedaPlato.toLowerCase()) || descLimpia.toLowerCase().includes(busquedaPlato.toLowerCase());
      return coincideCategoria && coincideTexto;
    });
  });

  const seccionesSidebar = [];
  if (busquedaPlato === '') {
    if (recomendacionesParaTi.length > 0) seccionesSidebar.push('Elegido para ti');
    if (platosPopulares.length > 0) seccionesSidebar.push('Lo más pedido aquí');
  }
  seccionesSidebar.push(...categoriasConPlatos);

  // Scroll Spy: Detecta qué sección está en pantalla leyendo el DOM directamente
  useEffect(() => {
    const handleScroll = () => {
      let categoriaActual = null;
      const secciones = document.querySelectorAll('.seccion-scroll');
      
      secciones.forEach(elemento => {
        const rect = elemento.getBoundingClientRect();
        if (rect.top <= 300) { 
          categoriaActual = elemento.getAttribute('data-categoria');
        }
      });
      
      if (categoriaActual) setCategoriaActiva(categoriaActual);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToCategoria = (cat) => {
    const elemento = document.getElementById(getSeccionId(cat));
    if (elemento) {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCategoriaActiva(cat);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Cargando menú...</div>;
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error.message}</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* CSS INYECTADO: Estilo Sidebar y Animación de Botones */}
      <style>
        {`
          .menu-layout { display: flex; gap: 3rem; align-items: flex-start; margin-top: 2rem; }
          .sidebar-categorias { 
            position: sticky; 
            top: 100px; 
            width: 250px; 
            display: flex; 
            flex-direction: column; 
            gap: 4px; 
            flex-shrink: 0; 
          }
          .contenido-platos { flex-grow: 1; min-width: 0; }
          .btn-categoria { 
            text-align: left; 
            padding: 10px 16px; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            font-weight: 500; 
            font-size: 15px; 
            background-color: transparent;
            color: #555;
            transition: all 0.2s ease; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
          }
          .btn-categoria:hover { background-color: #f3f4f6; color: #111; }
          .btn-categoria.activa { background-color: #eeeeee; color: #000; font-weight: 700; }
          
          @media (max-width: 768px) {
            .menu-layout { flex-direction: column; gap: 1rem; }
            .sidebar-categorias { position: relative; top: 0; width: 100%; flex-direction: row; overflow-x: auto; padding-bottom: 10px; }
            .sidebar-categorias::-webkit-scrollbar { display: none; }
          }
        `}
      </style>

      {/* CABECERA DEL RESTAURANTE */}
      <div style={{ marginBottom: '1rem', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', position: 'relative' }}>
        <div style={{ height: '250px', width: '100%', position: 'relative', backgroundColor: '#f5f5f5' }}>
           {restaurante?.imagen_url ? (
              <img src={restaurante.imagen_url} alt={restaurante.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
           ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>🏪</div>
           )}
           <button onClick={onVolver} style={{ position: 'absolute', top: '15px', left: '15px', width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
              ←
           </button>
           <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px' }}>
              <BotonFavorito idRestaurante={idRestaurante} idUsuario={idUsuarioActual} esFavoritoInicial={esFavoritoInicial} nombreRestaurante={restaurante?.nombre} />
           </div>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <h1 className="titulo-menu-seccion" style={{ margin: '0 0 5px 0', color: '#333' }}>{restaurante?.nombre}</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '1.1rem' }}>{restaurante?.tipo}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
             <button type="button" className="boton-info-restaurante" aria-haspopup="dialog" aria-expanded={mostrarInfoModal} onClick={() => setMostrarInfoModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8f9fa', padding: '10px 15px', borderRadius: '12px', cursor: 'pointer', border: '1px solid #eaeaea', transition: 'background 0.2s', fontFamily: 'inherit' }}>
                <span aria-hidden="true" style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontWeight: 'bold', fontSize: '12px' }}>i</span>
                <span style={{ color: '#333', fontWeight: 'bold', fontSize: '14px' }}>Información</span>
             </button>

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

      {/* BUSCADOR */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder={`🔍 Busca platos en ${restaurante?.nombre} (Ej. Pizza, salsa...)`}
          value={busquedaPlato}
          onChange={(e) => setBusquedaPlato(e.target.value)}
          style={{ width: '100%', padding: '15px 20px', fontSize: '1.05rem', borderRadius: '12px', border: '1px solid #ccc', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {menuCompleto.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px' }}><p style={{ color: '#666', fontSize: '1.2rem' }}>Aún no hay platos.</p></div>
      ) : (
        <div className="menu-layout">
          
          {/* BARRA LATERAL (SIDEBAR) */}
          <div className="sidebar-categorias">
            {seccionesSidebar.map(cat => (
              <button 
                key={cat} 
                className={`btn-categoria ${categoriaActiva === cat ? 'activa' : ''}`}
                onClick={() => scrollToCategoria(cat)}
              >
                {nombreCategoria(cat).toUpperCase()}
              </button>
            ))}
          </div>

          {/* CONTENIDO PRINCIPAL (PLATOS) */}
          <div className="contenido-platos">
            
            {/* Carruseles Especiales (Solo si no hay búsqueda activa) */}
            {busquedaPlato === '' && (
              <>
                {recomendacionesParaTi.length > 0 && (
                  <div id={getSeccionId('Elegido para ti')} className="seccion-scroll" data-categoria="Elegido para ti" style={{ marginBottom: '3rem', scrollMarginTop: '120px' }}>
                    <CarruselPlatos titulo="Elegido para ti" mostrarIcono={false} platos={recomendacionesParaTi} onSelectPlato={onSelectPlato} onAgregarAlCarrito={onAgregarAlCarrito} />
                  </div>
                )}
                {platosPopulares.length > 0 && (
                  <div id={getSeccionId('Lo más pedido aquí')} className="seccion-scroll" data-categoria="Lo más pedido aquí" style={{ marginBottom: '3rem', scrollMarginTop: '120px' }}>
                    <CarruselPlatos titulo="Lo más pedido aquí" mostrarIcono={false} platos={platosPopulares} onSelectPlato={onSelectPlato} onAgregarAlCarrito={onAgregarAlCarrito} />
                  </div>
                )}
              </>
            )}

            {/* Listado de Platos agrupados por Categoría */}
            {categoriasConPlatos.map(cat => {
              const platosCat = menuCompleto.filter(p => {
                const { descLimpia, tagsTotales } = extraerTags(p.descripcion, p.categoria);
                const coincideCategoria = tagsTotales.includes(cat);
                const coincideTexto = busquedaPlato === '' || p.nombre.toLowerCase().includes(busquedaPlato.toLowerCase()) || descLimpia.toLowerCase().includes(busquedaPlato.toLowerCase());
                return coincideCategoria && coincideTexto;
              });

              if (platosCat.length === 0) return null;

              return (
                <div key={cat} id={getSeccionId(cat)} className="seccion-scroll" data-categoria={cat} style={{ marginBottom: '4rem', scrollMarginTop: '120px' }}>
                  <h2 className="titulo-menu-seccion" style={{ color: '#333', marginBottom: '1.5rem' }}>{nombreCategoria(cat)}</h2>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {platosCat.map((plato) => {
                      const esPlatoFavorito = favoritosLocales.includes(String(plato.id_plato));
                      const { descLimpia, tagsTotales } = extraerTags(plato.descripcion, plato.categoria);
                      
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
                            
                            {/* FILTRO DE ETIQUETAS: Oculta "Entrante", "Compartir", etc. */}
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                              {tagsTotales.filter(tag => !OPCIONES_CATEGORIAS.includes(tag)).map(tag => (
                                <span key={tag} style={{ fontSize: '11px', background: '#e3f2fd', color: '#0066cc', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                              <h3 style={{ margin: '0 0 10px 0', flexGrow: 1 }}>{plato.nombre}</h3>
                              <BotonCorazon activo={esPlatoFavorito} onClick={() => handleCorazonClick(plato.id_plato)} nombre={plato.nombre} />
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
