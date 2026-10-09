import ImagenPlato from './ImagenPlato';
import BotonAgregarCarrito from './BotonAgregarCarrito';
import EstadoDisponibilidad from './EstadoDisponibilidad';
import './TarjetasInicio.css';

const precio = valor => Number(valor || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export default function TarjetaProductoInicio({ plato, onSeleccionar, onAgregar, tieneOferta = false, precioAnterior, noDisponible = false, localCerrado = false, fechaDisponible, repetir = false }) {
  const descripcion = String(plato.descripcion || '').replace(/\|(?:TAGS|ANTES):[\s\S]*/i, '').trim();
  const tienePrecio = plato.precio != null && Number.isFinite(Number(plato.precio));
  return <article className={'tarjeta-inicio tarjeta-inicio-producto' + (noDisponible ? ' tarjeta-inicio-no-disponible' : '')}>
    <button type="button" className="tarjeta-inicio-enlace" aria-label={'Ver ' + (plato.nombre || 'producto')} onClick={() => onSeleccionar(plato)} />
    <div className="tarjeta-inicio-imagen">
      <ImagenPlato plato={plato} style={{ height: '100%' }} />
      {tieneOferta && <span className="tarjeta-inicio-oferta">Oferta</span>}
      {repetir && <span className="tarjeta-inicio-repetir">Lo has pedido antes</span>}
    </div>
    <div className="tarjeta-inicio-contenido">
      {plato.nombre_restaurante && <p className="tarjeta-inicio-local-nombre">{plato.nombre_restaurante}</p>}
      <h3 className="tarjeta-inicio-nombre">{plato.nombre || 'Plato retirado'}</h3>
      {descripcion && <p className="tarjeta-inicio-descripcion">{descripcion}</p>}
      <div className="tarjeta-inicio-producto-pie">
        <div className="tarjeta-inicio-precios"><strong>{tienePrecio ? precio(plato.precio) : 'Precio no disponible'}</strong>{tienePrecio && Number(precioAnterior) > Number(plato.precio) && <del>{precio(precioAnterior)}</del>}</div>
        {noDisponible && <EstadoDisponibilidad cerrado={localCerrado} fecha={fechaDisponible} compacto />}
        <div className="tarjeta-inicio-acciones"><BotonAgregarCarrito onAgregar={event => onAgregar(plato, event)} idPlato={plato.id_plato} nombrePlato={plato.nombre} variante={noDisponible ? 'reserva' : repetir ? 'repetir' : undefined} /></div>
      </div>
    </div>
  </article>;
}
