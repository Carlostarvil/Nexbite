import Buscador from './Buscador';
import IconoCorazon from './IconoCorazon';
import IconoCarrito from './IconoCarrito';
import './Header.css';

// NUEVO: Añadido el prop "isLoggedIn = true"
export default function Header({ isLoggedIn = true, onInicio, onLogout, cantidadCarrito = 0, onAbrirCarrito, userRol, onAbrirFavoritos, onAbrirPerfil, onSelectRestaurante, onSelectPlato, vistaActiva, ubicacionEntrega, modoEntrega = 'DOMICILIO', onCambiarUbicacion, onCambiarModoEntrega }) {
  const esCliente = userRol !== 'VENDEDOR';

  return (
    <header className={`nexbite-header${esCliente && isLoggedIn ? '' : ' nexbite-header-vendedor'}`}>
      <button type="button" className="header-marca" onClick={onInicio} aria-label="NexBite, inicio">NexBite</button>

      {/* SOLO SE MUESTRA SI HA INICIADO SESIÓN Y ES CLIENTE */}
      {isLoggedIn && esCliente && <>
        <div className="header-entrega">
          <div className="header-modos" role="group" aria-label="Tipo de pedido">
            <button type="button" aria-pressed={modoEntrega === 'DOMICILIO'} onClick={() => onCambiarModoEntrega('DOMICILIO')}>A domicilio</button>
            <button type="button" aria-pressed={modoEntrega === 'RECOGIDA'} onClick={() => onCambiarModoEntrega('RECOGIDA')}>Recogida</button>
          </div>
          
          <div className="header-ubicacion-container" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <button 
              type="button" 
              className="header-ubicacion" 
              aria-label="Cambiar ubicación" 
              aria-describedby="direccion-header" 
              aria-haspopup={ubicacionEntrega ? 'dialog' : undefined} 
              onClick={onCambiarUbicacion}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
              <span id="direccion-header" className="header-direccion">{ubicacionEntrega?.direccion || 'Seleccionar ubicación'}</span>
            </button>
            
            <div className="tooltip-direccion">
              <strong>Tu ubicación actual:</strong><br/>
              {ubicacionEntrega?.direccion || 'Aún no has seleccionado una ubicación'}
            </div>
          </div>
        </div>
        
        <div className="header-buscador">
          <Buscador ubicacionEntrega={ubicacionEntrega} modoEntrega={modoEntrega} onSelectRestaurante={onSelectRestaurante} onSelectPlato={onSelectPlato} />
        </div>
      </>}

      {/* ICONOS DE ACCIÓN (SOLO SI HA INICIADO SESIÓN) */}
      {isLoggedIn && (
        <nav className="header-acciones" aria-label="Tu cuenta">
          {esCliente && <>
            <button type="button" className="header-icono header-favoritos" onClick={onAbrirFavoritos} aria-label="Favoritos" title="Favoritos" aria-current={vistaActiva === 'favoritos' ? 'page' : undefined}>
              <IconoCorazon relleno={vistaActiva === 'favoritos'} />
            </button>
            <button type="button" className="header-icono header-carrito" onClick={onAbrirCarrito} aria-label={`Carrito (${cantidadCarrito})`} title="Carrito" aria-current={vistaActiva === 'carrito' ? 'page' : undefined}>
              <IconoCarrito tamano={26} />
              {cantidadCarrito > 0 && <span className="header-carrito-contador" aria-hidden="true">{cantidadCarrito > 99 ? '99+' : cantidadCarrito}</span>}
            </button>
          </>}
          <button type="button" onClick={onAbrirPerfil} className="header-icono header-perfil" aria-label="Mi perfil" title="Mi perfil" aria-current={vistaActiva === 'perfil' ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="7.5" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
          </button>
          <button type="button" onClick={onLogout} className="header-sesion" aria-label="Cerrar sesión" title="Cerrar sesión">
            <svg className="header-icono-sesion" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M9 5H5v14h4M13 8l4 4-4 4M9 12h12" /></svg>
            <span className="header-sesion-texto">Cerrar sesión</span>
          </button>
        </nav>
      )}
    </header>
  );
}