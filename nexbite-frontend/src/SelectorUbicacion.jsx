import { useEffect, useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import './UbicacionEntrega.css';

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

  useEffect(() => {
    const focoAnterior = document.activeElement;
    entrada.current?.focus();
    return () => {
      solicitud.current += 1;
      if (focoAnterior?.isConnected) focoAnterior.focus();
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
    <section ref={contenedor} className="ubicacion-selector" onKeyDown={controlarTeclado} aria-labelledby="titulo-ubicacion">
      <h2 id="titulo-ubicacion">¿Dónde quieres recibir tu pedido?</h2>
      <p>Selecciona tu dirección para ver los locales que entregan allí. También podrás elegir recogida.</p>
      <button type="button" className="ubicacion-boton ubicacion-gps" onClick={usarGPS} disabled={Boolean(estado)}>
        {estado === 'GPS' ? 'Localizando…' : '📍 Usar mi ubicación actual'}
      </button>
      <form onSubmit={buscar}>
        <label htmlFor="direccion-entrega">Calle, número y ciudad</label>
        <div className="ubicacion-busqueda">
          <input ref={entrada} id="direccion-entrega" value={texto} maxLength={200} placeholder="Ej. Gran Vía 12, Madrid" onChange={event => {
            solicitud.current += 1;
            setTexto(event.target.value);
            setCandidato(null);
            setResultados([]);
            setEstado('');
            setError('');
          }} />
          <button type="submit" className="ubicacion-boton" disabled={Boolean(estado)}>{estado === 'BUSCANDO' ? 'Buscando…' : 'Buscar dirección'}</button>
        </div>
      </form>
      {error && <p role="alert" className="ubicacion-error">{error}</p>}
      {resultados.length > 0 && <ul className="ubicacion-resultados" aria-label="Direcciones encontradas">
        {resultados.map((resultado, index) => <li key={`${resultado.lat}-${resultado.lng}-${index}`}>
          <button type="button" onClick={() => { setCandidato(resultado); setTexto(resultado.direccion); setResultados([]); }}>{resultado.direccion}</button>
        </li>)}
      </ul>}
      {candidato && <div className="ubicacion-confirmacion" role="status"><strong>Dirección seleccionada</strong><p>{candidato.direccion}</p><small>Comprueba que la calle y el número sean correctos.</small></div>}
      <div className="ubicacion-acciones">
        {onCancelar && <button type="button" className="ubicacion-boton ubicacion-secundario" onClick={onCancelar}>Cancelar</button>}
        <button type="button" className="ubicacion-boton" disabled={!candidato || Boolean(estado)} onClick={() => onConfirmar({ direccion: candidato.direccion, lat: candidato.lat, lng: candidato.lng })}>Usar esta dirección</button>
      </div>
    </section>
  );
}
