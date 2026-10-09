import EtiquetasLocal from './EtiquetasLocal';
import EstadoDisponibilidad from './EstadoDisponibilidad';
import './TarjetasInicio.css';

export default function TarjetaLocalInicio({ local, onSeleccionar, tieneOferta = false }) {
  const nota = Number(local.calificacion);
  const valorada = Number.isFinite(nota) && nota > 0;
  const distancia = Number(local.distancia_km);
  const tieneDistancia = local.distancia_km != null && Number.isFinite(distancia);
  const cerrado = local.aceptando_pedidos === false;

  return <article className={'tarjeta-inicio tarjeta-inicio-local' + (cerrado ? ' tarjeta-inicio-no-disponible' : '')}>
    <button type="button" className="tarjeta-inicio-enlace" aria-label={'Ver ' + local.nombre} onClick={() => onSeleccionar(local.id_restaurante)} />
    <div className="tarjeta-inicio-imagen">
      {local.imagen_url ? <img src={local.imagen_url} alt={local.nombre} loading="lazy" /> : <div className="tarjeta-inicio-sin-foto" aria-label="Local sin foto">
        <svg viewBox="0 0 64 64" width="70" height="70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 29v26h40V29M8 29l7-17h34l7 17M8 29a8 8 0 0 0 16 0 8 8 0 0 0 16 0 8 8 0 0 0 16 0M26 55V39h12v16M24 12l-2 17m18-17 2 17" /></svg>
      </div>}
      <span className={'tarjeta-inicio-valoracion' + (valorada ? '' : ' tarjeta-inicio-nuevo')} aria-label={valorada ? 'Valoración: ' + nota.toFixed(1) + ' de 5' : 'Local nuevo, sin valoraciones'}>
        {valorada && <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" /></svg>}
        {valorada ? nota.toFixed(1) : 'Nuevo'}
      </span>
      {tieneOferta && <span className="tarjeta-inicio-oferta">Ofertas</span>}
    </div>
    <div className="tarjeta-inicio-contenido">
      <EtiquetasLocal tipo={local.tipo || 'RESTAURANTE'} />
      <h3 className="tarjeta-inicio-nombre">{local.nombre}</h3>
      {cerrado ? <EstadoDisponibilidad cerrado fecha={local.tiempo_reactivacion} compacto /> : <div className="tarjeta-inicio-local-pie">
        {tieneDistancia ? <span className="tarjeta-inicio-distancia"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>{distancia.toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km</span>
          : local.aceptando_pedidos === true ? <span className="tarjeta-inicio-abierto"><span aria-hidden="true" />Abierto</span> : <span />}
        <span className="tarjeta-inicio-ver" aria-hidden="true">Ver local <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></span>
      </div>}
    </div>
  </article>;
}
