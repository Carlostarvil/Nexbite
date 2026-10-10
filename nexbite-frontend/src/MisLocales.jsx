import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { useState } from 'react';
import RegistroRestaurante from './RegistroRestaurante';
import ImagenPortada from './ImagenPortada';
import MensajeAccion from './MensajeAccion';
import { IconoVendedor, TituloVendedor, MetricasVendedor, VacioVendedor, CargandoVendedor, ErrorVendedor } from './VendedorUI';
import { categoriasLocal, textoCategoriaLocal, fechaVendedor } from './vendedorUtils';

const OBTENER_MIS_RESTAURANTES = gql`
  query ObtenerMisRestaurantes {
    obtenerMisRestaurantes {
      id_restaurante nombre tipo imagen_url aceptando_pedidos tiempo_reactivacion
      latitud longitud radio_cobertura_km telefono direccion
      horarios_recogida { dia inicio fin }
    }
  }
`;

export default function MisLocales({ onCrearNuevo, onGestionarMenu, onGestionarPedidos, onLocalActualizado, mensajeInicial, onCerrarMensaje }) {
  const [localEdicion, setLocalEdicion] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('TODOS');
  const { loading, error, data, refetch } = useQuery(OBTENER_MIS_RESTAURANTES, { fetchPolicy: 'network-only', notifyOnNetworkStatusChange: true });
  const locales = data?.obtenerMisRestaurantes || [];
  const abiertos = locales.filter(local => local.aceptando_pedidos !== false).length;
  const visibles = locales.filter(local => (filtro === 'TODOS' || (filtro === 'ABIERTOS' ? local.aceptando_pedidos !== false : local.aceptando_pedidos === false)) && (local.nombre + ' ' + (local.direccion || '')).toLocaleLowerCase('es-ES').includes(busqueda.toLocaleLowerCase('es-ES')));
  const volver = () => { setLocalEdicion(null); window.scrollTo(0, 0); };

  if (localEdicion) return <RegistroRestaurante key={localEdicion.id_restaurante} restaurante={localEdicion}
    onCancelar={volver} onGuardado={local => {
      volver(); onLocalActualizado?.(local);
      setAviso({ tipo: 'exito', titulo: 'Tu local ya está actualizado', descripcion: 'La información se ha guardado y tus clientes verán los cambios.' });
      refetch().catch(() => setAviso({ tipo: 'aviso', titulo: 'Cambios guardados', descripcion: 'No hemos podido actualizar la lista. Pulsa «Volver a intentar» para verla de nuevo.' }));
    }} />;

  return <>
    <TituloVendedor titulo="Mis locales" contexto="Tu espacio NexBite" descripcion="Cuida cada detalle de tu negocio, desde la carta hasta el último pedido." acciones={<button type="button" className="vendedor-btn vendedor-btn-primario" onClick={onCrearNuevo}><IconoVendedor nombre="plus" />Registrar un local</button>} />
    <MensajeAccion mensaje={aviso || mensajeInicial} onCerrar={() => { setAviso(null); onCerrarMensaje?.(); }} />
    {loading && !data ? <CargandoVendedor texto="Preparando tus locales..." /> : error ? <ErrorVendedor descripcion="Comprueba tu conexión para ver tus locales. Los cambios guardados se conservan." onReintentar={() => refetch().catch(() => null)} /> : <>
      <MetricasVendedor items={[{ etiqueta: 'Tus locales', valor: locales.length, icono: 'local' }, { etiqueta: 'Abiertos', valor: abiertos, icono: 'check', tono: 'verde' }, { etiqueta: 'En pausa', valor: locales.length - abiertos, icono: 'pausa', tono: 'ambar' }]} />
      {locales.length === 0 ? <VacioVendedor titulo="Tu próximo gran comienzo" descripcion="Añade tu primer local, prepara tus productos y empieza a recibir pedidos." accion={<button type="button" className="vendedor-btn vendedor-btn-oscuro" onClick={onCrearNuevo}><IconoVendedor nombre="plus" />Crear mi primer local</button>} /> : <>
        <div className="vendedor-toolbar">
          <div className="vendedor-busqueda"><IconoVendedor nombre="buscar" /><input aria-label="Buscar mis locales" placeholder="Busca un local o una dirección" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
          <div className="vendedor-filtros" role="group" aria-label="Filtrar locales">{[['TODOS', 'Todos'], ['ABIERTOS', 'Abiertos'], ['PAUSADOS', 'En pausa']].map(([valor, nombre]) => <button type="button" key={valor} aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>{nombre}</button>)}</div>
        </div>
        {visibles.length === 0 ? <VacioVendedor icono="buscar" titulo="No encontramos ese local" descripcion="Prueba con otro nombre o cambia el filtro." accion={<button type="button" className="vendedor-btn vendedor-btn-secundario" onClick={() => { setBusqueda(''); setFiltro('TODOS'); }}>Ver todos los locales</button>} /> : <div className="vendedor-grid-locales">
          {visibles.map(local => <article className="vendedor-local-card" key={local.id_restaurante} aria-label={local.nombre}>
            <div className="vendedor-local-portada"><ImagenPortada src={local.imagen_url} alt={local.nombre} tipo="local" /><span className={'vendedor-badge' + (local.aceptando_pedidos === false ? ' vendedor-badge-cerrado' : '')}>{local.aceptando_pedidos === false ? 'En pausa' : 'Abierto'}</span></div>
            <div className="vendedor-local-body">
              <div className="vendedor-tags">{categoriasLocal(local.tipo).map(tipo => <span className="vendedor-tag" key={tipo}>{textoCategoriaLocal(tipo)}</span>)}</div><h2>{local.nombre}</h2>
              <div className="vendedor-local-info"><p><IconoVendedor nombre="mapa" /><span>{local.direccion || 'Dirección sin completar'}</span></p><p><IconoVendedor nombre="telefono" /><span>{local.telefono || 'Teléfono sin completar'}</span></p><p><IconoVendedor nombre="radio" /><span>Reparto hasta {local.radio_cobertura_km ?? 10} km</span></p>{local.aceptando_pedidos === false && <p><IconoVendedor nombre="reloj" /><span>{local.tiempo_reactivacion ? 'Reabre: ' + fechaVendedor(local.tiempo_reactivacion) : 'Reanúdalo cuando estés listo'}</span></p>}</div>
              <div className="vendedor-local-acciones"><button type="button" className="vendedor-btn vendedor-btn-oscuro" onClick={() => onGestionarMenu(local)} aria-label={'Gestionar menú de ' + local.nombre}><IconoVendedor nombre="menu" tamano={17} />Menú</button><button type="button" className="vendedor-btn vendedor-btn-secundario" onClick={() => onGestionarPedidos(local)} aria-label={'Gestionar pedidos de ' + local.nombre}><IconoVendedor nombre="pedidos" tamano={17} />Pedidos</button><button type="button" className="vendedor-btn-icono" aria-label={'Editar ' + local.nombre} title="Editar local" onClick={() => { setAviso(null); setLocalEdicion(local); window.scrollTo(0, 0); }}><IconoVendedor nombre="editar" tamano={18} /></button></div>
            </div>
          </article>)}
        </div>}
      </>}
    </>}
  </>;
}
