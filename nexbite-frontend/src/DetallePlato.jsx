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
    <div className="detalle-plato-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }} onClick={onVolver}>
      
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', width: '100%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        <button onClick={onVolver} style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>❌</button>
        
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {plato.imagen_url ? (
            <img 
              src={plato.imagen_url} 
              alt={plato.nombre} 
              style={{ ...estiloImagenAltaCalidad, height: '300px' }} // Altura aumentada para que luzca mejor
            />
          ) : (
            <div style={{ width: '100%', height: '300px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>🍽️</div>
          )}
          
          <div style={{ padding: '2rem' }}>
            
            {/* 1. ETIQUETA DEL RESTAURANTE (ARRIBA DEL TODO) */}
            {onIrARestaurante && plato.id_restaurante && (
              <button onClick={() => onIrARestaurante(plato.id_restaurante)} style={{ background: '#e6f2ff', color: '#0066cc', border: 'none', padding: '6px 12px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem' }}>
                🏪 {nombreLocal}
              </button>
            )}

            {/* 2. NOMBRE DEL PLATO Y PRECIO EN LA MISMA FILA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', marginBottom: '10px' }}>
              <h1 style={{ margin: 0, color: '#333', fontSize: '1.6rem', flex: 1, lineHeight: '1.2' }}>{plato.nombre}</h1>
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', textAlign: 'right' }}>
                {precioAnterior && precioAnterior > plato.precio && (
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#999', textDecoration: 'line-through' }}>
                    €{precioAnterior.toFixed(2)}
                  </span>
                )}
                <h2 style={{ margin: 0, color: '#ff4500', fontSize: '1.5rem', whiteSpace: 'nowrap' }}>€{plato.precio?.toFixed(2)}</h2>
              </div>
            </div>
            
            {/* ETIQUETAS (OPCIONALES) */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {tagsTotales.filter(tag => !OPCIONES_CATEGORIAS.includes(tag)).map(cat => (
                <span key={cat} style={{ fontSize: '11px', background: '#e3f2fd', color: '#0066cc', padding: '4px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {cat}
                </span>
              ))}
            </div>
            
            {/* 3. DESCRIPCIÓN DEL PLATO */}
            <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '1rem', fontSize: '1.05rem' }}>
              {descLimpia || "Un plato delicioso preparado con los mejores ingredientes."}
            </p>

            {/* CARRUSEL DE RECOMENDADOS */}
            {platosRecomendados.length > 0 && (
              <div style={{ marginTop: '2rem', marginBottom: '1.5rem', borderTop: '1px solid #eaeaea', paddingTop: '1.5rem' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#333', margin: 0 }}>Frecuentemente comprados juntos</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => scrollRecomendados(-200)}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #eaeaea', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <button 
                      onClick={() => scrollRecomendados(200)}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #eaeaea', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </div>
                </div>
                
                <div ref={scrollRef} className="ocultar-scrollbar" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px', scrollBehavior: 'smooth' }}>
                  <style>{`.ocultar-scrollbar::-webkit-scrollbar { display: none; } .ocultar-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                  
                  {platosRecomendados.map(recomendado => {
                    const extraTagsRec = extraerTags(recomendado.descripcion, recomendado.categoria);
                    const estaAgotado = recomendado.disponible === false;
                    
                    return (
                    <div 
                      key={recomendado.id_plato} 
                      style={{ 
                        minWidth: '140px', maxWidth: '140px', border: '1px solid #eaeaea', borderRadius: '10px', padding: '10px', 
                        display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#fafafa', opacity: estaAgotado ? 0.6 : 1 
                      }}
                    >
                      {recomendado.imagen_url ? (
                        <img 
                          src={recomendado.imagen_url} 
                          alt={recomendado.nombre} 
                          style={{ ...estiloImagenAltaCalidad, height: '80px', borderRadius: '6px' }} 
                        />
                      ) : (
                        <div style={{ width: '100%', height: '80px', backgroundColor: '#eee', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🍽️</div>
                      )}
                      
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#333', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {recomendado.nombre}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#0066cc', fontWeight: 'bold' }}>€{recomendado.precio.toFixed(2)}</span>
                          {extraTagsRec.precioAnterior && extraTagsRec.precioAnterior > recomendado.precio && (
                            <span style={{ fontSize: '10px', color: '#999', textDecoration: 'line-through' }}>€{extraTagsRec.precioAnterior.toFixed(2)}</span>
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