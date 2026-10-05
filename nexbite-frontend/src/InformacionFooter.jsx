import { useEffect, useRef } from 'react';
import { informacionFooter } from './informacionFooter';

export default function InformacionFooter({ tema, onCerrar }) {
  const dialogo = useRef(null);
  const titulo = useRef(null);
  const informacion = informacionFooter[tema];

  useEffect(() => {
    const elemento = dialogo.current;
    const focoAnterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    elemento.showModal();
    document.body.style.overflow = 'hidden';
    titulo.current?.focus({ preventScroll: true });
    return () => {
      elemento.close();
      document.body.style.overflow = overflowAnterior;
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogo} className="footer-informacion" aria-labelledby="footer-informacion-titulo" aria-describedby="footer-informacion-descripcion"
    onCancel={event => { event.preventDefault(); onCerrar(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controles = [...event.currentTarget.querySelectorAll('button:not(:disabled), summary, a[href], [tabindex="0"]')];
      const primero = controles[0];
      const ultimo = controles.at(-1);
      if (event.shiftKey && (document.activeElement === primero || document.activeElement === titulo.current)) {
        event.preventDefault(); ultimo?.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault(); primero?.focus();
      }
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const limites = event.currentTarget.getBoundingClientRect();
      if (event.clientX < limites.left || event.clientX > limites.right || event.clientY < limites.top || event.clientY > limites.bottom) onCerrar();
    }}>
    <div className="footer-informacion-cabecera">
      <div>
        <span className="footer-informacion-marca">NexBite</span>
        <h2 ref={titulo} id="footer-informacion-titulo" tabIndex={-1}>{informacion.titulo}</h2>
      </div>
      <button type="button" className="footer-informacion-cerrar" aria-label="Cerrar información" onClick={onCerrar}>
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <div className="footer-informacion-texto">
      <p id="footer-informacion-descripcion" className="footer-informacion-intro">{informacion.descripcion}</p>
      {informacion.secciones?.map(seccion => <section key={seccion.titulo}>
        <h3>{seccion.titulo}</h3>
        <p>{seccion.texto}</p>
      </section>)}
      {informacion.preguntas?.map(pregunta => <details key={pregunta.titulo}>
        <summary>{pregunta.titulo}<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg></summary>
        <p>{pregunta.texto}</p>
      </details>)}
    </div>
    <div className="footer-informacion-final"><button type="button" onClick={onCerrar}>Entendido</button></div>
  </dialog>;
}
