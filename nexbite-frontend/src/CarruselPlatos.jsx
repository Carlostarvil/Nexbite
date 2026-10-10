import { useRef, useEffect } from 'react';
import BotonAgregarCarrito from './BotonAgregarCarrito';
import TituloSeccion from './TituloSeccion'; 
import EstadoDisponibilidad from './EstadoDisponibilidad';
import ImagenPlato from './ImagenPlato';
import TarjetaProductoInicio from './TarjetaProductoInicio';

// Función para extraer el precio antiguo de la descripción
const extraerPrecioAnterior = (descripcion) => {
  if (!descripcion) return null;
  const match = descripcion.match(/\|ANTES:\s*([\d.,]+)/i);
  return match ? parseFloat(match[1].replace(',', '.')) : null;
};

// NUEVA FUNCION: Detecta si el plato tiene el TAG de oferta
const esPlatoEnOferta = (plato) => {
  if (!plato || (!plato.categoria && !plato.descripcion)) return false;
  
  try {
    let catArray = [];
    if (typeof plato.categoria === 'string') {
      catArray = plato.categoria.replace(/[{}"[\]\\]/g, '').split(',').map(s => s.trim().toUpperCase());
    } else if (Array.isArray(plato.categoria)) {
      catArray = plato.categoria.flatMap(c => typeof c === 'string' ? c.replace(/[{}"[\]\\]/g, '').split(',').map(s => s.trim().toUpperCase()) : String(c).toUpperCase());
    }
    if (catArray.includes('OFERTA')) return true;

    if (plato.descripcion && plato.descripcion.toUpperCase().includes('TAGS:')) {
      const match = plato.descripcion.toUpperCase().match(/TAGS:(.*)/);
      if (match && match[1].includes('OFERTA')) return true;
    }
  } catch(e) { return false; }
  return false;
};


export default function CarruselPlatos({ titulo, platos, onSelectPlato, onAgregarAlCarrito, mostrarIcono = true, cabeceraInicio = false, descripcion, restaurantePausado = false, tiempoReactivacionRestaurante = null, tarjetasInicio = false }) {
  const scrollRef = useRef(null);
  const intervaloRef = useRef(null);

  const scroll = (desplazamiento) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: desplazamiento, behavior: 'smooth' });
    }
  };

  const iniciarScrollContinuo = (desplazamiento) => {
    scroll(desplazamiento); 
    intervaloRef.current = setInterval(() => {
      scroll(desplazamiento);
    }, 250);
  };

  const detenerScrollContinuo = () => {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  };

  useEffect(() => {
    return () => detenerScrollContinuo();
  }, []);

  if (!platos || platos.length === 0) return null;

  const BotonesScroll = () => (
    <div className="carrusel-platos-controles" style={{ display: 'flex', gap: '8px' }}>
      <button 
        type="button"
        aria-label={'Ver anteriores en ' + (titulo || 'Elegido para ti')}
        onClick={evento => { if (evento.detail === 0) scroll(-250); }}
        onMouseDown={() => iniciarScrollContinuo(-250)}
        onMouseUp={detenerScrollContinuo}
        onTouchStart={() => iniciarScrollContinuo(-250)}
        onTouchEnd={detenerScrollContinuo}
        style={{ 
          width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #eaeaea', 
          background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', color: '#000',
          userSelect: 'none', WebkitUserSelect: 'none', transition: 'background 0.2s' 
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
        onMouseLeave={(e) => { 
          e.currentTarget.style.backgroundColor = 'white'; 
          detenerScrollContinuo(); 
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>

      <button 
        type="button"
        aria-label={'Ver siguientes en ' + (titulo || 'Elegido para ti')}
        onClick={evento => { if (evento.detail === 0) scroll(250); }}
        onMouseDown={() => iniciarScrollContinuo(250)}
        onMouseUp={detenerScrollContinuo}
        onTouchStart={() => iniciarScrollContinuo(250)}
        onTouchEnd={detenerScrollContinuo}
        style={{ 
          width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #eaeaea', 
          background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', color: '#000',
          userSelect: 'none', WebkitUserSelect: 'none', transition: 'background 0.2s' 
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
        onMouseLeave={(e) => { 
          e.currentTarget.style.backgroundColor = 'white'; 
          detenerScrollContinuo(); 
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  );

  return (
    <div style={{ marginBottom: '2.5rem', position: 'relative' }}>
      <style>
        {`
          .ocultar-scrollbar::-webkit-scrollbar { display: none; }
          .ocultar-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}
      </style>
      
      {!titulo ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>{BotonesScroll()}</div>
      ) : cabeceraInicio ? (
        <TituloSeccion titulo={titulo} descripcion={descripcion} acciones={<BotonesScroll />} />
      ) : (
      <div className="carrusel-platos-cabecera" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eaeaea', paddingBottom: '10px', marginBottom: '1.5rem' }}>
        <h2 className="titulo-menu-seccion" style={{ color: '#000', margin: 0, fontWeight: 800 }}>
          {mostrarIcono && '⭐ '}{titulo}
        </h2>
        <BotonesScroll />
      </div>
      )}
      
      <div 
        ref={scrollRef}
        className={'ocultar-scrollbar' + (tarjetasInicio ? ' carrusel-tarjetas-inicio' : '')}
        style={tarjetasInicio ? undefined : { display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '15px', scrollBehavior: 'smooth' }}
      >
        {platos.map(plato => {
          const estaNoDisponible = restaurantePausado || plato.disponible === false || plato.restaurante_abierto === false;
          const precioAnterior = extraerPrecioAnterior(plato.descripcion);
          const tieneOferta = esPlatoEnOferta(plato);
          
          const localCerrado = restaurantePausado || plato.restaurante_abierto === false;

          if (tarjetasInicio) return <TarjetaProductoInicio key={plato.id_plato} plato={plato}
            onSeleccionar={onSelectPlato} onAgregar={onAgregarAlCarrito} tieneOferta={tieneOferta}
            precioAnterior={precioAnterior} noDisponible={estaNoDisponible} localCerrado={localCerrado}
            fechaDisponible={localCerrado ? tiempoReactivacionRestaurante || plato.tiempo_reactivacion_restaurante : plato.tiempo_disponible} />;

          return (
          <div 
            key={plato.id_plato} 
            onClick={() => onSelectPlato(plato)}
            style={{ 
              position: 'relative', minWidth: '220px', maxWidth: '220px', backgroundColor: '#fff', border: '1px solid #eaeaea', 
              borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.02)', 
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.02)'; }}
          >
            <div style={{ position: 'relative' }}>
                <ImagenPlato plato={plato} style={{ height: '140px', opacity: estaNoDisponible ? 0.65 : 1 }} />
                
                {/* AÑADIDO: Etiqueta Visual de Oferta */}
                {tieneOferta && (
                  <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#c62828', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                    Oferta
                  </div>
                )}
            </div>
            
            <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#000', fontSize: '15px', fontWeight: 700 }}>{plato.nombre}</h4>
              
              {plato.nombre_restaurante && <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>De: {plato.nombre_restaurante}</p>}
              
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                
                {/* LÓGICA DEL PRECIO EN EL CARRUSEL */}
                <div className="plato-precios" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontWeight: '800', color: '#000', fontSize: '1.2rem' }}>{plato.precio?.toFixed(2)}&nbsp;€</span>
                  {precioAnterior && precioAnterior > plato.precio && (
                    <span style={{ fontWeight: '600', color: '#999', fontSize: '0.95rem', textDecoration: 'line-through' }}>
                      {precioAnterior.toFixed(2)}&nbsp;€
                    </span>
                  )}
                </div>
                
                {estaNoDisponible ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                    <EstadoDisponibilidad cerrado={localCerrado} fecha={localCerrado ? tiempoReactivacionRestaurante || plato.tiempo_reactivacion_restaurante : plato.tiempo_disponible} />
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
}
