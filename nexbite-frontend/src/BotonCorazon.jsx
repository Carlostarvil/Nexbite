import './BotonCorazon.css';

export default function BotonCorazon({ activo = false, onClick, disabled = false, nombre }) {
  const accion = activo ? 'Quitar de favoritos' : 'Añadir a favoritos';

  return (
    <button type="button" className={'boton-corazon' + (activo ? ' es-favorito' : '')}
      disabled={disabled} aria-pressed={Boolean(activo)} aria-label={nombre ? accion + ': ' + nombre : accion}
      title={accion} onClick={event => { event.stopPropagation(); onClick(event); }}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill={activo ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    </button>
  );
}
