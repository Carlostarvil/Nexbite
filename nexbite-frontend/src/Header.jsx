// AÑADIDO: onAbrirPerfil en las propiedades
export default function Header({ onInicio, onLogout, cantidadCarrito, onAbrirCarrito, userRol, onAbrirFavoritos, onAbrirPerfil }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', backgroundColor: '#ff4500', color: 'white' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h2 style={{ margin: 0, cursor: 'pointer' }} onClick={onInicio}>
          NexBite
        </h2>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        
        {userRol !== 'VENDEDOR' && (
          <>
            <button onClick={onAbrirFavoritos} style={btnStyle}>❤️ Favoritos</button>
            <button onClick={onAbrirCarrito} style={btnStyle}>
              🛒 Carrito ({cantidadCarrito})
            </button>
          </>
        )}
        
        {/* NUEVO: Botón de Mi Perfil para todos los usuarios */}
        <button onClick={onAbrirPerfil} style={{ ...btnStyle, backgroundColor: '#0066cc' }}>
          👤 Mi Perfil
        </button>

        <button onClick={onLogout} style={{ ...btnStyle, backgroundColor: '#d63031' }}>
          Cerrar Sesión
        </button>

      </div>
    </header>
  );
}

const btnStyle = { 
  background: 'rgba(255,255,255,0.2)', 
  border: 'none', 
  color: 'white', 
  padding: '8px 15px', 
  borderRadius: '20px', 
  cursor: 'pointer', 
  fontWeight: 'bold',
  transition: 'background 0.2s ease'
};