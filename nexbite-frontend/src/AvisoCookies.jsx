import { useState, useEffect } from 'react';

export default function AvisoCookies() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    // Comprobamos si el usuario ya ha aceptado las cookies previamente
    const cookiesAceptadas = localStorage.getItem('nexbite_cookies_consent');
    if (!cookiesAceptadas) {
      // Le damos un pequeño retraso de 1 segundo antes de aparecer para que sea más elegante
      const timer = setTimeout(() => setMostrar(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const aceptarCookies = () => {
    localStorage.setItem('nexbite_cookies_consent', 'aceptadas');
    setMostrar(false);
  };

  const rechazarCookies = () => {
    localStorage.setItem('nexbite_cookies_consent', 'rechazadas');
    setMostrar(false);
  };

  if (!mostrar) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 40px)',
      maxWidth: '800px',
      backgroundColor: '#fff',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      borderRadius: '16px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      zIndex: 9999,
      border: '1px solid #eaeaea',
      animation: 'subirBanner 0.5s ease-out'
    }}>
      <style>
        {`
          @keyframes subirBanner {
            from { transform: translate(-50%, 100px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
          }
        `}
      </style>

      <div>
        <h3 style={{ margin: '0 0 8px 0', color: '#333', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🍪 Tu privacidad es importante
        </h3>
        <p style={{ margin: 0, color: '#666', fontSize: '0.95rem', lineHeight: '1.5' }}>
          Utilizamos cookies propias y de terceros (como Stripe y mapas) para garantizar el funcionamiento seguro de los pagos, personalizar tu experiencia y analizar el tráfico de nuestra plataforma.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button 
          onClick={rechazarCookies}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            color: '#666',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          Rechazar no esenciales
        </button>
        <button 
          onClick={aceptarCookies}
          style={{
            padding: '10px 24px',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'transform 0.1s'
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Aceptar y continuar
        </button>
      </div>
    </div>
  );
}