import { useEffect, useId, useRef, useState } from 'react';
import './AvisoCarrito.css';

export default function AvisoCarrito({ aviso, cantidad, onCerrar, onVerCarrito, onPagar }) {
  const tituloId = useId();
  const [sobreAviso, setSobreAviso] = useState(false);
  const [conFoco, setConFoco] = useState(false);
  const pausado = sobreAviso || conFoco;
  const reloj = useRef({ id: null, restante: 5000 });

  useEffect(() => {
    if (reloj.current.id !== aviso.id) reloj.current = { id: aviso.id, restante: 5000 };
    if (pausado) return;
    const inicio = performance.now();
    const temporizador = setTimeout(onCerrar, reloj.current.restante);
    return () => {
      clearTimeout(temporizador);
      reloj.current.restante = Math.max(0, reloj.current.restante - (performance.now() - inicio));
    };
  }, [aviso.id, pausado, onCerrar]);

  return (
    <section className="aviso-carrito" aria-labelledby={tituloId}
      onMouseEnter={() => setSobreAviso(true)} onMouseLeave={() => setSobreAviso(false)}
      onFocus={() => setConFoco(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setConFoco(false); }}>
      <button type="button" className="aviso-carrito-cerrar" aria-label="Cerrar aviso del carrito" onClick={onCerrar}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
      <div className="aviso-carrito-mensaje" role="status" aria-atomic="true">
        <h3 id={tituloId}><span className="aviso-carrito-exito" aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4 10-10" /></svg></span>¡Añadido al carrito!</h3>
        <div className="aviso-carrito-producto">
          {aviso.imagen_url ? <img src={aviso.imagen_url} alt="" /> : <span className="aviso-carrito-imagen" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h2l2.3 11.5a2 2 0 0 0 2 1.5H18a2 2 0 0 0 2-1.6L21 7H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg></span>}
          <div><strong>{aviso.nombre || 'Plato'}</strong><p>{cantidad} {cantidad === 1 ? 'unidad' : 'unidades'} en tu carrito</p></div>
        </div>
      </div>
      <div className="aviso-carrito-acciones">
        <button type="button" className="aviso-carrito-ver" onClick={onVerCarrito}>Ver carrito</button>
        <button type="button" className="aviso-carrito-pagar" onClick={onPagar}>Pagar <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></button>
      </div>
      <span key={aviso.id} className="aviso-carrito-tiempo" style={{ animationPlayState: pausado ? 'paused' : 'running' }} aria-hidden="true" />
    </section>
  );
}
