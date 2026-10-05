import './MensajeAccion.css';

export function IconoEstado({ tipo = 'info', tamano = 24 }) {
  return <svg viewBox="0 0 24 24" width={tamano} height={tamano} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={tipo === 'cargando' ? 'icono-girando' : undefined} aria-hidden="true" focusable="false">
    {tipo === 'cargando' ? <><circle cx="12" cy="12" r="9" opacity=".2" /><path d="M12 3a9 9 0 0 1 9 9" /></>
      : tipo === 'aviso' ? <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4m0 4h.01" /></>
      : <><circle cx="12" cy="12" r="9" />{tipo === 'exito' ? <path d="m7.5 12 3 3 6-6" /> : tipo === 'error' ? <path d="m9 9 6 6m-6 0 6-6" /> : <path d="M12 11v6m0-10h.01" />}</>}
  </svg>;
}

export default function MensajeAccion({ mensaje, onCerrar }) {
  if (!mensaje) return null;
  const { tipo = 'info', titulo, descripcion } = mensaje;
  return <div className={'mensaje-accion mensaje-accion-' + tipo} role={tipo === 'error' || tipo === 'aviso' ? 'alert' : 'status'} aria-atomic="true">
    <span className="mensaje-accion-icono"><IconoEstado tipo={tipo} /></span>
    <div className="mensaje-accion-texto"><strong>{titulo}</strong>{descripcion && <p>{descripcion}</p>}</div>
    {onCerrar && <button type="button" className="mensaje-accion-cerrar" onClick={onCerrar} aria-label="Cerrar mensaje">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
    </button>}
  </div>;
}
