import './Header.css';

export default function Header({ onInicio, onLogout, cantidadCarrito, onAbrirCarrito, userRol, onAbrirFavoritos, onAbrirPerfil, ubicacionEntrega, modoEntrega = 'DOMICILIO', onCambiarUbicacion, onCambiarModoEntrega }) {
  const esCliente = userRol !== 'VENDEDOR';

  return (
    <header className={`nexbite-header${esCliente ? '' : ' nexbite-header-vendedor'}`}>
      <button type="button" className="header-marca" onClick={onInicio}>NexBite</button>

      {esCliente && <div className="header-entrega">
        <div className="header-modos" role="group" aria-label="Tipo de pedido">
          <button type="button" aria-pressed={modoEntrega === 'DOMICILIO'} onClick={() => onCambiarModoEntrega('DOMICILIO')}>A domicilio</button>
          <button type="button" aria-pressed={modoEntrega === 'RECOGIDA'} onClick={() => onCambiarModoEntrega('RECOGIDA')}>Recogida</button>
        </div>
        <button type="button" className="header-ubicacion" aria-label="Cambiar ubicación" aria-describedby="direccion-header" aria-haspopup={ubicacionEntrega ? 'dialog' : undefined} title={ubicacionEntrega?.direccion || 'Seleccionar ubicación'} onClick={onCambiarUbicacion}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
          <span id="direccion-header" className="header-direccion">{ubicacionEntrega?.direccion || 'Seleccionar ubicación'}</span>
          <span className="header-desplegar" aria-hidden="true">⌄</span>
        </button>
      </div>}

      <nav className="header-acciones" aria-label="Tu cuenta">
        {esCliente && <>
          <button type="button" onClick={onAbrirFavoritos}>❤️ Favoritos</button>
          <button type="button" onClick={onAbrirCarrito}>🛒 Carrito ({cantidadCarrito})</button>
        </>}
        <button type="button" onClick={onAbrirPerfil} className="header-perfil">👤 Mi Perfil</button>
        <button type="button" onClick={onLogout} className="header-sesion">Cerrar Sesión</button>
      </nav>
    </header>
  );
}
