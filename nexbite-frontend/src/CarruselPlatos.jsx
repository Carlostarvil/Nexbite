import { useRef } from 'react';
import BotonAgregarCarrito from './BotonAgregarCarrito';

export default function CarruselPlatos({ titulo, platos, onSelectPlato, onAgregarAlCarrito }) {
  const scrollRef = useRef(null);

  // Paset a mangkontrol iti panag-scroll
  const scroll = (desplazamiento) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: desplazamiento, behavior: 'smooth' });
    }
  };

  if (!platos || platos.length === 0) return null;

  return (
    <div style={{ marginBottom: '2.5rem', position: 'relative' }}>
      {/* CSS tapno mailemmeng ti default a scrollbar */}
      <style>
        {`
          .ocultar-scrollbar::-webkit-scrollbar { display: none; }
          .ocultar-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}
      </style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ff4500', paddingBottom: '10px', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#333', margin: 0 }}>
          ⭐ {titulo}
        </h2>
        
        {/* Dagiti napindut a palaso (Clickable arrows) */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => scroll(-300)} 
            style={{ width: '35px', height: '35px', borderRadius: '50%', border: '1px solid #ccc', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            ←
          </button>
          <button 
            onClick={() => scroll(300)} 
            style={{ width: '35px', height: '35px', borderRadius: '50%', border: '1px solid #ccc', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            →
          </button>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="ocultar-scrollbar"
        style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '15px', scrollBehavior: 'smooth' }}
      >
        {platos.map(plato => (
          <div 
            key={plato.id_plato} 
            onClick={() => onSelectPlato(plato)}
            style={{ minWidth: '220px', maxWidth: '220px', backgroundColor: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; }}
          >
            {plato.imagen_url ? (
              <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '140px', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🍽️</div>
            )}
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '15px' }}>{plato.nombre}</h4>
              
              {plato.nombre_restaurante && <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>De: {plato.nombre_restaurante}</p>}
              
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#0066cc', fontSize: '1.1rem' }}>€{plato.precio?.toFixed(2)}</span>
                <BotonAgregarCarrito onAgregar={() => onAgregarAlCarrito(plato)} nombrePlato={plato.nombre} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
