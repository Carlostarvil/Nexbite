import { useRef, useEffect } from 'react';
import BotonAgregarCarrito from './BotonAgregarCarrito';
import TituloSeccion from './TituloSeccion'; 
import EstadoDisponibilidad from './EstadoDisponibilidad';

// NUEVO: Función para extraer el precio antiguo de la descripción
const extraerPrecioAnterior = (descripcion) => {
  if (!descripcion) return null;
  const match = descripcion.match(/\|ANTES:\s*([\d.,]+)/i);
  return match ? parseFloat(match[1].replace(',', '.')) : null;
};

export default function CarruselPlatos({ titulo, platos, onSelectPlato, onAgregarAlCarrito, mostrarIcono = true, cabeceraInicio = false, descripcion, restaurantePausado = false, tiempoReactivacionRestaurante = null }) {
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
    <div style={{ display: 'flex', gap: '8px' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eaeaea', paddingBottom: '10px', marginBottom: '1.5rem' }}>
        <h2 className="titulo-menu-seccion" style={{ color: '#000', margin: 0, fontWeight: 800 }}>
          {mostrarIcono && '⭐ '}{titulo}
        </h2>
        <BotonesScroll />
      </div>
      )}
      
      <div 
        ref={scrollRef}
        className="ocultar-scrollbar"
        style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '15px', scrollBehavior: 'smooth' }}
      >
        {platos.map(plato => {
          const estaNoDisponible = restaurantePausado || plato.disponible === false || plato.restaurante_abierto === false;
          const precioAnterior = extraerPrecioAnterior(plato.descripcion);
          
          const localCerrado = restaurantePausado || plato.restaurante_abierto === false;

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
            {plato.imagen_url ? (
              <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '140px', objectFit: 'cover', opacity: estaNoDisponible ? 0.65 : 1 }} />
            ) : (
              <div style={{ width: '100%', height: '140px', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🍽️</div>
            )}
            
            <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#000', fontSize: '15px', fontWeight: 700 }}>{plato.nombre}</h4>
              
              {plato.nombre_restaurante && <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>De: {plato.nombre_restaurante}</p>}
              
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                
                {/* LÓGICA DEL PRECIO EN EL CARRUSEL */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
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
