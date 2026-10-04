import './TituloSeccion.css';

export default function TituloSeccion({ titulo, descripcion, acciones, nivel = 2, destacado = false, compacto = false }) {
  const Etiqueta = `h${nivel}`;

  return (
    <div className={'titulo-seccion' + (destacado ? ' titulo-seccion-destacado' : '') + (compacto ? ' titulo-seccion-compacto' : '')}>
      <div className="titulo-seccion-texto">
        <Etiqueta className="titulo-seccion-nombre">{titulo}</Etiqueta>
        {descripcion && <p className="titulo-seccion-descripcion">{descripcion}</p>}
      </div>
      {acciones && <div className="titulo-seccion-acciones">{acciones}</div>}
    </div>
  );
}

export function ControlesCarrusel({ titulo, onAnterior, onSiguiente }) {
  return (
    <div className="titulo-carrusel-controles">
      <button type="button" onClick={onAnterior} aria-label={'Ver anteriores en ' + titulo}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m14 6-6 6 6 6" /></svg>
      </button>
      <button type="button" onClick={onSiguiente} aria-label={'Ver siguientes en ' + titulo}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m10 6 6 6-6 6" /></svg>
      </button>
    </div>
  );
}
