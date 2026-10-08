import { useRef } from 'react';
import './SelectorRecomendaciones.css';

const OPCIONES = [
  { valor: 'LOCALES', nombre: 'Locales', id: 'locales' },
  { valor: 'PRODUCTOS', nombre: 'Comida / productos', id: 'productos' },
];

export default function SelectorRecomendaciones({ seleccionada, onSeleccionar }) {
  const botones = useRef([]);

  const navegarConTeclado = (evento, indice) => {
    let siguiente;
    if (evento.key === 'ArrowRight') siguiente = (indice + 1) % OPCIONES.length;
    else if (evento.key === 'ArrowLeft') siguiente = (indice + OPCIONES.length - 1) % OPCIONES.length;
    else if (evento.key === 'Home') siguiente = 0;
    else if (evento.key === 'End') siguiente = OPCIONES.length - 1;
    else return;

    evento.preventDefault();
    onSeleccionar(OPCIONES[siguiente].valor);
    botones.current[siguiente]?.focus({ preventScroll: true });
  };

  return (
    <div className="selector-recomendaciones" role="tablist" aria-label="Tipo de recomendaciones">
      {OPCIONES.map((opcion, indice) => (
        <button
          key={opcion.valor}
          ref={boton => { botones.current[indice] = boton; }}
          type="button"
          role="tab"
          id={'recomendaciones-tab-' + opcion.id}
          aria-controls={'recomendaciones-panel-' + opcion.id}
          aria-selected={seleccionada === opcion.valor}
          tabIndex={seleccionada === opcion.valor ? 0 : -1}
          onClick={() => onSeleccionar(opcion.valor)}
          onKeyDown={evento => navegarConTeclado(evento, indice)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {opcion.valor === 'LOCALES' ? (
              <><path d="M3 10h18l-2-7H5l-2 7ZM4 10v10h16V10M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>
            ) : (
              <><path d="M4 3v5a2 2 0 0 0 4 0V3M6 3v18M18 3c-2 1-3 4-3 8h3V3Zm0 8v10" /></>
            )}
          </svg>
          <span>{opcion.nombre}</span>
        </button>
      ))}
    </div>
  );
}
