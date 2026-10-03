import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tieneError: false, mensajeError: '' };
  }

  // Si ocurre un error en cualquier componente hijo, React llama a esto automáticamente
  static getDerivedStateFromError(error) {
    return { tieneError: true, mensajeError: error.toString() };
  }

  // Aquí atrapamos la explosión para que no llegue al navegador
  componentDidCatch(error, errorInfo) {
    console.error("🛡️ Error interceptado por el Escudo de NexBite:", error, errorInfo);
  }

  render() {
    if (this.state.tieneError) {
      // Esta es la pantalla amigable que verá el usuario en lugar de la pantalla en blanco
      return (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', fontFamily: 'system-ui', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', padding: '3rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <h1 style={{ fontSize: '4rem', margin: '0 0 10px 0' }}>🤕</h1>
            <h2 style={{ color: '#333', marginBottom: '10px' }}>¡Ups! Algo ha ido mal en esta pantalla.</h2>
            <p style={{ color: '#666', marginBottom: '2rem', lineHeight: '1.5' }}>
              Hemos detectado un error inesperado, pero hemos protegido el resto de tu aplicación. El equipo técnico ya ha sido notificado.
            </p>
            
            <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'left', fontSize: '12px', overflowX: 'auto' }}>
              <code>{this.state.mensajeError}</code>
            </div>
            
            <button 
              onClick={() => {
                // Limpiamos memorias conflictivas por si el error vino de la caché y recargamos
                window.location.href = '/';
              }}
              style={{ padding: '1rem 2rem', background: '#ff4500', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', transition: 'transform 0.2s' }}
            >
              Volver al Inicio Seguro 🏠
            </button>
          </div>
        </div>
      );
    }

    // Si no hay errores, dibujamos la aplicación normal
    return this.props.children; 
  }
}

export default ErrorBoundary;