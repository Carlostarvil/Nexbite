import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import MensajeAccion, { IconoEstado } from './MensajeAccion';

const trazos = {
  local: 'M3 10h18M4 10v10h16V10M2 10l3-7h14l3 7M9 20v-6h6v6M8 3l-1 7M16 3l1 7',
  menu: 'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 8h8M8 12h8M8 16h5',
  pedidos: 'M5 7h14l1 14H4L5 7ZM8 7V5a4 4 0 0 1 8 0v2M9 13h6M9 17h4',
  perfil: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  plus: 'M12 5v14M5 12h14',
  volver: 'M20 12H4m6-6-6 6 6 6',
  flecha: 'M4 12h16m-6-6 6 6-6 6',
  editar: 'm16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5',
  mapa: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  reloj: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  radio: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM12 12h.01M12 1v3M12 20v3M1 12h3M20 12h3',
  subir: 'M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  pausa: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 8v8M15 8v8',
  play: 'm9 6 9 6-9 6V6Z',
  papelera: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  check: 'm5 12 4 4L19 6',
  cerrar: 'm6 6 12 12M6 18 18 6',
  buscar: 'M18 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 6 5 5',
  guardar: 'M4 3h13l4 4v14H3V3h1ZM7 3v6h9V3M7 21v-7h10v7',
  imagen: 'M3 3h18v18H3V3Zm0 13 5-5 4 4 4-5 5 6M9 7h.01',
  entrega: 'M3 5h11v12H3V5ZM14 9h4l4 5v3h-8M8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  telefono: 'm5 3 4 4-2 3a16 16 0 0 0 7 7l3-2 4 4-2 2C9 22 2 15 3 5l2-2Z',
  etiqueta: 'M3 3h9l9 9-9 9-9-9V3ZM7 7h.01M10 15l5-5',
  calendario: 'M3 5h18v16H3V5ZM7 2v6M17 2v6M3 10h18M7 14h2M15 14h2M7 18h2',
  correo: 'M3 5h18v14H3V5Zm0 1 9 7 9-7',
  escudo: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-4 10 3 3 5-6',
  refrescar: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3',
  plato: 'M5 3v6M2 3v4a3 3 0 0 0 6 0V3M5 10v11M21 3c-3 1-4 4-4 9h4V3Zm0 9v9M13 6a7 7 0 0 0 0 12',
  bebida: 'M6 7h12l-2 14H8L6 7Zm6 0V3l5-1M7 12h10',
  postre: 'M6 11h12l-2 10H8L6 11Zm0 0a4 4 0 0 1 1-7 5 5 0 0 1 10 0 4 4 0 0 1 1 7M10 14v4M14 14v4',
  farmacia: 'M8 3h8v5h5v8h-5v5H8v-5H3V8h5V3Z',
  mercado: 'M3 3h2l3 12h10l3-9H6M10 20h.01M18 20h.01',
};

export function IconoVendedor({ nombre = 'local', tamano = 20, className = '' }) {
  return <svg className={className} viewBox="0 0 24 24" width={tamano} height={tamano} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={trazos[nombre] || trazos.local} /></svg>;
}

export function TituloVendedor({ titulo, descripcion, contexto, acciones }) {
  return <div className="vendedor-cabecera">
    <div className="vendedor-cabecera-texto">{contexto && <p className="vendedor-contexto">{contexto}</p>}<h1 tabIndex={-1} className="vendedor-titulo">{titulo}</h1>{descripcion && <p className="vendedor-descripcion">{descripcion}</p>}</div>
    {acciones && <div className="vendedor-cabecera-acciones">{acciones}</div>}
  </div>;
}

export function MetricasVendedor({ items }) {
  return <div className="vendedor-metricas">{items.map(item => <div className={'vendedor-metrica vendedor-tono-' + (item.tono || 'naranja')} key={item.etiqueta}>
    <span className="vendedor-metrica-icono"><IconoVendedor nombre={item.icono} tamano={23} /></span><div><span>{item.etiqueta}</span><strong>{item.valor}</strong></div>
  </div>)}</div>;
}

export function VacioVendedor({ icono = 'local', titulo, descripcion, accion }) {
  return <div className="vendedor-vacio"><span className="vendedor-vacio-icono"><IconoVendedor nombre={icono} tamano={38} /></span><h2>{titulo}</h2><p>{descripcion}</p>{accion}</div>;
}

export function CargandoVendedor({ texto = 'Cargando...' }) {
  return <div className="vendedor-cargando" role="status" aria-busy="true"><p><IconoEstado tipo="cargando" tamano={20} />{texto}</p><div className="vendedor-esqueleto-grid" aria-hidden="true">{[0, 1, 2].map(i => <div className="vendedor-esqueleto" key={i}><div /><span /><span /></div>)}</div></div>;
}

export function ErrorVendedor({ descripcion, onReintentar }) {
  return <div className="vendedor-error"><MensajeAccion mensaje={{ tipo: 'error', titulo: 'No hemos podido cargar esta página', descripcion }} /><button type="button" className="vendedor-btn vendedor-btn-secundario" onClick={onReintentar}><IconoVendedor nombre="refrescar" />Volver a intentar</button></div>;
}

export function DialogoVendedor({ titulo, descripcion, icono = 'papelera', ocupado = false, onCerrar, children, acciones, mensaje }) {
  const id = useId();
  const panel = useRef(null);
  useEffect(() => {
    const anterior = document.activeElement;
    const raiz = document.getElementById('root');
    const inertAnterior = raiz?.inert;
    const desbordamiento = document.body.style.overflow;
    if (raiz) raiz.inert = true;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector('button, input, select, textarea')?.focus();
    return () => {
      if (raiz) raiz.inert = inertAnterior;
      document.body.style.overflow = desbordamiento;
      if (anterior?.isConnected) anterior.focus({ preventScroll: true });
      else document.querySelector('.vendedor-titulo')?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const teclado = e => {
      if (e.key === 'Escape' && !ocupado) { e.preventDefault(); onCerrar(); }
      if (e.key !== 'Tab') return;
      const controles = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
      const primero = controles[0]; const ultimo = controles.at(-1);
      if (!primero) { e.preventDefault(); panel.current.focus(); }
      else if (e.shiftKey && (document.activeElement === primero || !panel.current.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (document.activeElement === ultimo || !panel.current.contains(document.activeElement))) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', teclado);
    return () => document.removeEventListener('keydown', teclado);
  }, [ocupado, onCerrar]);

  return createPortal(<div className="vendedor-dialogo-fondo" onClick={e => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}>
    <section className="vendedor-dialogo" ref={panel} role="dialog" aria-modal="true" aria-labelledby={id + '-titulo'} aria-describedby={descripcion ? id + '-descripcion' : undefined} aria-busy={ocupado} tabIndex={-1}>
      <button type="button" className="vendedor-btn-icono vendedor-dialogo-cerrar" onClick={onCerrar} disabled={ocupado} aria-label="Cerrar ventana"><IconoVendedor nombre="cerrar" /></button>
      <span className="vendedor-dialogo-icono"><IconoVendedor nombre={icono} tamano={30} /></span><h2 id={id + '-titulo'}>{titulo}</h2>{descripcion && <p id={id + '-descripcion'}>{descripcion}</p>}
      <div className="vendedor-dialogo-contenido">{children}</div><MensajeAccion mensaje={mensaje} /><div className="vendedor-dialogo-acciones">{acciones}</div>
    </section>
  </div>, document.body);
}
