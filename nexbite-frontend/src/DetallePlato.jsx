import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import BotonAgregarCarrito from './BotonAgregarCarrito';

const OBTENER_NOMBRE_RESTAURANTE = gql`
  query ObtenerNombreRestaurante($id: ID!) {
    obtenerRestaurantePorId(id_restaurante: $id) {
      id_restaurante
      nombre
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

export default function DetallePlato({ plato, onVolver, onAgregarAlCarrito, onIrARestaurante }) {
  
  const { data } = useQuery(OBTENER_NOMBRE_RESTAURANTE, {
    variables: { id: plato.id_restaurante },
    skip: !plato.id_restaurante || !!plato.nombre_restaurante 
  });

  const [animandoExito, setAnimandoExito] = useState(false);
  const cierrePendiente = useRef(null);
  useEffect(() => () => clearTimeout(cierrePendiente.current), []);

  const nombreLocal = plato.nombre_restaurante || data?.obtenerRestaurantePorId?.nombre || "Cargando local...";
  
  const { descLimpia, tagsTotales } = extraerTags(plato.descripcion, plato.categoria);

  const handleAgregarClick = () => {
    if (onAgregarAlCarrito(plato) === false) return false;
    setAnimandoExito(true);
    cierrePendiente.current = setTimeout(onVolver, 900);
  };

  return (
    <div className="detalle-plato-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }} onClick={onVolver}>
      
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        
        <button onClick={onVolver} style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>❌</button>
        
        {plato.imagen_url ? (
          <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '250px', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '250px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>🍽️</div>
        )}
        
        <div style={{ padding: '2rem' }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '1.8rem' }}>{plato.nombre}</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, color: '#ff4500', fontSize: '1.5rem' }}>€{plato.precio?.toFixed(2)}</h2>
            
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {tagsTotales.filter(tag => !OPCIONES_CATEGORIAS.includes(tag)).map(cat => (
                <span key={cat} style={{ fontSize: '12px', background: '#e3f2fd', color: '#0066cc', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {cat}
                </span>
              ))}
            </div>
          </div>
          
          {onIrARestaurante && plato.id_restaurante && (
            <button onClick={() => onIrARestaurante(plato.id_restaurante)} style={{ background: '#e6f2ff', color: '#0066cc', border: 'none', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              🏪 {nombreLocal}
            </button>
          )}
          
          <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '2rem', fontSize: '1.05rem' }}>
            {descLimpia || "Un plato delicioso preparado con los mejores ingredientes."}
          </p>
          
          <BotonAgregarCarrito onAgregar={handleAgregarClick} idPlato={plato.id_plato} nombrePlato={plato.nombre} variante="detalle" disabled={animandoExito} />

        </div>
      </div>
    </div>
  );
}
