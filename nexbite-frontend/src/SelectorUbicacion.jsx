import { useEffect, useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

const BUSCAR_DIRECCIONES = gql`
  query BuscarDirecciones($termino: String!) {
    buscarDirecciones(termino: $termino) { direccion lat lng }
  }
`;
const DIRECCION_GPS = gql`
  query DireccionGPS($latitud: Float!, $longitud: Float!) {
    obtenerDireccionUbicacion(latitud: $latitud, longitud: $longitud) { direccion lat lng }
  }
`;

export default function SelectorUbicacion({ ubicacion, onConfirmar, onCancelar }) {
  const client = useApolloClient();
  const [texto, setTexto] = useState(ubicacion?.direccion || '');
  const [candidato, setCandidato] = useState(ubicacion || null);
  const [resultados, setResultados] = useState([]);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const solicitud = useRef(0);
  const contenedor = useRef(null);
  const entrada = useRef(null);

  // Efecto para hacer focus y BLOQUEAR EL SCROLL DE LA PÁGINA
  useEffect(() => {
    const focoAnterior = document.activeElement;
    entrada.current?.focus();
    
    // Bloquear scroll de la web mientras está abierto
    document.body.style.overflow = 'hidden';
    
    return () => {
      solicitud.current += 1;
      if (focoAnterior?.isConnected) focoAnterior.focus();
      // Restaurar scroll al cerrar
      document.body.style.overflow = 'auto';
    };
  }, []);

  const buscar = async event => {
    event.preventDefault();
    if (texto.trim().length < 4) return setError('Escribe la calle, el número y la ciudad.');
    const version = ++solicitud.current;
    setEstado('BUSCANDO');
    setError('');
    setCandidato(null);
    setResultados([]);
    try {
      const { data } = await client.query({ query: BUSCAR_DIRECCIONES, variables: { termino: texto.trim() }, fetchPolicy: 'network-only' });
      if (version !== solicitud.current) return;
      const direcciones = data?.buscarDirecciones || [];
      setResultados(direcciones);
      if (!direcciones.length) setError('No encontramos esa dirección. Añade la ciudad o prueba otra búsqueda.');
    } catch {
      if (version === solicitud.current) setError('No se pudo buscar la dirección. Inténtalo de nuevo.');
    } finally {
      if (version === solicitud.current) setEstado('');
    }
  };

  const usarGPS = async () => {
    if (!navigator.geolocation) return setError('Tu navegador no permite obtener la ubicación. Escribe tu dirección.');
    const version = ++solicitud.current;
    setEstado('GPS');
    setError('');
    setResultados([]);
    setCandidato(null);
    try {
      const posicion = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }));
      if (version !== solicitud.current) return;
      const { latitude: latitud, longitude: longitud } = posicion.coords;
      const { data } = await client.query({ query: DIRECCION_GPS, variables: { latitud, longitud }, fetchPolicy: 'network-only' });
      if (version !== solicitud.current) return;
      if (!data?.obtenerDireccionUbicacion) throw new Error('SIN_DIRECCION');
      const direccion = { ...data.obtenerDireccionUbicacion, lat: latitud, lng: longitud };
      setCandidato(direccion);
      setTexto(direccion.direccion);
    } catch (fallo) {
      if (version === solicitud.current) setError(fallo.code === 1
        ? 'No has permitido usar tu ubicación. Puedes escribir tu dirección.'
        : 'No pudimos localizar tu dirección. Puedes escribirla y buscarla.');
    } finally {
      if (version === solicitud.current) setEstado('');
    }
  };

  const controlarTeclado = event => {
    if (event.key === 'Escape' && onCancelar) onCancelar();
    if (event.key !== 'Tab' || !onCancelar) return;
    const elementos = [...contenedor.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
    const primero = elementos[0];
    const ultimo = elementos.at(-1);
    if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo?.focus(); }
    else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero?.focus(); }
  };

  return (
    // 1. Overlay (Fondo oscuro fijo que cubre toda la pantalla)
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      backdropFilter: 'blur(4px)' // Efecto premium de desenfoque de fondo
    }}>
      
      {/* 2. Tarjeta Modal ampliada */}
      <section 
        ref={contenedor} 
        onKeyDown={controlarTeclado} 
        aria-labelledby="titulo-ubicacion"
        style={{
          background: '#fff',
          borderRadius: '24px',
          padding: '3rem', /* Más margen interno */
          maxWidth: '650px', /* Más ancha */
          width: '100%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          fontFamily: 'system-ui',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto' // Por si la pantalla es muy pequeña
        }}
      >
        {onCancelar && (
          <button 
            onClick={onCancelar} 
            title="Cerrar"
            style={{ position: 'absolute', top: '24px', right: '24px', background: '#f5f5f5', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e0e0e0'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
          >×</button>
        )}

        <h2 id="titulo-ubicacion" style={{ margin: '0 0 10px 0', color: '#1a1a1a', fontSize: '1.8rem' }}>
          ¿Dónde quieres recibir tu pedido?
        </h2>
        <p style={{ color: '#666', fontSize: '15px', marginBottom: '30px', lineHeight: '1.6' }}>
          Selecciona tu dirección para ver los locales que entregan allí. También podrás elegir recoger en tienda más adelante.
        </p>

        <button 
          type="button" 
          onClick={usarGPS} 
          disabled={Boolean(estado)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
            backgroundColor: '#ff4500', color: '#fff', fontSize: '16px', fontWeight: 'bold',
            cursor: estado ? 'not-allowed' : 'pointer', opacity: estado ? 0.7 : 1,
            transition: 'all 0.2s', marginBottom: '30px'
          }}
          onMouseEnter={(e) => !estado && (e.currentTarget.style.backgroundColor = '#e63e00')}
          onMouseLeave={(e) => !estado && (e.currentTarget.style.backgroundColor = '#ff4500')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          {estado === 'GPS' ? 'Localizando tu posición...' : 'Usar mi ubicación actual'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '25px 0', color: '#999' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#eaeaea' }}></div>
          <span style={{ padding: '0 15px', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>O BUSCA TU DIRECCIÓN</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#eaeaea' }}></div>
        </div>

        <form onSubmit={buscar}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </span>
              <input 
                ref={entrada} 
                value={texto} 
                maxLength={200} 
                placeholder="Ej. Gran Vía 12, Madrid" 
                onChange={event => {
                  solicitud.current += 1;
                  setTexto(event.target.value);
                  setCandidato(null);
                  setResultados([]);
                  setEstado('');
                  setError('');
                }}
                style={{
                  width: '100%', padding: '16px 16px 16px 48px', borderRadius: '12px',
                  border: '2px solid #eaeaea', fontSize: '16px', boxSizing: 'border-box',
                  outline: 'none', transition: 'border-color 0.2s', backgroundColor: '#fafafa'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#ff4500'; e.target.style.backgroundColor = '#fff'; }}
                onBlur={(e) => { e.target.style.borderColor = '#eaeaea'; e.target.style.backgroundColor = '#fafafa'; }}
              />
            </div>
            <button 
              type="submit" 
              disabled={Boolean(estado) || texto.length < 4}
              style={{
                padding: '0 25px', borderRadius: '12px', border: 'none',
                backgroundColor: '#333', color: '#fff', fontWeight: 'bold', fontSize: '15px',
                cursor: (estado || texto.length < 4) ? 'not-allowed' : 'pointer', 
                opacity: (estado || texto.length < 4) ? 0.6 : 1,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => !(estado || texto.length < 4) && (e.currentTarget.style.backgroundColor = '#1a1a1a')}
              onMouseLeave={(e) => !(estado || texto.length < 4) && (e.currentTarget.style.backgroundColor = '#333')}
            >
              {estado === 'BUSCANDO' ? 'Buscando' : 'Buscar'}
            </button>
          </div>
        </form>

        {error && <p role="alert" style={{ color: '#d63031', fontSize: '14px', marginTop: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚠️ {error}
        </p>}

        {resultados.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0 0', border: '1px solid #eee', borderRadius: '12px', maxHeight: '220px', overflowY: 'auto' }}>
            {resultados.map((resultado, index) => (
              <li key={`${resultado.lat}-${resultado.lng}-${index}`}>
                <button 
                  type="button" 
                  onClick={() => { setCandidato(resultado); setTexto(resultado.direccion); setResultados([]); }}
                  style={{
                    width: '100%', padding: '16px', textAlign: 'left', border: 'none',
                    background: '#fff', borderBottom: index < resultados.length - 1 ? '1px solid #eee' : 'none',
                    cursor: 'pointer', fontSize: '15px', color: '#444', transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  📍 {resultado.direccion}
                </button>
              </li>
            ))}
          </ul>
        )}

        {candidato && (
          <div style={{ margin: '25px 0', padding: '18px', backgroundColor: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              {/* SVG de check en lugar del emoji */}
              <div style={{ color: '#166534', flexShrink: 0, marginTop: '2px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div>
                <strong style={{ color: '#166534', display: 'block', fontSize: '15px', marginBottom: '4px' }}>Dirección seleccionada</strong>
                <p style={{ margin: 0, color: '#14532d', fontSize: '16px', fontWeight: 'bold' }}>{candidato.direccion}</p>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '15px', marginTop: '35px' }}>
          {onCancelar && (
            <button 
              type="button" 
              onClick={onCancelar}
              style={{
                flex: 1, padding: '16px', borderRadius: '12px', border: '2px solid #eee',
                backgroundColor: '#fff', color: '#555', fontWeight: 'bold', fontSize: '16px',
                cursor: 'pointer', transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
            >
              Cancelar
            </button>
          )}
          <button 
            type="button" 
            disabled={!candidato || Boolean(estado)} 
            onClick={() => onConfirmar({ direccion: candidato.direccion, lat: candidato.lat, lng: candidato.lng })}
            style={{
              flex: 2, padding: '16px', borderRadius: '12px', border: 'none',
              backgroundColor: '#16864a', color: '#fff', fontWeight: 'bold', fontSize: '16px',
              cursor: (!candidato || estado) ? 'not-allowed' : 'pointer',
              opacity: (!candidato || estado) ? 0.5 : 1, transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => !(!candidato || estado) && (e.currentTarget.style.backgroundColor = '#106e3b')}
            onMouseLeave={(e) => !(!candidato || estado) && (e.currentTarget.style.backgroundColor = '#16864a')}
          >
            Confirmar dirección
          </button>
        </div>
      </section>
    </div>
  );
}