import { useEffect, useRef } from 'react';
import { IconoEstado } from './MensajeAccion';
import DireccionLocal from './DireccionLocal';
import './ConfirmacionPedido.css';

export default function ConfirmacionPedido({ pedido, onCerrar, onVerPedidos }) {
  const dialogo = useRef(null);
  const recogida = pedido.tipoEntrega === 'RECOGIDA';
  const pagado = pedido.metodoPago === 'TARJETA';
  const fecha = pedido.fechaProgramada ? new Date(pedido.fechaProgramada).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }) : null;

  useEffect(() => {
    const anterior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogo.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      if (anterior?.isConnected) anterior.focus({ preventScroll: true });
      else document.querySelector('.header-marca')?.focus({ preventScroll: true });
    };
  }, []);

  const teclado = evento => {
    if (evento.key === 'Escape') { evento.preventDefault(); onCerrar(); }
    if (evento.key !== 'Tab') return;
    const elementos = [...dialogo.current.querySelectorAll('button, a[href]')];
    const primero = elementos[0], ultimo = elementos.at(-1);
    if (evento.shiftKey && (document.activeElement === primero || document.activeElement === dialogo.current)) { evento.preventDefault(); ultimo.focus(); }
    else if (!evento.shiftKey && (document.activeElement === ultimo || document.activeElement === dialogo.current)) { evento.preventDefault(); primero.focus(); }
  };

  return <div className="confirmacion-pedido-fondo">
    <section ref={dialogo} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacion-pedido" aria-describedby="descripcion-confirmacion-pedido" className="confirmacion-pedido" onKeyDown={teclado}>
      <button type="button" className="confirmacion-pedido-cerrar" aria-label="Cerrar confirmación del pedido" onClick={onCerrar}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
      <div className="confirmacion-pedido-icono"><IconoEstado tipo="exito" tamano={54} /></div>
      <p className="confirmacion-pedido-etiqueta">{fecha ? 'Recogida programada' : 'Pedido confirmado'}</p>
      <h2 id="titulo-confirmacion-pedido">{pagado ? '¡Pago realizado!' : '¡Pedido confirmado!'}</h2>
      <p id="descripcion-confirmacion-pedido">{recogida ? fecha ? 'Tu pedido está reservado para la hora que has elegido.' : 'El local preparará tu pedido para recogerlo lo antes posible.' : 'El local preparará tu pedido para enviarlo a tu dirección.'}</p>
      <dl className="confirmacion-pedido-resumen">
        <div><dt>Local</dt><dd>{pedido.nombreRestaurante || 'Tu restaurante'}</dd></div>
        <div><dt>Artículos</dt><dd>{pedido.articulos}</dd></div>
        <div><dt>Total del pedido</dt><dd className="confirmacion-pedido-total">€{pedido.total.toFixed(2)}</dd></div>
        <div><dt>Pago</dt><dd>{pagado ? 'Pagado con tarjeta' : recogida ? 'En efectivo al recoger' : 'En efectivo al recibir'}</dd></div>
        <div><dt>{recogida ? 'Recogida' : 'Entrega'}</dt><dd>{fecha || (recogida ? 'Lo antes posible' : 'A domicilio')}</dd></div>
      </dl>
      {recogida ? <div className="confirmacion-pedido-direccion"><strong>Dirección del local</strong><DireccionLocal direccion={pedido.direccionLocal} urlMapa={pedido.urlMapa} /></div> : <div className="confirmacion-pedido-direccion"><strong>Dirección de entrega</strong><p>{pedido.direccionEntrega}</p></div>}
      <div className="confirmacion-pedido-acciones">
        <button type="button" onClick={onVerPedidos}>Ver mis pedidos <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></button>
        <button type="button" onClick={onCerrar}>Seguir comprando</button>
      </div>
    </section>
  </div>;
}
