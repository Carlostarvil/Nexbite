import { useState } from 'react';
import InformacionFooter from './InformacionFooter';
import './Footer.css';

function IconoFooter({ tipo }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {tipo === 'ubicacion' && <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>}
    {tipo === 'pedido' && <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></>}
    {tipo === 'pago' && <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></>}
  </svg>;
}

export default function Footer({ userRol, onNavegar, onAcceder, bloqueado = false }) {
  const [tema, setTema] = useState(null);
  const sesionIniciada = Boolean(userRol && onNavegar);
  const esVendedor = userRol === 'VENDEDOR';
  const abrirInformacion = clave => setTema(clave);
  const accion = (texto, destino) => <li key={destino}><button type="button" onClick={() => onNavegar(destino)}>{texto}</button></li>;
  const informacion = (texto, clave) => <li key={clave}><button type="button" aria-haspopup="dialog" onClick={() => abrirInformacion(clave)}>{texto}</button></li>;

  return <>
    <footer className="nexbite-footer" aria-label="Información y enlaces de NexBite" inert={bloqueado}>
      <div className="footer-contenido">
        <div className="footer-cabecera">
          <div className="footer-presentacion">
            <button type="button" className="footer-marca" aria-label={sesionIniciada ? 'Volver al inicio de NexBite' : 'Acceder a NexBite'}
              onClick={() => sesionIniciada ? onNavegar('inicio') : onAcceder?.()}>NexBite<span aria-hidden="true">.</span></button>
            <p>Tu próxima comida empieza cerca.</p>
            <span>Descubre locales de tu zona y disfruta de tus favoritos a domicilio o para recoger.</span>
          </div>
          <div className="footer-ventajas" aria-label="Opciones de NexBite">
            <div><IconoFooter tipo="ubicacion" /><span>Locales cerca de ti</span></div>
            <div><IconoFooter tipo="pedido" /><span>Entrega y recogida</span></div>
            <div><IconoFooter tipo="pago" /><span>Tarjeta o efectivo</span></div>
          </div>
        </div>

        <div className="footer-columnas">
          <nav aria-label="Descubre NexBite">
            <h2>Descubre</h2>
            <ul>
              {sesionIniciada && !esVendedor && accion('Explorar restaurantes', 'inicio')}
              {informacion('Sobre NexBite', 'sobre')}
              {informacion('Cómo funciona', 'funcionamiento')}
              {informacion('Entrega y recogida', 'entregas')}
              {sesionIniciada && !esVendedor && accion('Cambiar ubicación', 'ubicacion')}
            </ul>
          </nav>
          <nav aria-label="Accesos a tu cuenta">
            <h2>Tu cuenta</h2>
            <ul>
              {sesionIniciada ? <>
                {accion('Mi perfil', 'perfil')}
                {!esVendedor && <>
                  {accion('Mis pedidos', 'pedidos')}
                  {accion('Mis favoritos', 'favoritos')}
                  {accion('Ver carrito', 'carrito')}
                </>}
              </> : <li><button type="button" onClick={onAcceder}>Iniciar sesión o registrarte</button></li>}
              {informacion('Cuenta y datos personales', 'cuenta')}
            </ul>
          </nav>
          <nav aria-label="Información para restaurantes">
            <h2>Para restaurantes</h2>
            <ul>
              {sesionIniciada && esVendedor && <>
                {accion('Mis locales', 'locales')}
                {accion('Registrar un local', 'registrar')}
              </>}
              {informacion('Vender en NexBite', 'vendedores')}
              {informacion('Gestionar tu restaurante', 'gestion')}
            </ul>
          </nav>
          <nav aria-label="Ayuda de NexBite">
            <h2>¿Necesitas ayuda?</h2>
            <ul>
              {informacion('Preguntas frecuentes', 'ayuda')}
              {informacion('Pagos y pedidos', 'pagos')}
              {informacion('Contactar con un local', 'contacto')}
              {informacion('Ingredientes y alérgenos', 'alergenos')}
            </ul>
          </nav>
        </div>

        <div className="footer-pie">
          <p>© {new Date().getFullYear()} NexBite</p>
          <nav aria-label="Información de datos y preferencias">
            <button type="button" aria-haspopup="dialog" onClick={() => abrirInformacion('privacidad')}>Datos y privacidad</button>
            <button type="button" aria-haspopup="dialog" onClick={() => abrirInformacion('almacenamiento')}>Preferencias del navegador</button>
          </nav>
          <span className="footer-idioma">Español <span aria-hidden="true">·</span> EUR (€)</span>
        </div>
      </div>
    </footer>
    {tema && <InformacionFooter tema={tema} onCerrar={() => setTema(null)} />}
  </>;
}
