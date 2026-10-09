import { useRef, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import ImagenPlato from './ImagenPlato';
import MensajeAccion, { IconoEstado } from './MensajeAccion';
import { IconoVendedor, TituloVendedor, MetricasVendedor, CargandoVendedor, ErrorVendedor, VacioVendedor, DialogoVendedor } from './VendedorUI';
import { fechaVendedor } from './vendedorUtils';

const OBTENER_PEDIDOS = gql`query ObtenerPedidosVendedor($id_restaurante: ID!) {
  obtenerPedidosVendedor(id_restaurante: $id_restaurante) { id_pedido nombre_plato estado metodo_pago direccion_envio fecha_pedido fecha_programada imagen_plato id_compra estado_pago mensaje_pago }
  obtenerRestaurantePorId(id_restaurante: $id_restaurante) { id_restaurante aceptando_pedidos tiempo_reactivacion }
}`;
const ACTUALIZAR_PEDIDO = gql`mutation ActualizarEstadoPedido($id_pedido: ID!, $nuevo_estado: String!, $motivo_rechazo: String, $mensaje_personalizado: String) {
  actualizarEstadoPedido(id_pedido: $id_pedido, nuevo_estado: $nuevo_estado, motivo_rechazo: $motivo_rechazo, mensaje_personalizado: $mensaje_personalizado) { id_pedido estado estado_pago mensaje_pago }
}`;
const CAMBIAR_ESTADO_RESTAURANTE = gql`mutation CambiarEstadoRestaurante($id_restaurante: ID!, $aceptando: Boolean!, $tiempo: String) {
  cambiarEstadoRestaurante(id_restaurante: $id_restaurante, aceptando: $aceptando, tiempo: $tiempo) { id_restaurante aceptando_pedidos tiempo_reactivacion }
}`;
const ELIMINAR_PEDIDO = gql`mutation EliminarPedido($id_pedido: ID!) { eliminarPedido(id_pedido: $id_pedido) }`;
const ESTADOS = {
  PROGRAMADO: { texto: 'Programado', tono: 'programado', icono: 'calendario' },
  PENDIENTE: { texto: 'Pendiente', tono: 'pendiente', icono: 'reloj', siguiente: 'PREPARANDO', accion: 'Empezar a preparar' },
  PREPARANDO: { texto: 'En preparación', tono: 'preparando', icono: 'plato', siguiente: 'ENVIADO', accion: 'Marcar como enviado' },
  ENVIADO: { texto: 'En camino', tono: 'enviado', icono: 'entrega', siguiente: 'ENTREGADO', accion: 'Marcar como entregado' },
  ENTREGADO: { texto: 'Entregado', tono: 'entregado', icono: 'check' },
  CANCELADO: { texto: 'Cancelado', tono: 'cancelado', icono: 'cerrar' },
};
const ALIAS = { 'EN COCINA': 'PREPARANDO', 'EN CAMINO': 'ENVIADO', RECHAZADO: 'CANCELADO' };
const estadoCanonico = estado => ALIAS[estado] || estado;
const estadoPedido = estado => ESTADOS[estadoCanonico(estado)] || { texto: estado, tono: 'programado', icono: 'pedidos' };
const fechaMinimaAhora = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const MOTIVOS = ['Falta de ingredientes o stock', 'Zona de entrega fuera de cobertura', 'Cierre adelantado / Problemas técnicos', 'Exceso de pedidos en cocina'];

export default function GestorPedidos({ idRestaurante, nombreRestaurante, estadoPausa, onEstadoLocal }) {
  const [dialogo, setDialogo] = useState(null);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [mensajeExtra, setMensajeExtra] = useState('');
  const [tipoPausa, setTipoPausa] = useState('1 hora');
  const [fechaExacta, setFechaExacta] = useState('');
  const [fechaMinima, setFechaMinima] = useState(fechaMinimaAhora);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('TODOS');
  const [mensaje, setMensaje] = useState(null);
  const [errorDialogo, setErrorDialogo] = useState(null);
  const [accionOcupada, setAccionOcupada] = useState(null);
  const accionRef = useRef(false);
  const { loading, error, data, refetch } = useQuery(OBTENER_PEDIDOS, { variables: { id_restaurante: idRestaurante }, fetchPolicy: 'network-only', notifyOnNetworkStatusChange: true, pollInterval: 30000, skipPollAttempt: () => Boolean(accionOcupada || dialogo) });
  const [actualizarEstado] = useMutation(ACTUALIZAR_PEDIDO);
  const [eliminarPedido] = useMutation(ELIMINAR_PEDIDO);
  const [cambiarEstadoRestaurante] = useMutation(CAMBIAR_ESTADO_RESTAURANTE);
  const pedidos = data?.obtenerPedidosVendedor || [];
  const restaurante = data?.obtenerRestaurantePorId;
  const aceptando = restaurante ? restaurante.aceptando_pedidos !== false : estadoPausa !== false;
  const activos = pedidos.filter(p => ['PENDIENTE', 'PREPARANDO', 'ENVIADO'].includes(estadoCanonico(p.estado)));
  const programados = pedidos.filter(p => p.estado === 'PROGRAMADO');
  const terminados = pedidos.filter(p => ['ENTREGADO', 'CANCELADO'].includes(estadoCanonico(p.estado)));
  const visibles = pedidos.filter(p => (filtro === 'TODOS' || (filtro === 'ACTIVOS' ? activos : filtro === 'PROGRAMADOS' ? programados : terminados).includes(p)) && (String(p.id_pedido) + ' ' + (p.nombre_plato || '') + ' ' + (p.direccion_envio || '')).toLocaleLowerCase('es-ES').includes(busqueda.toLocaleLowerCase('es-ES')));
  const refrescar = () => refetch().catch(() => setMensaje({ tipo: 'aviso', titulo: 'Cambio guardado', descripcion: 'No hemos podido actualizar la lista. Pulsa «Actualizar» para ver los pedidos de nuevo.' }));
  const abrirDialogo = (tipo, pedido = null) => { setDialogo({ tipo, pedido }); setErrorDialogo(null); setMotivo(MOTIVOS[0]); setMensajeExtra(''); setFechaMinima(fechaMinimaAhora()); };
  const cerrarDialogo = () => { if (accionRef.current) return; setDialogo(null); setErrorDialogo(null); };
  const guardarEstado = async (pedido, nuevoEstado, esRechazo = false) => {
    if (accionRef.current) return;
    accionRef.current = true; setAccionOcupada(pedido.id_pedido); setErrorDialogo(null);
    try {
      const resultado = await actualizarEstado({ variables: { id_pedido: pedido.id_pedido, nuevo_estado: nuevoEstado, motivo_rechazo: esRechazo ? motivo : null, mensaje_personalizado: esRechazo ? mensajeExtra.trim() || null : null } });
      if (!resultado.data?.actualizarEstadoPedido) throw new Error('No se pudo confirmar el cambio.');
      setDialogo(null); setMensaje({ tipo: 'exito', titulo: nuevoEstado === 'CANCELADO' ? 'Pedido cancelado' : 'Pedido actualizado', descripcion: (nuevoEstado === 'CANCELADO' && pedido.id_compra ? 'Se ha cancelado la compra completa de este local. ' : '') + 'El pedido #' + pedido.id_pedido + ' está ' + estadoPedido(nuevoEstado).texto.toLocaleLowerCase('es-ES') + '. ' + (resultado.data.actualizarEstadoPedido.mensaje_pago || '') }); await refrescar();
    } catch (err) {
      const aviso = { tipo: 'error', titulo: 'No se pudo actualizar el pedido', descripcion: err.message };
      if (esRechazo) setErrorDialogo(aviso); else setMensaje(aviso);
    } finally { accionRef.current = false; setAccionOcupada(null); }
  };
  const guardarPausa = async nuevoAceptando => {
    if (accionRef.current) return;
    let tiempo = null;
    if (!nuevoAceptando) {
      if (tipoPausa === 'Exacta') {
        const fecha = new Date(fechaExacta);
        if (!fechaExacta || Number.isNaN(fecha.getTime()) || fecha.getTime() <= Date.now()) return setErrorDialogo({ tipo: 'error', titulo: 'Elige una fecha futura', descripcion: 'Indica el día y la hora en los que quieres volver a abrir.' });
        tiempo = fecha.toISOString();
      } else tiempo = tipoPausa;
    }
    accionRef.current = true; setAccionOcupada('local'); setErrorDialogo(null);
    try {
      const resultado = await cambiarEstadoRestaurante({ variables: { id_restaurante: idRestaurante, aceptando: nuevoAceptando, tiempo } });
      const local = resultado.data?.cambiarEstadoRestaurante;
      if (!local) throw new Error('No se pudo confirmar el cambio.');
      onEstadoLocal?.(local); setDialogo(null); setMensaje({ tipo: 'exito', titulo: nuevoAceptando ? 'Tu local vuelve a estar abierto' : 'Tu local está en pausa', descripcion: nuevoAceptando ? 'Ya aparece abierto para tus clientes.' : 'Tus clientes verán el local como cerrado.' }); await refrescar();
    } catch (err) {
      const aviso = { tipo: 'error', titulo: 'No se pudo cambiar el estado del local', descripcion: err.message };
      if (nuevoAceptando) setMensaje(aviso); else setErrorDialogo(aviso);
    } finally { accionRef.current = false; setAccionOcupada(null); }
  };
  const confirmarEliminar = async () => {
    if (accionRef.current) return;
    accionRef.current = true; setAccionOcupada(dialogo.pedido.id_pedido); setErrorDialogo(null);
    try {
      const resultado = await eliminarPedido({ variables: { id_pedido: dialogo.pedido.id_pedido } });
      if (!resultado.data?.eliminarPedido) throw new Error('No se pudo confirmar la eliminación.');
      setMensaje({ tipo: 'exito', titulo: 'Pedido eliminado del historial', descripcion: 'El pedido #' + dialogo.pedido.id_pedido + ' se ha eliminado.' }); setDialogo(null); await refrescar();
    } catch (err) { setErrorDialogo({ tipo: 'error', titulo: 'No se pudo eliminar el pedido', descripcion: err.message }); }
    finally { accionRef.current = false; setAccionOcupada(null); }
  };
  const ocupado = accionOcupada != null;

  return <>
    <TituloVendedor titulo="Pedidos" contexto={nombreRestaurante} descripcion="Cada pedido, en su momento. Organízalos de principio a fin." acciones={<button type="button" className="vendedor-btn vendedor-btn-secundario" disabled={loading || ocupado} onClick={() => refetch().catch(() => null)}><IconoVendedor nombre="refrescar" tamano={17} />{loading ? 'Actualizando...' : 'Actualizar'}</button>} />
    <MensajeAccion mensaje={mensaje} onCerrar={() => setMensaje(null)} />
    {loading && !data ? <CargandoVendedor texto="Preparando tus pedidos..." /> : error ? <ErrorVendedor descripcion="No hemos podido recuperar los pedidos. Comprueba tu conexión y vuelve a intentarlo." onReintentar={() => refetch().catch(() => null)} /> : <>
      <section className={'vendedor-local-estado' + (!aceptando ? ' vendedor-local-estado-cerrado' : '')} aria-label="Disponibilidad del local"><div className="vendedor-local-estado-info"><span><IconoVendedor nombre={aceptando ? 'local' : 'pausa'} tamano={25} /></span><div><h2>{aceptando ? 'Tu local está abierto' : 'Tu local está en pausa'}</h2><p>{aceptando ? 'Listo para recibir nuevos pedidos. Puedes tomar una pausa cuando lo necesites.' : restaurante?.tiempo_reactivacion ? 'Reapertura: ' + fechaVendedor(restaurante.tiempo_reactivacion) : 'Tus clientes lo ven cerrado. Reanúdalo cuando estés listo.'}</p></div></div><button type="button" className={'vendedor-btn ' + (aceptando ? 'vendedor-btn-secundario' : 'vendedor-btn-oscuro')} disabled={ocupado} onClick={() => aceptando ? abrirDialogo('pausa') : guardarPausa(true)}>{accionOcupada === 'local' ? <IconoEstado tipo="cargando" tamano={18} /> : <IconoVendedor nombre={aceptando ? 'pausa' : 'play'} tamano={18} />}{aceptando ? 'Pausar local' : 'Reanudar local'}</button></section>
      <MetricasVendedor items={[{ etiqueta: 'Pedidos recibidos', valor: pedidos.length, icono: 'pedidos' }, { etiqueta: 'Pendientes', valor: pedidos.filter(p => p.estado === 'PENDIENTE').length, icono: 'reloj', tono: 'ambar' }, { etiqueta: 'En preparación o camino', valor: activos.filter(p => p.estado !== 'PENDIENTE').length, icono: 'entrega', tono: 'azul' }]} />
      {pedidos.length === 0 ? <VacioVendedor icono="pedidos" titulo="Todo listo para el próximo pedido" descripcion="Los pedidos de este local aparecerán aquí. La lista se actualiza automáticamente." /> : <>
        <div className="vendedor-toolbar"><div className="vendedor-busqueda"><IconoVendedor nombre="buscar" /><input aria-label="Buscar pedidos" placeholder="Busca por número, producto o dirección" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div><div className="vendedor-filtros" role="group" aria-label="Filtrar pedidos">{[['TODOS', 'Todos'], ['ACTIVOS', 'Activos'], ['PROGRAMADOS', 'Programados'], ['FINALIZADOS', 'Finalizados']].map(([valor, texto]) => <button type="button" key={valor} aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>{texto}</button>)}</div></div>
        {visibles.length === 0 ? <VacioVendedor icono="buscar" titulo="No hay pedidos en esta vista" descripcion="Cambia el filtro o busca otro número de pedido." accion={<button type="button" className="vendedor-btn vendedor-btn-secundario" onClick={() => { setFiltro('TODOS'); setBusqueda(''); }}>Ver todos los pedidos</button>} /> : <div className="vendedor-pedidos-lista">{visibles.map(pedido => {
          const estado = estadoPedido(pedido.estado);
          return <article key={pedido.id_pedido} className={'vendedor-pedido vendedor-pedido-' + estado.tono} aria-label={'Pedido ' + pedido.id_pedido}>
            <div className="vendedor-pedido-cabecera"><span className="vendedor-pedido-id">PEDIDO #{pedido.id_pedido}{pedido.fecha_pedido && ' · ' + fechaVendedor(pedido.fecha_pedido)}</span><span className={'vendedor-pedido-estado vendedor-pedido-estado-' + estado.tono}><IconoVendedor nombre={estado.icono} tamano={13} />{estado.texto}</span></div>
            <div className="vendedor-pedido-detalle">{pedido.imagen_plato ? <ImagenPlato plato={{ nombre: pedido.nombre_plato, imagen_url: pedido.imagen_plato }} className="vendedor-pedido-imagen" style={{ width: '60px', height: '60px', flexShrink: 0, borderRadius: '12px' }} /> : <span className="vendedor-pedido-dibujo"><IconoVendedor nombre="pedidos" tamano={25} /></span>}<div style={{ minWidth: 0 }}><h2>{pedido.estado_pago === 'AUTORIZADA' && <small>Confirmando el pago · </small>}{pedido.nombre_plato || 'Producto retirado'}</h2><div className="vendedor-pedido-meta"><p><IconoVendedor nombre="mapa" tamano={15} /><span>{pedido.direccion_envio || 'Dirección no indicada'}</span></p><p><IconoVendedor nombre="escudo" tamano={15} /><span>{pedido.metodo_pago === 'EFECTIVO' ? 'Pago en efectivo' : pedido.metodo_pago === 'TARJETA' ? 'Pago con tarjeta' : pedido.metodo_pago || 'Pago no indicado'}</span></p>{pedido.estado === 'PROGRAMADO' && pedido.fecha_programada && <p><IconoVendedor nombre="calendario" tamano={15} /><span>Programado para {fechaVendedor(pedido.fecha_programada)}</span></p>}</div></div></div>
            <div className="vendedor-pedido-pie"><label className="vendedor-pedido-select"><span>Estado</span><select aria-label={'Estado del pedido ' + pedido.id_pedido} value={pedido.estado} disabled={ocupado || ['ENTREGADO','CANCELADO','RECHAZADO'].includes(pedido.estado)} onChange={e => e.target.value === 'CANCELADO' ? abrirDialogo('rechazo', pedido) : guardarEstado(pedido, e.target.value)}>{!['PENDIENTE', 'PREPARANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'].includes(pedido.estado) && <option value={pedido.estado}>{estado.texto}</option>}{['PENDIENTE', 'PREPARANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'].map(valor => <option key={valor} value={valor} disabled={valor !== 'CANCELADO' && (pedido.estado === 'PROGRAMADO' || Boolean(pedido.id_compra && pedido.estado_pago !== 'CONFIRMADA'))}>{ESTADOS[valor].texto}</option>)}</select></label>{estado.siguiente && <button type="button" className="vendedor-btn vendedor-btn-oscuro" disabled={ocupado || Boolean(pedido.id_compra && pedido.estado_pago !== 'CONFIRMADA')} onClick={() => guardarEstado(pedido, estado.siguiente)}>{accionOcupada === pedido.id_pedido ? <IconoEstado tipo="cargando" tamano={16} /> : <IconoVendedor nombre={estadoPedido(estado.siguiente).icono} tamano={16} />}{estado.accion}</button>}<button type="button" className="vendedor-btn-icono vendedor-btn-icono-peligro" disabled={ocupado || Boolean(pedido.id_compra)} onClick={() => abrirDialogo('eliminar', pedido)} aria-label={'Eliminar pedido ' + pedido.id_pedido} title="Eliminar del historial"><IconoVendedor nombre="papelera" tamano={18} /></button></div>
          </article>;
        })}</div>}
      </>}
    </>}
    {dialogo && <DialogoVendedor titulo={dialogo.tipo === 'pausa' ? 'Un momento para tu negocio' : dialogo.tipo === 'rechazo' ? 'Cancelar este pedido' : '¿Eliminar del historial?'} descripcion={dialogo.tipo === 'pausa' ? 'Tu local se mostrará como cerrado hasta que lo reanudes o termine la pausa.' : dialogo.tipo === 'rechazo' ? 'Indica por qué no puedes atender el pedido #' + dialogo.pedido.id_pedido + '. Puedes añadir un mensaje para el cliente.' : 'El pedido #' + dialogo.pedido.id_pedido + ' se eliminará de forma permanente. Esta acción no se puede deshacer.'} icono={dialogo.tipo === 'pausa' ? 'pausa' : dialogo.tipo === 'rechazo' ? 'pedidos' : 'papelera'} ocupado={ocupado} onCerrar={cerrarDialogo} mensaje={errorDialogo} acciones={<><button type="button" className="vendedor-btn vendedor-btn-secundario" disabled={ocupado} onClick={cerrarDialogo}>Volver</button><button type="button" className={'vendedor-btn ' + (dialogo.tipo === 'pausa' ? 'vendedor-btn-primario' : 'vendedor-btn-peligro')} disabled={ocupado} onClick={() => dialogo.tipo === 'pausa' ? guardarPausa(false) : dialogo.tipo === 'rechazo' ? guardarEstado(dialogo.pedido, 'CANCELADO', true) : confirmarEliminar()}>{ocupado && <IconoEstado tipo="cargando" tamano={18} />}{ocupado ? 'Guardando...' : dialogo.tipo === 'pausa' ? 'Pausar local' : dialogo.tipo === 'rechazo' ? 'Confirmar cancelación' : 'Eliminar pedido'}</button></>}>
      {dialogo.tipo === 'pausa' ? <><label className="vendedor-campo"><span>Duración de la pausa</span><select aria-label="Duración de la pausa" disabled={ocupado} value={tipoPausa} onChange={e => { setTipoPausa(e.target.value); setErrorDialogo(null); }}><option value="30 minutos">30 minutos</option><option value="1 hora">1 hora</option><option value="2 horas">2 horas</option><option value="1 día">1 día</option><option value="Exacta">Hasta un día y hora concretos</option><option value="Indefinido">Hasta que lo reanude</option></select></label>{tipoPausa === 'Exacta' && <label className="vendedor-campo"><span>Fecha y hora de reapertura</span><input type="datetime-local" value={fechaExacta} min={fechaMinima} disabled={ocupado} onChange={e => { setFechaExacta(e.target.value); setErrorDialogo(null); }} /></label>}</> : dialogo.tipo === 'rechazo' && <><label className="vendedor-campo"><span>Motivo de la cancelación</span><select aria-label="Motivo de la cancelación" disabled={ocupado} value={motivo} onChange={e => setMotivo(e.target.value)}>{MOTIVOS.map(valor => <option key={valor}>{valor}</option>)}</select></label><label className="vendedor-campo"><span>Mensaje para el cliente (opcional)</span><textarea aria-label="Mensaje para el cliente (opcional)" disabled={ocupado} value={mensajeExtra} placeholder="Explica brevemente qué ha ocurrido..." onChange={e => setMensajeExtra(e.target.value)} /></label></>}
    </DialogoVendedor>}
  </>;
}
