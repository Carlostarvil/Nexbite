import './BotonCorazon.css';
import IconoCorazon from './IconoCorazon';

export default function BotonCorazon({ activo = false, onClick, disabled = false, nombre }) {
  const accion = activo ? 'Quitar de favoritos' : 'Añadir a favoritos';

  return (
    <button type="button" className={'boton-corazon' + (activo ? ' es-favorito' : '')}
      disabled={disabled} aria-pressed={Boolean(activo)} aria-label={nombre ? accion + ': ' + nombre : accion}
      title={accion} onClick={event => { event.stopPropagation(); onClick(event); }}>
      <IconoCorazon relleno={activo} />
    </button>
  );
}
