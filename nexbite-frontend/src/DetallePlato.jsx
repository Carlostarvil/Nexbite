import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

const OBTENER_NOMBRE_RESTAURANTE = gql`
  query ObtenerNombreRestaurante($id: ID!) {
    obtenerRestaurantePorId(id_restaurante: $id) {
      id_restaurante
      nombre
    }
  }
`;

export default function DetallePlato({ plato, onVolver, onAgregarAlCarrito, onIrARestaurante }) {
  
  const { data } = useQuery(OBTENER_NOMBRE_RESTAURANTE, {
    variables: { id: plato.id_restaurante },
    skip: !plato.id_restaurante || !!plato.nombre_restaurante 
  });

  const nombreLocal = plato.nombre_restaurante || data?.obtenerRestaurantePorId?.nombre || "Cargando local...";

  return (
    // CONTENEDOR DEL FONDO OSCURO TRANSLÚCIDO (z-index alto para estar encima de todo)
    <div 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}
      onClick={onVolver} // Si hace clic fuera del plato, se cierra
    >
      
      {/* LA TARJETA BLANCA DEL PLATO (Usamos stopPropagation para que al clicar dentro no se cierre) */}
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
      >
        
        {/* BOTÓN DE CERRAR FLOTANTE */}
        <button 
          onClick={onVolver} 
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
        >
          ❌
        </button>
        
        {plato.imagen_url ? (
          <img src={plato.imagen_url} alt={plato.nombre} style={{ width: '100%', height: '250px', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '250px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>🍽️</div>
        )}
        
        <div style={{ padding: '2rem' }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '1.8rem' }}>{plato.nombre}</h1>
          <h2 style={{ margin: '0 0 15px 0', color: '#ff4500', fontSize: '1.5rem' }}>€{plato.precio?.toFixed(2)}</h2>
          
          {onIrARestaurante && plato.id_restaurante && (
            <button 
              onClick={() => onIrARestaurante(plato.id_restaurante)}
              style={{ background: '#e6f2ff', color: '#0066cc', border: 'none', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#cce5ff'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e6f2ff'}
            >
              🏪 {nombreLocal}
            </button>
          )}
          
          <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '2rem', fontSize: '1.05rem' }}>
            {plato.descripcion || "Un plato delicioso preparado con los mejores ingredientes, directamente a tu puerta."}
          </p>
          
          <button 
            onClick={() => {
              onAgregarAlCarrito(plato);
              onVolver(); 
            }}
            style={{ width: '100%', padding: '1.2rem', background: '#00cc66', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 10px rgba(0, 204, 102, 0.3)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#00b359'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00cc66'}
          >
            Añadir al Carrito - €{plato.precio?.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}