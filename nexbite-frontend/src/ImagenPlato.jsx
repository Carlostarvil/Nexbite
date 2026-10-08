import { useRef, useState } from 'react';
import './ImagenPlato.css';

export default function ImagenPlato({ plato, style, className = '', loading = 'lazy' }) {
  const fotos = (plato.items_menu || []).filter(item => item.imagen_url).map(item => ({ nombre: item.nombre, url: item.imagen_url }));
  if (plato.imagen_url && !fotos.some(foto => foto.url === plato.imagen_url)) fotos.unshift({ nombre: plato.nombre, url: plato.imagen_url });
  const visibles = fotos.slice(0, 3);
  const esMenu = (plato.items_menu || []).length > 0;
  const compacta = parseFloat(style?.height) <= 60;

  return <div className={'imagen-plato imagen-plato-' + visibles.length + (esMenu ? ' imagen-plato-menu' : '') + (compacta ? ' imagen-plato-compacta' : '') + ' ' + className} style={style}>
    {visibles.length ? visibles.map((foto, i) => <img key={i} src={foto.url} alt={foto.nombre} loading={loading} />) :
      <span className="imagen-plato-vacia" aria-label={'Sin foto de ' + plato.nombre}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3v7" /></svg></span>}
    {esMenu && !compacta && <span className="imagen-plato-menu-etiqueta"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>MENÚ</span>}
    {fotos.length > visibles.length && !compacta && <span className="imagen-plato-mas" aria-label={(fotos.length - visibles.length) + ' fotos más en el detalle del menú'}>+{fotos.length - visibles.length}</span>}
  </div>;
}

export function GaleriaMenu({ plato }) {
  const [seleccionada, setSeleccionada] = useState(null);
  const miniaturas = useRef(null);
  const items = plato.items_menu || [];
  if (!items.length) return null;
  const fotos = items.map(item => ({ id: 'plato-' + item.id_plato, nombre: item.nombre, url: item.imagen_url }));
  if (plato.imagen_url && !fotos.some(foto => foto.url === plato.imagen_url)) fotos.unshift({ id: 'portada', nombre: plato.nombre, url: plato.imagen_url });
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

  return <section className="galeria-menu galeria-menu-interactiva" aria-label="Platos incluidos en el menú">
    <div className="galeria-menu-principal">
      <ImagenPlato plato={{ nombre: actual.nombre, imagen_url: actual.url }} loading="eager" style={{ height: '100%' }} />
      <div className="galeria-menu-pie" aria-live="polite"><span className="galeria-menu-nombre">{actual.nombre}</span><span className="galeria-menu-posicion">{indice + 1} / {fotos.length}</span></div>
      {fotos.length > 1 && <>
        <button type="button" className="galeria-menu-flecha galeria-menu-anterior" aria-label="Foto anterior del menú" onClick={() => elegir(indice - 1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
        <button type="button" className="galeria-menu-flecha galeria-menu-siguiente" aria-label="Foto siguiente del menú" onClick={() => elegir(indice + 1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
      </>}
    </div>
    <div className="galeria-menu-incluidos">
      <h3>Este menú incluye</h3>
      <div className="galeria-menu-miniaturas" ref={miniaturas} role="group" aria-label="Fotos de los platos del menú" onKeyDown={navegar}>{fotos.map((foto, i) => <button type="button" key={foto.id} className="galeria-menu-miniatura" aria-label={'Ver foto de ' + foto.nombre} aria-pressed={i === indice} onClick={() => elegir(i)}>
        <ImagenPlato plato={{ nombre: foto.nombre, imagen_url: foto.url }} style={{ height: '76px', borderRadius: '10px' }} />
        <span>{foto.nombre}</span>
      </button>)}</div>
    </div>
  </section>;
}
