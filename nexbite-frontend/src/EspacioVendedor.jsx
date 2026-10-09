import { useEffect } from 'react';
import { IconoVendedor } from './VendedorUI';
import './Vendedor.css';

export default function EspacioVendedor({ vista, local, onNavegar, children }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.querySelector('.vendedor-titulo')?.focus({ preventScroll: true });
  }, [vista, local?.id_restaurante]);
  const enlace = (destino, texto, icono) => <button type="button" key={destino} className="vendedor-nav-enlace" aria-current={vista === destino ? 'page' : undefined} onClick={() => onNavegar(destino)}><IconoVendedor nombre={icono} /><span>{texto}</span>{vista === destino && <span className="vendedor-nav-punto" aria-hidden="true" />}</button>;
  return <div className="vendedor-shell">
    <aside className="vendedor-sidebar">
      <div className="vendedor-sidebar-titulo"><span className="vendedor-logo-icono"><IconoVendedor nombre="local" tamano={24} /></span><div><strong>Tu negocio</strong><span>Todo en un mismo lugar</span></div></div>
      <nav aria-label="Navegación del vendedor" className="vendedor-nav">
        {enlace('MIS_LOCALES', 'Mis locales', 'local')}{enlace('REGISTRAR', 'Nuevo local', 'plus')}
        {local && <div className="vendedor-nav-local"><div className="vendedor-nav-local-nombre">{local.imagen_url && <img src={local.imagen_url} alt="" />}<span>{local.nombre}</span></div>{enlace('GESTOR_MENU', 'Menú y productos', 'menu')}{enlace('GESTOR_PEDIDOS', 'Pedidos', 'pedidos')}</div>}
        {enlace('PERFIL', 'Mi perfil', 'perfil')}
      </nav>
      <div className="vendedor-sidebar-ayuda"><IconoVendedor nombre="check" /><p>A tu ritmo.<br /><span>Actualiza tu carta, organiza tus pedidos y controla cuándo abres.</span></p></div>
    </aside>
    <div className="vendedor-pagina">{children}</div>
  </div>;
}
