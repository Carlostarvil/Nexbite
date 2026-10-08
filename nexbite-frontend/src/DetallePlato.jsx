import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import BotonAgregarCarrito from './BotonAgregarCarrito';

const OBTENER_DATOS_DETALLE = gql`
  query ObtenerDatosDetalle($id: ID!) {
    obtenerRestaurantePorId(id_restaurante: $id) {
      id_restaurante
      nombre
    }
    obtenerMasVendidos(id_restaurante: $id) { 
      id_plato
      id_restaurante
      nombre
      descripcion
      precio
      categoria
      imagen_url
      disponible
      tiempo_disponible 
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

export default function DetallePlato({ plato, onVolver, onAgregarAlCarrito, onIrARestaurante }) {
  
  const { data } = useQuery(OBTENER_DATOS_DETALLE, {
    variables: { id: plato.id_restaurante },
    skip: !plato.id_restaurante
  });

  const [animandoExito, setAnimandoExito] = useState(false);
  const cierrePendiente = useRef(null);
  
  const scrollRef = useRef(null);

  useEffect(() => () => clearTimeout(cierrePendiente.current), []);

  const nombreLocal = plato.nombre_restaurante || data?.obtenerRestaurantePorId?.nombre || "Cargando local...";
  
  const { descLimpia, tagsTotales, precioAnterior } = extraerTags(plato.descripcion, plato.categoria);

  const handleAgregarClick = () => {
    if (onAgregarAlCarrito(plato) === false) return false;
    setAnimandoExito(true);
    cierrePendiente.current = setTimeout(onVolver, 900);
  };

  const scrollRecomendados = (desplazamiento) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: desplazamiento, behavior: 'smooth' });
    }
  };

  const platosRecomendados = (data?.obtenerMasVendidos || [])
    .filter(p => String(p.id_plato) !== String(plato.id_plato))
    .slice(0, 8); 

  // Constante de estilos compartida para forzar la máxima calidad visual
  const estiloImagenAltaCalidad = {
    width: '100%', 
    objectFit: 'cover', 
    objectPosition: 'center', 
    imageRendering: '-webkit-optimize-contrast', // Mejora el contraste de los bordes en Safari/Chrome
    display: 'block'
  };

  return (
    <div className="detalle-plato-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem', backdropFilter: 'blur(3px)' }} onClick={onVolver}>
      
      {/* 1. VENTANA MODAL MÁS GRANDE (maxWidth: 650px) */}
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 15px 50px rgba(0,0,0,0.3)', width: '100%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* 2. BOTÓN DE CIERRE (CRUZ) VISUAL Y CON ANIMACIÓN */}
        <button 
          onClick={onVolver} 
          title="Cerrar"
          style={{ 
            position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.95)', 
            border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, 
            boxShadow: '0 4px 15px rgba(0,0,0,0.15)', transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            color: '#333'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.color = '#ff4500'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = '#333'; }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {plato.imagen_url ? (
            <img 
              src={plato.imagen_url} 
              alt={plato.nombre} 
              style={{ ...estiloImagenAltaCalidad, height: '350px' }} // Altura aumentada para mantener proporción
            />
          ) : (
            <div style={{ width: '100%', height: '350px', backgroundColor: '#fcfcfc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ddd' }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>
            </div>
          )}
          
          {/* Padding aumentado para que respire más el diseño */}
          <div style={{ padding: '2.5rem' }}>
            
            {/* ETIQUETA DEL RESTAURANTE (Sin emojis) */}
            {onIrARestaurante && plato.id_restaurante && (
              <button 
                onClick={() => onIrARestaurante(plato.id_restaurante)} 
                style={{ 
                  background: '#fff5f2', color: '#ff4500', border: '1px solid #ffebee', padding: '8px 16px', 
                  borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', 
                  display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', transition: 'background 0.2s' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#ffebee'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff5f2'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v2H3z"></path><path d="M4 11v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9"></path><path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"></path><path d="M12 11v10"></path></svg>
                {nombreLocal}
              </button>
            )}

            {/* NOMBRE DEL PLATO Y PRECIO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', marginBottom: '12px' }}>
              <h1 style={{ margin: 0, color: '#1a1a1a', fontSize: '1.8rem', flex: 1, lineHeight: '1.2', letterSpacing: '-0.5px' }}>{plato.nombre}</h1>
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', textAlign: 'right' }}>
                {precioAnterior && precioAnterior > plato.precio && (
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#999', textDecoration: 'line-through' }}>
                    {precioAnterior.toFixed(2)}&nbsp;€
                  </span>
                )}
                <h2 style={{ margin: 0, color: '#ff4500', fontSize: '1.7rem', whiteSpace: 'nowrap' }}>{plato.precio?.toFixed(2)}&nbsp;€</h2>
              </div>
            </div>
            
            {/* ETIQUETAS */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '15px' }}>
              {tagsTotales.filter(tag => !OPCIONES_CATEGORIAS.includes(tag)).map(cat => (
                <span key={cat} style={{ fontSize: '11px', background: '#f5f5f5', color: '#555', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {cat}
                </span>
              ))}
            </div>
            
            {/* DESCRIPCIÓN DEL PLATO */}
            <p style={{ color: '#555', lineHeight: '1.6', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
              {descLimpia || "Un plato delicioso preparado con los mejores ingredientes de la casa."}
            </p>

            {/* CARRUSEL DE RECOMENDADOS */}
            {platosRecomendados.length > 0 && (
              <div style={{ marginTop: '2.5rem', marginBottom: '2rem', borderTop: '1px solid #eaeaea', paddingTop: '1.5rem' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: '#333', margin: 0 }}>Frecuentemente comprados juntos</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => scrollRecomendados(-200)}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #eaeaea', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <button 
                      onClick={() => scrollRecomendados(200)}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #eaeaea', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </div>
                </div>
                
                <div ref={scrollRef} className="ocultar-scrollbar" style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px', scrollBehavior: 'smooth' }}>
                  <style>{`.ocultar-scrollbar::-webkit-scrollbar { display: none; } .ocultar-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                  
                  {platosRecomendados.map(recomendado => {
                    const extraTagsRec = extraerTags(recomendado.descripcion, recomendado.categoria);
                    const estaAgotado = recomendado.disponible === false;
                    
                    return (
                    <div 
                      key={recomendado.id_plato} 
                      style={{ 
                        minWidth: '150px', maxWidth: '150px', border: '1px solid #eaeaea', borderRadius: '12px', padding: '12px', 
                        display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#fafafa', opacity: estaAgotado ? 0.6 : 1 
                      }}
                    >
                      {recomendado.imagen_url ? (
                        <img 
                          src={recomendado.imagen_url} 
                          alt={recomendado.nombre} 
                          style={{ ...estiloImagenAltaCalidad, height: '90px', borderRadius: '8px' }} 
                        />
                      ) : (
                        <div style={{ width: '100%', height: '90px', backgroundColor: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>
                        </div>
                      )}
                      
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <p style={{ margin: '0 0 6px 0', fontSize: '13.5px', fontWeight: 'bold', color: '#333', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {recomendado.nombre}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '14px', color: '#1a1a1a', fontWeight: 'bold' }}>{recomendado.precio.toFixed(2)}&nbsp;€</span>
                          {extraTagsRec.precioAnterior && extraTagsRec.precioAnterior > recomendado.precio && (
                            <span style={{ fontSize: '11px', color: '#999', textDecoration: 'line-through' }}>{extraTagsRec.precioAnterior.toFixed(2)}&nbsp;€</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                        {estaAgotado ? (
                          <BotonAgregarCarrito onAgregar={() => onAgregarAlCarrito(recomendado)} idPlato={recomendado.id_plato} nombrePlato={recomendado.nombre} variante="reserva" />
                        ) : (
                          <BotonAgregarCarrito onAgregar={() => onAgregarAlCarrito(recomendado)} idPlato={recomendado.id_plato} nombrePlato={recomendado.nombre} />
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )}

            <BotonAgregarCarrito onAgregar={handleAgregarClick} idPlato={plato.id_plato} nombrePlato={plato.nombre} variante="detalle" disabled={animandoExito} />

          </div>
        </div>
      </div>
    </div>
  );
}