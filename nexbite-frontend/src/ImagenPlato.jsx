import './ImagenPlato.css';

export default function ImagenPlato({ plato, style, className = '', loading = 'lazy' }) {
  const fotos = (plato.items_menu || []).filter(item => item.imagen_url).map(item => ({ nombre: item.nombre, url: item.imagen_url }));
  if (plato.imagen_url && !fotos.some(foto => foto.url === plato.imagen_url)) fotos.unshift({ nombre: plato.nombre, url: plato.imagen_url });
  const visibles = fotos.slice(0, 4);

  return <div className={'imagen-plato imagen-plato-' + visibles.length + ' ' + className} style={style}>
    {visibles.length ? visibles.map((foto, i) => <img key={i} src={foto.url} alt={foto.nombre} loading={loading} />) :
      <span className="imagen-plato-vacia" aria-label={'Sin foto de ' + plato.nombre}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3v7" /></svg></span>}
    {fotos.length > visibles.length && <span className="imagen-plato-mas" aria-label={(fotos.length - visibles.length) + ' fotos más en el detalle del menú'}>+{fotos.length - visibles.length}</span>}
  </div>;
}

export function GaleriaMenu({ plato }) {
  const items = plato.items_menu || [];
  if (!items.length) return null;
  return <section className="galeria-menu" aria-label="Platos incluidos en el menú">
    <h3>Este menú incluye</h3>
    <div className="galeria-menu-platos">{items.map(item => <figure key={item.id_plato}>
      <ImagenPlato plato={item} style={{ height: '110px', borderRadius: '10px' }} />
      <figcaption>{item.nombre}</figcaption>
    </figure>)}</div>
  </section>;
}
