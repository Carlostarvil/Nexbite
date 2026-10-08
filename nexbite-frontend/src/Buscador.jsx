import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { coordenadasValidas } from '../../shared/zonaEntrega.js';
import './Buscador.css';

const BUSCAR_RESTAURANTES = gql`
  query BuscarRestaurantes($termino: String!, $latitud: Float!, $longitud: Float!, $solo_con_entrega: Boolean!) {
    buscarRestaurantes(termino: $termino, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_restaurante nombre tipo imagen_url }
  }
`;

const BUSCAR_PLATOS = gql`
  query BuscarPlatos($termino: String!, $latitud: Float!, $longitud: Float!, $solo_con_entrega: Boolean!) {
    buscarPlatos(termino: $termino, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_plato id_restaurante nombre descripcion precio imagen_url }
  }
`;

export default function Buscador({ onSelectRestaurante, onSelectPlato, ubicacionEntrega, modoEntrega }) {
  const [tipoBusqueda, setTipoBusqueda] = useState('RESTAURANTES');
  const [termino, setTermino] = useState('');
  const [terminoConsultado, setTerminoConsultado] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const contenedor = useRef(null);
  const input = useRef(null);
  const lista = useRef(null);
  const id = useId();
  const listaId = id + '-resultados';
  const texto = termino.trim();
  const tieneUbicacion = coordenadasValidas(ubicacionEntrega?.lat, ubicacionEntrega?.lng);
  const terminoListo = texto.length >= 2 && texto === terminoConsultado;

  useEffect(() => {
    const temporizador = setTimeout(() => setTerminoConsultado(termino.trim()), 250);
    return () => clearTimeout(temporizador);
  }, [termino]);

  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = evento => {
      if (!contenedor.current?.contains(evento.target)) setAbierto(false);
    };
    document.addEventListener('pointerdown', cerrarFuera);
    return () => document.removeEventListener('pointerdown', cerrarFuera);
  }, [abierto]);

  const opcionesConsulta = {
    variables: { termino: terminoConsultado, latitud: ubicacionEntrega?.lat, longitud: ubicacionEntrega?.lng, solo_con_entrega: modoEntrega === 'DOMICILIO' },
    skip: !abierto || !terminoListo || !tieneUbicacion,
    fetchPolicy: 'network-only',
  };
  const locales = useQuery(BUSCAR_RESTAURANTES, { ...opcionesConsulta, skip: opcionesConsulta.skip || tipoBusqueda !== 'RESTAURANTES' });
  const platos = useQuery(BUSCAR_PLATOS, { ...opcionesConsulta, skip: opcionesConsulta.skip || tipoBusqueda !== 'PLATOS' });
  const consulta = tipoBusqueda === 'RESTAURANTES' ? locales : platos;
  const cargando = texto.length >= 2 && (!terminoListo || consulta.loading);
  const error = terminoListo && consulta.error;
  const resultados = terminoListo && !cargando && !error
    ? (tipoBusqueda === 'RESTAURANTES' ? locales.data?.buscarRestaurantes : platos.data?.buscarPlatos) || []
    : [];
  const indiceValido = indiceActivo >= 0 && indiceActivo < resultados.length;

  useEffect(() => {
    if (abierto) lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [abierto, indiceActivo, resultados.length]);

  const seleccionar = resultado => {
    setAbierto(false);
    setTermino('');
    setIndiceActivo(-1);
    if (tipoBusqueda === 'RESTAURANTES') onSelectRestaurante(resultado.id_restaurante);
    else onSelectPlato(resultado);
  };

  const manejarTeclado = evento => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      setAbierto(false);
      setIndiceActivo(-1);
    } else if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      setAbierto(true);
      if (resultados.length) setIndiceActivo(anterior => evento.key === 'ArrowDown'
        ? (anterior + 1) % resultados.length
        : anterior < 0 ? resultados.length - 1 : (anterior - 1 + resultados.length) % resultados.length);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      if (abierto && resultados.length) seleccionar(resultados[indiceValido ? indiceActivo : 0]);
      else setAbierto(true);
    }
  };

  return (
    <form ref={contenedor} className="buscador" role="search" aria-label="Buscar locales y platos/productos"
      onSubmit={evento => evento.preventDefault()}
      onBlur={evento => { if (!evento.currentTarget.contains(evento.relatedTarget)) setAbierto(false); }}>
      <div className="buscador-campo">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input ref={input} type="search" role="combobox" aria-label="Buscar en NexBite" aria-autocomplete="list" aria-haspopup="listbox"
          aria-expanded={abierto} aria-controls={abierto ? listaId : undefined} aria-activedescendant={abierto && indiceValido ? listaId + '-' + indiceActivo : undefined}
          autoComplete="off" disabled={!tieneUbicacion} placeholder="Buscar en NexBite" title={tieneUbicacion ? undefined : 'Selecciona una ubicación para buscar'}
          value={termino} onChange={evento => { setTermino(evento.target.value); setIndiceActivo(-1); setAbierto(true); }}
          onFocus={() => setAbierto(true)} onClick={() => setAbierto(true)} onKeyDown={manejarTeclado} />
        {termino && <button type="button" className="buscador-limpiar" aria-label="Limpiar búsqueda" title="Limpiar búsqueda"
          onClick={() => { setTermino(''); setIndiceActivo(-1); setAbierto(true); input.current?.focus(); }}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>}
      </div>

      {abierto && tieneUbicacion && <div className="buscador-panel">
        <div className="buscador-tipos" role="group" aria-label="Tipo de búsqueda">
          <button type="button" aria-pressed={tipoBusqueda === 'RESTAURANTES'} onClick={() => { setTipoBusqueda('RESTAURANTES'); setIndiceActivo(-1); }}>Locales</button>
          <button type="button" aria-pressed={tipoBusqueda === 'PLATOS'} onClick={() => { setTipoBusqueda('PLATOS'); setIndiceActivo(-1); }}>Platos/productos</button>
        </div>
        {texto.length < 2 ? <p className="buscador-mensaje">Escribe al menos 2 letras para buscar.</p>
          : cargando ? <p className="buscador-mensaje" role="status">Buscando…</p>
          : error ? <div className="buscador-mensaje buscador-error" role="alert">No se pudo completar la búsqueda. <button type="button" onClick={() => consulta.refetch().catch(() => {})}>Reintentar</button></div>
          : resultados.length === 0 && <p className="buscador-mensaje" role="status">No hay {tipoBusqueda === 'RESTAURANTES' ? 'locales' : 'platos/productos'} para «{texto}» en esta ubicación.</p>}

        <ul ref={lista} id={listaId} className="buscador-resultados" role="listbox" aria-label={tipoBusqueda === 'RESTAURANTES' ? 'Locales encontrados' : 'Platos/productos encontrados'} hidden={resultados.length === 0}>
          {resultados.map((resultado, indice) => <li key={tipoBusqueda === 'RESTAURANTES' ? resultado.id_restaurante : resultado.id_plato}
            id={listaId + '-' + indice} role="option" aria-selected={indiceActivo === indice}
            onMouseDown={evento => evento.preventDefault()} onClick={() => seleccionar(resultado)} onMouseMove={() => setIndiceActivo(indice)}>
            {resultado.imagen_url ? <img src={resultado.imagen_url} alt="" className="buscador-foto" />
              : <span className="buscador-foto buscador-foto-vacia" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10v10h16V10M3 10l2-6h14l2 6M8 20v-6h4v6M3 10a3 3 0 0 0 4.5 2.5A3 3 0 0 0 12 12a3 3 0 0 0 4.5.5A3 3 0 0 0 21 10" /></svg></span>}
            <span className="buscador-resultado-texto"><strong>{resultado.nombre}</strong><span>{tipoBusqueda === 'RESTAURANTES' ? resultado.tipo : 'Ver detalles del plato/producto'}</span></span>
            {tipoBusqueda === 'PLATOS' && resultado.precio != null && <span className="buscador-precio">{Number(resultado.precio).toFixed(2)}&nbsp;€</span>}
          </li>)}
        </ul>
      </div>}
    </form>
  );
}
