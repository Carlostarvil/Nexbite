import { useRef, useState } from 'react';
import ImagenPortada from './ImagenPortada';
import './ImagenPlato.css';

export default function ImagenPlato({ plato, style, className = '', loading = 'lazy' }) {
  const fotos = (plato.items_menu || []).filter(item => item.imagen_url).map(item => ({ nombre: item.nombre, url: item.imagen_url }));
  if (plato.imagen_url && !fotos.some(foto => foto.url === plato.imagen_url)) fotos.unshift({ nombre: plato.nombre, url: plato.imagen_url });
  // La portada elegida por el vendedor representa el menú en las tarjetas.
  // Las fotos de sus platos siguen disponibles al abrir la galería.
  const visibles = plato.imagen_url ? [{ nombre: plato.nombre, url: plato.imagen_url }] : fotos.slice(0, 3);
  const esMenu = (plato.items_menu || []).length > 0;
  const compacta = parseFloat(style?.height) <= 60;

  return <div className={'imagen-plato imagen-plato-' + visibles.length + (esMenu ? ' imagen-plato-menu' : '') + (compacta ? ' imagen-plato-compacta' : '') + ' ' + className} style={style}>
    {visibles.length ? visibles.map((foto, i) => <ImagenPortada key={i} src={foto.url} alt={foto.nombre} loading={loading} compacto={compacta} />) :
      <ImagenPortada alt={plato.nombre} compacto={compacta} />}
    {esMenu && !compacta && <span className="imagen-plato-menu-etiqueta"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>MENÚ</span>}
    {esMenu && fotos.length > 1 && !compacta && <span className="imagen-plato-mas" aria-label={fotos.length + ' fotos del menú y sus platos'}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5-9 11" /></svg>{fotos.length} fotos</span>}
  </div>;
}

export function GaleriaMenu({ plato }) {
  const [seleccionada, setSeleccionada] = useState(null);
  const miniaturas = useRef(null);
  const items = plato.items_menu || [];
  if (!items.length) return null;
  const fotos = items.map(item => ({ id: 'plato-' + item.id_plato, nombre: item.nombre, url: item.imagen_url }));
  if (plato.imagen_url) fotos.unshift({ id: 'portada', nombre: plato.nombre, url: plato.imagen_url });
  const indice = Math.max(0, fotos.findIndex(foto => foto.id === seleccionada));
  const actual = fotos[indice];

  const elegir = (posicion, enfocar = false) => {
    const siguiente = (posicion + fotos.length) % fotos.length;
    setSeleccionada(fotos[siguiente].id);
    const boton = miniaturas.current?.children[siguiente];
    if (boton) {
      miniaturas.current.scrollTo({ left: boton.offsetLeft - miniaturas.current.clientWidth / 2 + boton.offsetWidth / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (enfocar) boton.focus({ preventScroll: true });
    }
  };
  const navegar = evento => {
    const destinos = { ArrowLeft: indice - 1, ArrowRight: indice + 1, Home: 0, End: fotos.length - 1 };
    if (!(evento.key in destinos)) return;
    evento.preventDefault();
    elegir(destinos[evento.key], true);
  };

  return <section className="galeria-menu galeria-menu-interactiva" aria-label="Fotos del menú y de sus platos">
    <div className="galeria-menu-principal">
      <ImagenPlato plato={{ nombre: actual.nombre, imagen_url: actual.url }} loading="eager" style={{ height: '100%' }} />
      <div className="galeria-menu-pie" aria-live="polite"><span className="galeria-menu-nombre">{actual.nombre}</span><span className="galeria-menu-posicion">{indice + 1} / {fotos.length}</span></div>
      {fotos.length > 1 && <>
        <button type="button" className="galeria-menu-flecha galeria-menu-anterior" aria-label="Foto anterior del menú" onClick={() => elegir(indice - 1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
        <button type="button" className="galeria-menu-flecha galeria-menu-siguiente" aria-label="Foto siguiente del menú" onClick={() => elegir(indice + 1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
      </>}
    </div>
    <div className="galeria-menu-incluidos">
      <h3>El menú y sus platos</h3>
      <div className="galeria-menu-miniaturas" ref={miniaturas} role="group" aria-label="Fotos de los platos del menú" onKeyDown={navegar}>{fotos.map((foto, i) => <button type="button" key={foto.id} className="galeria-menu-miniatura" aria-label={'Ver foto de ' + foto.nombre} aria-pressed={i === indice} onClick={() => elegir(i)}>
        <ImagenPlato plato={{ nombre: foto.nombre, imagen_url: foto.url }} style={{ height: '76px', borderRadius: '10px' }} />
        <span>{foto.nombre}</span>
      </button>)}</div>
    </div>
  </section>;
}
