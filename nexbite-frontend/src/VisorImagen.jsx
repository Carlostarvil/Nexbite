import { useEffect, useRef } from 'react';
import ImagenPortada from './ImagenPortada';
import './VisorImagen.css';

export default function VisorImagen({ src, nombre, onCerrar }) {
  const dialogo = useRef(null);
  const cerrar = useRef(null);

  useEffect(() => {
    const ventana = dialogo.current;
    const focoAnterior = document.activeElement;
    const desbordamientoAnterior = document.body.style.overflow;
    ventana.showModal();
    cerrar.current.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      ventana.close();
      document.body.style.overflow = desbordamientoAnterior;
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogo} className="visor-imagen" aria-labelledby="visor-imagen-titulo"
    onCancel={evento => { evento.preventDefault(); onCerrar(); }}
    onClick={evento => { if (evento.target === evento.currentTarget) onCerrar(); }}>
    <div className="visor-imagen-contenido">
      <div className="visor-imagen-cabecera">
        <h2 id="visor-imagen-titulo">{nombre}</h2>
        <button ref={cerrar} type="button" className="visor-imagen-cerrar" aria-label="Cerrar foto" onClick={onCerrar}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>
      <div className="visor-imagen-foto"><ImagenPortada src={src} alt={nombre} tipo="local" loading="eager" encuadre="completo" ambiente={false} /></div>
    </div>
  </dialog>;
}
