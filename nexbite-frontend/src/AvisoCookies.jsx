import { useState, useEffect } from 'react';

export default function AvisoCookies() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const cookiesAceptadas = localStorage.getItem('nexbite_cookies_consent');
    if (!cookiesAceptadas) {
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

          
  /* 
    ============================================================================
    LA ILUSIÓN DEL BOTÓN FÍSICO (onMouseDown)
    
    ¿QUÉ ES 'onMouseDown'?: 
    A diferencia de 'onClick' (que espera a que termines de soltar el clic), 
    'onMouseDown' se activa en el microsegundo exacto en el que aprietas 
    el botón hacia abajo. Es la primera mitad de un clic.

    ¿QUÉ HACE EL CÓDIGO? {e => e.currentTarget.style.transform = 'scale(0.95)'}:
    - 'e.currentTarget': Agarra físicamente este botón exacto.
    - 'style.transform = scale(0.95)': Le inyecta una regla CSS matemática. Le 
      dice: "Encógete y hazte un 5% más pequeño de tu tamaño original".

    EL PROPÓSITO (Feedback visual):
    Al reducir el tamaño al apretar, engaña al ojo dándole la sensación 
    de "peso" y "profundidad". Te hace sentir que realmente estás empujando 
    un botón físico hacia adentro de la pantalla.
    ============================================================================
  */

          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Aceptar y continuar
        </button>
      </div>
    </div>
  );
}