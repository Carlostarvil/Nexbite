import { useContext, useEffect, useId, useRef, useState } from 'react';
import { EstadoCarritoContext } from './estadoCarrito';
import './BotonAgregarCarrito.css';

export default function BotonAgregarCarrito({ onAgregar, idPlato, nombrePlato, variante, disabled = false }) {
  const carrito = useContext(EstadoCarritoContext);
  const descripcionId = useId();
  const platoEnCarrito = idPlato == null ? undefined : carrito.find(plato => String(plato.id_plato) === String(idPlato));
  const cantidad = platoEnCarrito ? (platoEnCarrito.cantidad || 1) : 0;
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

  const etiqueta = anadido ? 'Añadido' : cantidad > 0 ? 'Añadir más' : variante === 'reserva' ? 'Reservar' : 'Añadir al carrito';

  return (
    <>
      <button type="button" onClick={agregar} disabled={disabled}
        aria-label={'Añadir ' + (nombrePlato || 'plato') + ' al carrito'} aria-describedby={descripcionId}
        className={'boton-agregar-carrito' + (variante ? ' boton-agregar-carrito-' + variante : '') + (anadido ? ' esta-anadido' : '')}>
        {anadido && <span key={'pulso-' + pulsacion} className="boton-carrito-pulso" aria-hidden="true" />}
        <span key={pulsacion} className="boton-carrito-contenido">
          <span className="boton-carrito-icono" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              {anadido ? <path d="m5 12 4 4 10-10" /> : <><path d="M3 3h2l2.3 11.5a2 2 0 0 0 2 1.5H18a2 2 0 0 0 2-1.6L21 7H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M14 8v5m-2.5-2.5h5" /></>}
            </svg>
          </span>
          <span className="boton-carrito-etiqueta">{etiqueta}</span>
        </span>
        {cantidad > 0 && <span className="boton-carrito-cantidad" aria-hidden="true"><strong>{cantidad}</strong><span>en carrito</span></span>}
      </button>
      <span id={descripcionId} className="boton-carrito-estado">{cantidad} {cantidad === 1 ? 'unidad' : 'unidades'} de {nombrePlato || 'este plato'} en el carrito.</span>
    </>
  );
}
