import { useEffect, useRef, useState } from 'react';
import './BotonAgregarCarrito.css';

export default function BotonAgregarCarrito({ onAgregar, nombrePlato, variante }) {
  const [anadido, setAnadido] = useState(false);
  const [pulsacion, setPulsacion] = useState(0);
  const temporizador = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const agregar = event => {
    event.stopPropagation();
    if (onAgregar(event) === false) return;
    clearTimeout(temporizador.current);
    setAnadido(true);
    setPulsacion(numero => numero + 1);
    temporizador.current = setTimeout(() => setAnadido(false), 1500);
  };

  return (
    <>
      <button type="button" onClick={agregar} aria-label={'Añadir ' + (nombrePlato || 'plato') + ' al carrito'} className={'boton-agregar-carrito' + (variante === 'repetir' ? ' boton-agregar-carrito-repetir' : '') + (anadido ? ' esta-anadido' : '')}>
        {anadido && <span key={'pulso-' + pulsacion} className="boton-carrito-pulso" aria-hidden="true" />}
        <span key={pulsacion} className="boton-carrito-contenido">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d={anadido ? 'm5 12 4 4 10-10' : 'M12 5v14M5 12h14'} />
          </svg>
          {anadido ? 'Añadido' : 'Añadir'}
        </span>
      </button>
      <span className="boton-carrito-estado" role="status" aria-atomic="true">{anadido ? (nombrePlato || 'Plato') + ' añadido al carrito.' : ''}</span>
    </>
  );
}
