import { useContext, useEffect, useId, useRef, useState } from 'react';
import { EstadoCarritoContext } from './estadoCarrito';
import IconoCarrito from './IconoCarrito';
import './BotonAgregarCarrito.css';

export default function BotonAgregarCarrito({ onAgregar, idPlato, nombrePlato, variante, disabled = false }) {
  const { carrito, restarDelCarrito } = useContext(EstadoCarritoContext);
  const descripcionId = useId();
  const nombre = nombrePlato || 'plato';
  const platoEnCarrito = idPlato == null ? undefined : carrito.find(plato => String(plato.id_plato) === String(idPlato));
  const cantidad = platoEnCarrito ? (platoEnCarrito.cantidad || 1) : 0;
  const [anadido, setAnadido] = useState(false);
  const [pulsacion, setPulsacion] = useState(0);
  const [focoTeclado, setFocoTeclado] = useState(false);
  const temporizador = useRef(null);
  const botonInicial = useRef(null);
  const contador = useRef(null);
  const focoPendiente = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);
  useEffect(() => {
    if (focoPendiente.current === 'contador' && cantidad > 0) {
      contador.current?.focus({ preventScroll: true });
      focoPendiente.current = null;
    } else if (focoPendiente.current === 'inicial' && cantidad === 0) {
      botonInicial.current?.focus({ preventScroll: true });
      focoPendiente.current = null;
    }
  }, [cantidad]);

  const agregar = event => {
    event.stopPropagation();
    if (onAgregar(event) === false) return;
    if (cantidad === 0) setFocoTeclado(false);
    if (cantidad === 0 && event.detail === 0) focoPendiente.current = 'contador';
    clearTimeout(temporizador.current);
    setAnadido(true);
    setPulsacion(numero => numero + 1);
    temporizador.current = setTimeout(() => setAnadido(false), 1500);
  };

  const reducir = event => {
    event.stopPropagation();
    if (cantidad === 1 && event.currentTarget === document.activeElement) focoPendiente.current = 'inicial';
    if (cantidad === 1) setFocoTeclado(false);
    clearTimeout(temporizador.current);
    setAnadido(false);
    restarDelCarrito(idPlato);
  };

  return (
    <>
      {cantidad === 0 ? (
        <button ref={botonInicial} type="button" onClick={agregar} disabled={disabled}
          aria-label={'Añadir ' + nombre + ' al carrito'} aria-describedby={descripcionId}
          className={'boton-agregar-carrito' + (variante ? ' boton-agregar-carrito-' + variante : '')}>
          <span className="boton-carrito-contenido">
            <span className="boton-carrito-etiqueta">{variante === 'reserva' ? 'Reservar' : 'Añadir al carrito'}</span>
            <span className="boton-carrito-icono" aria-hidden="true"><IconoCarrito tamano={30} /></span>
          </span>
        </button>
      ) : (
        <div className={'carrito-control-cantidad' + (anadido ? ' esta-anadido' : '') + (focoTeclado ? ' con-foco-teclado' : '')}
          role="group" aria-label={'Cantidad de ' + nombre} onClick={event => event.stopPropagation()}
          onPointerDown={() => setFocoTeclado(false)}
          onFocus={event => setFocoTeclado(event.target.matches(':focus-visible'))}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocoTeclado(false); }}>
          <button type="button" className="carrito-cantidad-accion carrito-cantidad-restar" onClick={reducir} disabled={disabled}
            aria-label={cantidad === 1 ? 'Eliminar ' + nombre + ' del carrito' : 'Quitar una unidad de ' + nombre}
            aria-describedby={descripcionId} title={cantidad === 1 ? 'Eliminar del carrito' : 'Quitar una unidad'}>
            {cantidad === 1 ? <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6" /></svg> : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M5 12h14" /></svg>}
          </button>
          <button ref={contador} type="button" className="carrito-cantidad-numero" onClick={agregar} disabled={disabled}
            aria-label={'Añadir ' + nombre + ' al carrito'} aria-describedby={descripcionId} title="Añadir otra unidad">
            <span key={pulsacion} className="carrito-cantidad-valor" aria-hidden="true">{cantidad}</span>
          </button>
          <button type="button" className="carrito-cantidad-accion carrito-cantidad-sumar" onClick={agregar} disabled={disabled}
            aria-label={'Añadir una unidad de ' + nombre} aria-describedby={descripcionId} title="Añadir una unidad">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      )}
      <span id={descripcionId} className="boton-carrito-estado">{cantidad} {cantidad === 1 ? 'unidad' : 'unidades'} de {nombre} en el carrito.</span>
    </>
  );
}
