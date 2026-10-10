import { useState } from 'react';
import './ImagenPortada.css';

function FotoPortada({ src, alt, tipo = 'plato', loading = 'lazy', compacto = false, className = '' }) {
  const [estado, setEstado] = useState(src ? 'cargando' : 'vacia');
  const esLocal = tipo === 'local';
  const mensaje = estado === 'error' ? 'Imagen no disponible' : esLocal ? 'Local sin foto' : 'Producto sin foto';

  return <div className={'imagen-portada imagen-portada-' + tipo + ' ' + className} data-estado={estado}>
    {src && estado !== 'error' && <img src={src} alt={alt} loading={loading} decoding="async"
      onLoad={() => setEstado('cargada')} onError={() => setEstado('error')} />}
    {(estado === 'vacia' || estado === 'error') && <div className="imagen-portada-fondo" role="img" aria-label={mensaje + (alt ? ': ' + alt : '')}>
      <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {esLocal ? <>
          <path d="M19 39v38h58V39M14 39l8-21h52l8 21" />
          <path d="M14 39a8.5 8.5 0 0 0 17 0 8.5 8.5 0 0 0 17 0 8.5 8.5 0 0 0 17 0 8.5 8.5 0 0 0 17 0M36 18l-5 21m29-21 5 21M48 18v21" />
          <path d="M31 77V56h18v21M59 56h9v12h-9M13 77h70" />
        </> : <>
          <circle cx="49" cy="48" r="29" /><circle cx="49" cy="48" r="21" opacity=".4" />
          <path d="M10 25v15a6 6 0 0 0 12 0V25M16 25v50M86 25c-7 3-8 11-8 23h8V25Zm0 23v27" />
          <circle cx="49" cy="48" r="9" opacity=".35" />
        </>}
      </svg>
      {!compacto && <span>{mensaje}</span>}
    </div>}
  </div>;
}

export default function ImagenPortada(props) {
  // Cada foto nueva empieza su propia carga, también al cambiar de imagen en la galería.
  return <FotoPortada key={props.src || 'sin-foto'} {...props} />;
}
