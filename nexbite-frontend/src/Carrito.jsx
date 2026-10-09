import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useApolloClient } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { generarOpcionesRecogida, recogidaDisponible } from '../../shared/horariosRecogida.js';
import { coordenadasValidas, validarZonaEntrega, calcularDistancia } from '../../shared/zonaEntrega.js';
import MensajeAccion, { IconoEstado } from './MensajeAccion';
import DireccionLocal from './DireccionLocal';
import IconoInfoRestaurante from './IconoInfoRestaurante';
import ImagenPlato from './ImagenPlato';
import { centimos, configuracionEnvio, costeEnvio } from '../../shared/preciosCompra.js';
import './Carrito.css';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_51TvpS8Q6Lca9bAZqO8Skya79dRCVkCyvtSrQqZkCUHVdM43VK4xQUCBzANz8i3BbUFEISBeJdo1mb8Uj1lahMH9q009ej7QEHn');

const PREPARAR_COMPRA = gql`
  mutation PrepararCompra($input: CompraInput!) {
    prepararCompra(input: $input) {
      id_compra estado subtotal envio total client_secret fecha_programada autorizacion_hasta mensaje
      items { id_plato nombre cantidad precio } pedidos { id_pedido }
    }
  }
`;
const CONFIRMAR_COMPRA = gql`
  mutation ConfirmarCompra($id: ID!) {
    confirmarCompra(id_compra: $id) {
      id_compra estado subtotal envio total fecha_programada autorizacion_hasta mensaje
      items { id_plato nombre cantidad precio } pedidos { id_pedido }
    }
  }
`;
const CONSULTAR_COMPRA = gql`
  query ConsultarCompra($id: ID!) {
    consultarCompra(id_compra: $id) {
      id_compra estado subtotal envio total fecha_programada autorizacion_hasta mensaje
      items { id_plato nombre cantidad precio } pedidos { id_pedido }
    }
  }
`;

const OBTENER_MIS_TARJETAS = gql`
  query ObtenerMisTarjetas($id_usuario: ID!) {
    obtenerMisTarjetas(id_usuario: $id_usuario) { id brand last4 name }
  }
`;

const CREAR_CONFIGURACION_TARJETA = gql`
  mutation CrearConfiguracionTarjeta { crearConfiguracionTarjeta }
`;

const ELIMINAR_TARJETA_GUARDADA = gql`
  mutation EliminarTarjetaGuardada($id_tarjeta: ID!) {
    eliminarTarjetaGuardada(id_tarjeta: $id_tarjeta)
  }
`;

const OBTENER_ESTADO_RESTAURANTE = gql`
  query ObtenerEstadoRestaurante($id: ID!) {
    obtenerRestaurantePorId(id_restaurante: $id) { 
      nombre
      tipo
      aceptando_pedidos
      tiempo_reactivacion
      direccion
      latitud
      longitud 
      radio_cobertura_km
      horarios_recogida { dia inicio fin }
    }
  }
`;

const OBTENER_INFO_BASICA_REST = gql`
  query ObtenerInfoBasica($id: ID!) {
    obtenerRestaurantePorId(id_restaurante: $id) { nombre, imagen_url }
  }
`;

// Función segura para procesar cualquier formato de fecha sin que dé "Invalid date"
const parsearFechaSegura = (fechaStr) => {
  if (!fechaStr || String(fechaStr).includes('Indefinido')) return null;
  const timestamp = !isNaN(fechaStr) && String(fechaStr).trim() !== '' ? Number(fechaStr) : fechaStr;
  const fecha = new Date(timestamp);
  return isNaN(fecha.getTime()) ? null : fecha;
};

function IconoPapelera() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7" />
  </svg>;
}

function TarjetaCarritoGrupo({ grupo, onSeleccionar, onEliminar }) {
  const { data } = useQuery(OBTENER_INFO_BASICA_REST, { variables: { id: grupo.id_restaurante } });
  const rest = data?.obtenerRestaurantePorId;
  const total = grupo.platos.reduce((sum, p) => sum + (p.precio * (p.cantidad || 1)), 0);

  return (
    <div className="carrito-grupo">
      <button type="button" className="carrito-grupo-abrir" onClick={() => onSeleccionar(grupo.id_restaurante)} aria-label={'Ver pedido de ' + (rest?.nombre || 'este local')}>
      {rest?.imagen_url ? (
        <img src={rest.imagen_url} alt="" className="carrito-foto" />
      ) : (
        <span className="carrito-foto carrito-foto-vacia" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v2H3z"></path><path d="M4 11v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9"></path><path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"></path><path d="M12 11v10"></path></svg>
        </span>
      )}
      <span className="carrito-grupo-info">
        <strong className="carrito-grupo-nombre">{rest?.nombre || 'Cargando...'}</strong>
        <span className="carrito-grupo-articulos">{grupo.totalItems} artículo{grupo.totalItems > 1 ? 's' : ''}</span>
      </span>
      <span className="carrito-grupo-resumen">
        <strong className="carrito-grupo-precio">{total.toFixed(2)}&nbsp;€</strong>
        <span className="carrito-grupo-ver">Ver pedido &rarr;</span>
      </span>
      </button>
      <button type="button" className="carrito-eliminar carrito-grupo-eliminar"
        onClick={() => onEliminar(grupo.id_restaurante)}
        aria-label={'Eliminar carrito de ' + (rest?.nombre || 'este local')}
        title="Eliminar este carrito"
      >
        <IconoPapelera />
      </button>
    </div>
  );
}

function CarritoInterno({ carrito, setCarrito, onVolver, vaciarCarrito, idUsuario, ubicacionEntrega, onCambiarUbicacion, tipoEntregaInicial = 'DOMICILIO', idRestauranteInicial = null, irAPago = false, onPedidoConfirmado }) {
  const stripe = useStripe();
  const clienteApollo = useApolloClient();
  const elements = useElements();

  const [idCartSeleccionado, setIdCartActivo] = useState(() => idRestauranteInicial == null ? null : carrito.find(plato => String(plato.id_restaurante) === String(idRestauranteInicial))?.id_restaurante ?? null);
  const idsCarritos = [...new Set(carrito.map(p => p.id_restaurante))];
  const idCartActivo = idsCarritos.includes(idCartSeleccionado) ? idCartSeleccionado : idsCarritos.length === 1 ? idsCarritos[0] : null;
  const formularioPago = useRef(null);
  
  const [modalIntercepcion, setModalIntercepcion] = useState(null);

  useEffect(() => {
    if (irAPago && idCartActivo && formularioPago.current) {
      formularioPago.current.focus({ preventScroll: true });
      formularioPago.current.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }, [irAPago, idCartActivo]);
  
  const [tipoEntrega, setTipoEntrega] = useState(tipoEntregaInicial);
  
  const [seleccionesRecogida, setSeleccionesRecogida] = useState({});
  const {
    mostrarModalProgramar = false, modoRecogida = 'AHORA', diaProgramado = '',
    horaProgramada = '', horaSeleccionadaTemp = '',
  } = seleccionesRecogida[idCartActivo] || {};
  const actualizarRecogida = cambios => setSeleccionesRecogida(anterior => ({
    ...anterior, [idCartActivo]: { ...anterior[idCartActivo], ...cambios },
  }));
  const setMostrarModalProgramar = valor => actualizarRecogida({ mostrarModalProgramar: valor });
  const setModoRecogida = valor => actualizarRecogida({ modoRecogida: valor });
  const setDiaProgramado = valor => actualizarRecogida({ diaProgramado: valor });
  const setHoraProgramada = valor => actualizarRecogida({ horaProgramada: valor });
  const setHoraSeleccionadaTemp = valor => actualizarRecogida({ horaSeleccionadaTemp: valor });
  
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const direccion = ubicacionEntrega?.direccion || '';
  const [detallesDireccion, setDetallesDireccion] = useState('');
  const coordenadasEnvio = ubicacionEntrega;
  
  const [metodoPago, setMetodoPago] = useState('TARJETA');

  const { data: datosTarjetas, loading: cargandoTarjetas, error: errorTarjetas, refetch: refrescarTarjetas } = useQuery(OBTENER_MIS_TARJETAS, {
    variables: { id_usuario: idUsuario }, skip: !idUsuario, fetchPolicy: 'network-only',
  });
  const tarjetas = datosTarjetas?.obtenerMisTarjetas || [];
  const [idTarjetaSeleccionada, setTarjetaSeleccionada] = useState(null);
  const tarjetaSeleccionada = tarjetas.some(t => t.id === idTarjetaSeleccionada) ? idTarjetaSeleccionada : tarjetas[0]?.id || null;
  const [tarjetasAntiguas, setTarjetasAntiguas] = useState(() => {
    try {
      const anteriores = JSON.parse(localStorage.getItem('nexbite_tarjetas'));
      return Array.isArray(anteriores) && anteriores.length > 0;
    } catch { return false; }
  });
  const [mostrarModalTarjeta, setMostrarModalTarjeta] = useState(false);
  const [nuevoTitular, setNuevoTitular] = useState('');
  const [guardandoTarjeta, setGuardandoTarjeta] = useState(false);
  const guardadoEnCurso = useRef(false);
  const [eliminandoTarjeta, setEliminandoTarjeta] = useState(null);
  const [crearConfiguracion] = useMutation(CREAR_CONFIGURACION_TARJETA);
  const [quitarTarjeta] = useMutation(ELIMINAR_TARJETA_GUARDADA);
  const pagoEnCurso = useRef(false);
  const intentosPago = useRef(new Map());
  const [compraPorComprobar, setCompraPorComprobar] = useState(null);
  const [cotizacion, setCotizacion] = useState(null);
  const [mensajePago, setMensajePago] = useState(null);
  const mensajePagoRef = useRef(null);
  
  useEffect(() => {
    if (mensajePago && mensajePagoRef.current) {
      mensajePagoRef.current.focus({ preventScroll: true });
      mensajePagoRef.current.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }, [mensajePago]);
  const mostrarMensajePago = (titulo, descripcion, tipo = 'error') => setMensajePago({ titulo, descripcion, tipo, idRestaurante: idCartActivo });

  const [direccionResuelta, setDireccionResuelta] = useState(null);

  const handleGuardarTarjeta = async () => {
    if (guardadoEnCurso.current || pagoEnCurso.current) return;
    if (!nuevoTitular.trim()) return alert("Ingresa el nombre del titular de la tarjeta.");
    if (!stripe || !elements) return alert('El sistema de tarjetas está cargando. Inténtalo en unos segundos.');
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;
    guardadoEnCurso.current = true;
    setGuardandoTarjeta(true);
    let guardada = false;
    try {
      const { data } = await crearConfiguracion();
      const resultado = await stripe.confirmCardSetup(data.crearConfiguracionTarjeta, {
        payment_method: { card: cardEl, billing_details: { name: nuevoTitular.trim() } },
      });
      if (resultado.error) throw new Error(resultado.error.message);
      if (resultado.setupIntent?.status !== 'succeeded') throw new Error('Completa la verificación de tu tarjeta antes de guardarla.');
      guardada = true;
      const metodo = resultado.setupIntent.payment_method;
      setTarjetaSeleccionada(typeof metodo === 'string' ? metodo : metodo?.id);
      setMostrarModalTarjeta(false);
      setNuevoTitular('');
      cardEl.clear();
      setTarjetasAntiguas(false);
      localStorage.removeItem('nexbite_tarjetas');
      const resultadoTarjetas = await refrescarTarjetas();
      if (resultadoTarjetas.error) throw resultadoTarjetas.error;
    } catch (error) {
      alert(guardada ? 'La tarjeta se ha guardado. No se ha podido actualizar la lista; pulsa Reintentar.' : 'No se ha podido guardar la tarjeta: ' + error.message);
    } finally {
      guardadoEnCurso.current = false;
      setGuardandoTarjeta(false);
    }
  };

  const eliminarTarjeta = async (id, e) => {
    e.stopPropagation();
    if (eliminandoTarjeta || guardadoEnCurso.current || pagoEnCurso.current) return;
    setEliminandoTarjeta(id);
    try {
      await quitarTarjeta({ variables: { id_tarjeta: id } });
      const resultado = await refrescarTarjetas();
      if (resultado.error) throw resultado.error;
      if (tarjetaSeleccionada === id) setTarjetaSeleccionada(null);
    } catch (error) {
      alert('No se ha podido actualizar la tarjeta: ' + error.message);
    } finally {
      setEliminandoTarjeta(null);
    }
  };

  const [procesandoStripe, setProcesandoStripe] = useState(false);
  const [prepararCompra, { loading: preparandoCompra }] = useMutation(PREPARAR_COMPRA);
  const [confirmarCompra, { loading: confirmandoCompra }] = useMutation(CONFIRMAR_COMPRA);
  const procesandoPago = preparandoCompra || confirmandoCompra;

  const gruposObj = carrito.reduce((acc, plato) => {
    if (!acc[plato.id_restaurante]) acc[plato.id_restaurante] = { id_restaurante: plato.id_restaurante, platos: [], totalItems: 0 };
    acc[plato.id_restaurante].platos.push(plato);
    acc[plato.id_restaurante].totalItems += (plato.cantidad || 1);
    return acc;
  }, {});
  const grupos = Object.values(gruposObj);


  const carritoEnUso = idCartActivo ? carrito.filter(p => p.id_restaurante === idCartActivo) : [];
  const idRestauranteCarrito = idCartActivo;

  const aumentarCantidad = (id_plato) => { if (!pagoEnCurso.current && !compraPorComprobar) setCarrito(carrito.map(p => String(p.id_plato) === String(id_plato) ? { ...p, cantidad: (p.cantidad || 1) + 1 } : p)); };
  const disminuirCantidad = (id_plato) => { if (!pagoEnCurso.current) setCarrito(carrito.map(p => (String(p.id_plato) === String(id_plato) && p.cantidad > 1) ? { ...p, cantidad: p.cantidad - 1 } : p)); };
  const eliminarPlato = (id_plato) => { if (!pagoEnCurso.current) setCarrito(carrito.filter(p => p.id_plato !== id_plato)); };

  const { data: dataRest, loading: cargandoRestaurante, error: errorRestaurante } = useQuery(OBTENER_ESTADO_RESTAURANTE, { variables: { id: idRestauranteCarrito }, skip: !idRestauranteCarrito });
  const restaurante = dataRest?.obtenerRestaurantePorId;
  
  // FUNCIONES DE INSPECCIÓN EN CASCADA (PARA MENÚS PROFUNDOS)
  const subPropiedades = ['platos', 'opciones', 'sub_platos', 'seleccion', 'componentes', 'items', 'elecciones', 'platos_menu', 'items_menu'];

  const esIndefinido = (plato) => {
    if (plato.disponible === false && (!plato.tiempo_disponible || String(plato.tiempo_disponible).includes('Indefinido'))) {
      return true;
    }
    for (const prop of subPropiedades) {
      if (Array.isArray(plato[prop])) {
        if (plato[prop].some(sub => {
          const inner = sub.plato || sub;
          return inner && inner.disponible === false && (!inner.tiempo_disponible || String(inner.tiempo_disponible).includes('Indefinido'));
        })) return true;
      }
    }
    return false;
  };

  const esTemporal = (plato) => {
    if (plato.disponible === false && plato.tiempo_disponible && !String(plato.tiempo_disponible).includes('Indefinido')) {
      return true;
    }
    for (const prop of subPropiedades) {
      if (Array.isArray(plato[prop])) {
        if (plato[prop].some(sub => {
          const inner = sub.plato || sub;
          return inner && inner.disponible === false && inner.tiempo_disponible && !String(inner.tiempo_disponible).includes('Indefinido');
        })) return true;
      }
    }
    return false;
  };

  const obtenerNombresSubPausados = (plato, soloIndefinidos = false) => {
    const listado = [];
    subPropiedades.forEach(prop => {
      if (Array.isArray(plato[prop])) {
        plato[prop].forEach(sub => {
          const inner = sub.plato || sub;
          if (inner && inner.disponible === false) {
            const esIndef = !inner.tiempo_disponible || String(inner.tiempo_disponible).includes('Indefinido');
            if (soloIndefinidos && !esIndef) return;
            if (!soloIndefinidos && esIndef) return;
            listado.push(inner.nombre);
          }
        });
      }
    });
    return listado;
  };

  const obtenerMaxTiempoCascada = (plato) => {
    let subMax = 0;
    subPropiedades.forEach(prop => {
      if (Array.isArray(plato[prop])) {
        plato[prop].forEach(sub => {
          const inner = sub.plato || sub;
          if (inner && inner.disponible === false && inner.tiempo_disponible && !String(inner.tiempo_disponible).includes('Indefinido')) {
            const f = parsearFechaSegura(inner.tiempo_disponible);
            if (f && f.getTime() > subMax) subMax = f.getTime();
          }
        });
      }
    });
    return subMax > 0 ? new Date(subMax) : null;
  };

  // Categorizar platos pausados con el validador en cascada restaurado
  const platosIndefinidos = carritoEnUso.filter(esIndefinido);
  const platosTemporales = carritoEnUso.filter(p => !esIndefinido(p) && esTemporal(p));

  // Algoritmo para calcular el "Tiempo Efectivo" de disponibilidad (recursivo para menús)
  const maxTiempoEfectivo = (() => {
    let maxTime = ahora.getTime();
    
    // 1. Revisar si hay platos pausados y coger el que más tarde (incluyendo sub-componentes)
    platosTemporales.forEach(p => {
      const dateObj = parsearFechaSegura(p.tiempo_disponible);
      if (dateObj && dateObj.getTime() > maxTime) {
        maxTime = dateObj.getTime();
      }
      const cascadaDate = obtenerMaxTiempoCascada(p);
      if (cascadaDate && cascadaDate.getTime() > maxTime) {
        maxTime = cascadaDate.getTime();
      }
    });

    // 2. Si el restaurante está cerrado, también se respeta su tiempo de apertura
    if (restaurante && !restaurante.aceptando_pedidos && restaurante.tiempo_reactivacion) {
      const dateObj = parsearFechaSegura(restaurante.tiempo_reactivacion);
      if (dateObj && dateObj.getTime() > maxTime) {
        maxTime = dateObj.getTime();
      }
    }
    
    return maxTime;
  })();

  const latitudLocal = restaurante?.latitud;
  const longitudLocal = restaurante?.longitud;
  const direccionGuardadaLocal = restaurante?.direccion?.trim();
  const tieneCoordenadasLocal = coordenadasValidas(latitudLocal, longitudLocal);
  const direccionRestaurante = direccionGuardadaLocal ||
    (direccionResuelta && direccionResuelta.latitud === latitudLocal && direccionResuelta.longitud === longitudLocal ? direccionResuelta.texto : '') ||
    (tieneCoordenadasLocal ? Number(latitudLocal).toFixed(5) + ', ' + Number(longitudLocal).toFixed(5) : 'Ubicación del local no especificada');
  const destinoLocal = tieneCoordenadasLocal ? latitudLocal + ',' + longitudLocal : direccionGuardadaLocal;
  const urlUbicacionLocal = destinoLocal ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(destinoLocal) : null;
  
  // Le pasamos 'maxTiempoEfectivo' al generador en lugar de 'ahora'
  const opcionesRecogida = restaurante ? generarOpcionesRecogida(restaurante.horarios_recogida, new Date(maxTiempoEfectivo)) : [];
  const diasDisponibles = opcionesRecogida;
  const horasDisponiblesList = diasDisponibles.find(dia => dia.valor === diaProgramado)?.horas || [];
  const opcionProgramada = diasDisponibles.flatMap(dia => dia.horas).find(hora => hora.valor === horaProgramada);
  const diaConfirmado = diasDisponibles.find(dia => dia.horas.some(hora => hora.valor === horaProgramada));
  
  // La recogida "AHORA" se desactiva matemáticamente si hay algo pausado
  const restauranteCerrado = restaurante ? !restaurante.aceptando_pedidos : false;
  const recogidaAhoraDisponible = restaurante && !restauranteCerrado && platosTemporales.length === 0 && platosIndefinidos.length === 0 && recogidaDisponible(restaurante.horarios_recogida, ahora, 15);

  let errorZonaEntrega = '';
  if (tipoEntrega === 'DOMICILIO' && restaurante && !cargandoRestaurante) {
    try { validarZonaEntrega(restaurante, coordenadasEnvio?.lat, coordenadasEnvio?.lng); }
    catch (error) { errorZonaEntrega = error.message; }
  }

  useEffect(() => {
    if (direccionGuardadaLocal || !tieneCoordenadasLocal) return;
    const controlador = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitudLocal}&lon=${longitudLocal}`, { signal: controlador.signal })
      .then(res => { if (!res.ok) throw new Error('No se pudo obtener la dirección'); return res.json(); })
      .then(data => {
        if (data?.display_name) setDireccionResuelta({ latitud: latitudLocal, longitud: longitudLocal, texto: data.display_name.split(', ').slice(0, 3).join(', ') });
      })
      .catch(() => {});
    return () => controlador.abort();
  }, [direccionGuardadaLocal, tieneCoordenadasLocal, latitudLocal, longitudLocal]);

  // LÓGICA DE PRECIOS, DISTANCIA Y ENVÍO
  const direccionFinal = tipoEntrega === 'RECOGIDA' ? 'RECOGIDA EN LOCAL' : (detallesDireccion.trim() ? direccion + '\nDetalles: ' + detallesDireccion : direccion);
  const solicitud = {
    id_restaurante: String(idCartActivo), items: carritoEnUso.map(p => ({ id_plato: String(p.id_plato), cantidad: p.cantidad || 1 })),
    metodo_pago: metodoPago, id_tarjeta: metodoPago === 'TARJETA' ? tarjetaSeleccionada : null,
    tipo_entrega: tipoEntrega, direccion_envio: direccionFinal,
    fecha_programada: modoRecogida === 'PROGRAMADO' ? horaProgramada || null : null,
    latitud_cliente: tipoEntrega === 'DOMICILIO' ? coordenadasEnvio?.lat ?? null : null,
    longitud_cliente: tipoEntrega === 'DOMICILIO' ? coordenadasEnvio?.lng ?? null : null,
  };
  const huellaCompra = JSON.stringify(solicitud);
  const cotizacionActual = cotizacion?.huella === huellaCompra ? cotizacion.compra : null;
  const subtotalEstimado = carritoEnUso.reduce((suma, plato) => suma + centimos(plato.precio) * (plato.cantidad || 1), 0);
  const { gratisDesde } = configuracionEnvio(restaurante?.tipo);
  const distanciaKm = tipoEntrega === 'DOMICILIO' && tieneCoordenadasLocal && coordenadasValidas(coordenadasEnvio?.lat, coordenadasEnvio?.lng)
    ? calcularDistancia(latitudLocal, longitudLocal, coordenadasEnvio.lat, coordenadasEnvio.lng) : 0;
  const subtotal = cotizacionActual?.subtotal ?? subtotalEstimado / 100;
  const gastosEnvio = cotizacionActual?.envio ?? costeEnvio(subtotalEstimado, restaurante?.tipo, distanciaKm, tipoEntrega === 'RECOGIDA') / 100;
  const superaGratis = centimos(subtotal) >= centimos(gratisDesde);
  const totalFinal = cotizacionActual?.total ?? subtotal + gastosEnvio;

  const iniciarPago = () => {
    if (compraPorComprobar) { handlePagar(); return; }
    if (carritoEnUso.length === 0) return mostrarMensajePago('Tu carrito está vacío', 'Añade un plato para continuar con el pedido.');
    if (tipoEntrega === 'DOMICILIO' && (!direccion.trim() || !coordenadasEnvio)) return mostrarMensajePago('Elige dónde recibir tu pedido', 'Selecciona una dirección de entrega antes de continuar.');

    const tieneReserva = modoRecogida === 'PROGRAMADO' && opcionProgramada;

    // 1. Interceptar si hay platos agotados indefinidamente
    if (platosIndefinidos.length > 0) {
      setModalIntercepcion('PLATOS_PAUSADOS');
      return;
    }

    // 2. Interceptar si hay platos pausados temporalmente Y NO hay reserva programada
    if (platosTemporales.length > 0 && !tieneReserva) {
      setModalIntercepcion('PLATOS_PAUSADOS');
      return;
    }
    
    // 3. Interceptar si el restaurante está cerrado y no hay reserva programada
    if (restauranteCerrado && !tieneReserva) {
      setModalIntercepcion('RESTAURANTE_CERRADO');
      return;
    }

    // 4. Validar programación
    if (modoRecogida === 'PROGRAMADO' && !opcionProgramada) {
      return mostrarMensajePago('Horario inválido', 'Por favor, selecciona una hora válida para tu reserva.');
    }

    // Si todo está OK, procesamos pago
    handlePagar();
  };

  const handlePagar = async () => {
    if (pagoEnCurso.current || guardadoEnCurso.current || eliminandoTarjeta) return;
    setMensajePago(null);
    pagoEnCurso.current = true;
    setProcesandoStripe(true);
    const almacenamiento = 'nexbite_compra_pendiente_' + idUsuario + '_' + idCartActivo;
    let intento = intentosPago.current.get(huellaCompra);
    let hayOperacionPendiente = false;
    const guardarIntento = valor => {
      intentosPago.current.set(huellaCompra, valor);
      try { localStorage.setItem(almacenamiento, JSON.stringify({ huella: huellaCompra, ...valor })); } catch { /* El servidor conserva la compra aunque no haya almacenamiento. */ }
    };
    const olvidar = () => {
      intentosPago.current.delete(huellaCompra);
      try { localStorage.removeItem(almacenamiento); } catch { /* Sin almacenamiento. */ }
      setCompraPorComprobar(null);
    };
    const consultar = clave => clienteApollo.query({ query: CONSULTAR_COMPRA, variables: { id: clave }, fetchPolicy: 'network-only' }).then(r => r.data.consultarCompra);
    const terminar = compra => {
      if (['CANCELADA', 'CANCELANDO', 'REEMBOLSADA', 'REEMBOLSO_PENDIENTE', 'REEMBOLSO_FALLIDO'].includes(compra.estado)) {
        olvidar();
        mostrarMensajePago('Compra cancelada', compra.mensaje, 'aviso');
        return true;
      }
      if (!['CONFIRMADA', 'RESERVADA', 'AUTORIZADA'].includes(compra.estado)) return false;
      olvidar();
      const carritoRestante = carrito.filter(p => String(p.id_restaurante) !== String(idCartActivo));
      setCarrito(carritoRestante);
      onPedidoConfirmado?.({
        nombreRestaurante: restaurante?.nombre, total: compra.total,
        articulos: compra.items.reduce((suma, item) => suma + item.cantidad, 0),
        metodoPago, tipoEntrega, fechaProgramada: compra.fecha_programada,
        direccionLocal: direccionRestaurante, urlMapa: urlUbicacionLocal, direccionEntrega: direccionFinal,
        estadoCompra: compra.estado, mensaje: compra.mensaje, idCompra: compra.id_compra,
        autorizacionHasta: compra.autorizacion_hasta,
      });
      if (carritoRestante.length) setIdCartActivo(null);
      else { vaciarCarrito(); onVolver(); }
      return true;
    };
    try {
      if (compraPorComprobar) {
        hayOperacionPendiente = true;
        intento = { clave: compraPorComprobar.clave };
        const compra = await consultar(intento.clave);
        if (terminar(compra)) return;
        setCompraPorComprobar(null);
        return mostrarMensajePago('Puedes continuar con la compra', 'El banco aún no ha autorizado el pago. Revisa el carrito y vuelve a confirmar.', 'info');
      }
      if (metodoPago === 'TARJETA' && !tarjetaSeleccionada) return mostrarMensajePago('Añade una tarjeta para continuar', 'Guarda una tarjeta o elige pagar en efectivo.');
      if (metodoPago === 'TARJETA' && !stripe) return mostrarMensajePago('El pago está cargando', 'Espera unos segundos y vuelve a confirmar.', 'info');
      if (!intento) {
        try {
          const anterior = JSON.parse(localStorage.getItem(almacenamiento));
          if (anterior?.huella === huellaCompra) intento = { clave: anterior.clave };
        } catch { /* Sin intento anterior. */ }
      }
      if (!intento) intento = { clave: crypto.randomUUID() };
      guardarIntento(intento);
      let compra = (await prepararCompra({ variables: { input: { ...solicitud, clave: intento.clave } } })).data.prepararCompra;
      if (terminar(compra)) return;
      setCotizacion({ huella: huellaCompra, compra });
      const cambianPrecios = centimos(compra.total) !== centimos(totalFinal) || compra.items.some(item => centimos(carritoEnUso.find(p => String(p.id_plato) === String(item.id_plato)).precio) !== centimos(item.precio));
      if (cambianPrecios) {
        setCarrito(anterior => anterior.map(p => {
          const item = String(p.id_restaurante) === String(idCartActivo) && compra.items.find(i => String(i.id_plato) === String(p.id_plato));
          return item ? { ...p, precio: item.precio } : p;
        }));
        return mostrarMensajePago('Importe actualizado', 'El total verificado es ' + compra.total.toFixed(2) + ' €. Revisa el desglose y pulsa de nuevo para confirmar. Aún no se ha autorizado ni cobrado la tarjeta.', 'aviso');
      }
      if (metodoPago === 'TARJETA') {
        hayOperacionPendiente = true;
        const resultado = await stripe.confirmCardPayment(compra.client_secret, { payment_method: tarjetaSeleccionada });
        if (resultado.error) throw new Error(resultado.error.message);
        if (resultado.paymentIntent?.status !== 'requires_capture') {
          const actual = await consultar(intento.clave);
          if (terminar(actual)) return;
          setCompraPorComprobar({ clave: intento.clave, idRestaurante: idCartActivo });
          return mostrarMensajePago('Tu banco está comprobando la autorización', 'Pulsa Comprobar compra para recuperar el estado sin crear otro pedido.', 'info');
        }
      }
      hayOperacionPendiente = true;
      compra = (await confirmarCompra({ variables: { id: intento.clave } })).data.confirmarCompra;
      terminar(compra);
    } catch (error) {
      if (intento && hayOperacionPendiente) {
        try {
          const actual = await consultar(intento.clave);
          if (terminar(actual)) return;
          if (actual.estado === 'BORRADOR') return mostrarMensajePago('No se ha confirmado el pedido', error.message);
        } catch { /* Una respuesta perdida se recupera usando la misma compra. */ }
        setCompraPorComprobar({ clave: intento.clave, idRestaurante: idCartActivo });
        mostrarMensajePago('Comprueba el estado de tu compra', 'No hemos podido recuperar la respuesta. Pulsa Comprobar compra; se reutilizará el mismo pedido y no se duplicará el cobro.', 'aviso');
      } else mostrarMensajePago('Revisa tu carrito', error.message.replace('GraphQL error: ', ''));
    } finally {
      pagoEnCurso.current = false;
      setProcesandoStripe(false);
    }
  };

  if (grupos.length > 1 && !idCartActivo) {
    return (
      <div className="carrito-multiple">
        <button onClick={onVolver} style={{ padding: '0.5rem 1rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '1.5rem', fontWeight: 'bold' }}>← Volver</button>
        <div className="carrito-multiple-panel" style={{ background: 'white', borderRadius: '16px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' }}>
          <h2 style={{ color: '#333', marginTop: 0, marginBottom: '1.5rem', borderBottom: '2px solid #ff4500', paddingBottom: '10px' }}>🛒 Tus Carritos Activos</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '1.1rem' }}>Tienes pedidos empezados en varios restaurantes. Elige cuál quieres completar primero:</p>
          {grupos.map(g => (
             <TarjetaCarritoGrupo key={g.id_restaurante} grupo={g} onSeleccionar={setIdCartActivo} onEliminar={(id) => setCarrito(carrito.filter(p => p.id_restaurante !== id))} />
          ))}
        </div>
      </div>
    );
  }

  const entregaBloqueada = tipoEntrega === 'DOMICILIO' && (cargandoRestaurante || errorRestaurante || !restaurante || Boolean(errorZonaEntrega));
  const bloqueado = procesandoPago || procesandoStripe || guardandoTarjeta || Boolean(eliminandoTarjeta) || (!compraPorComprobar && (entregaBloqueada || (metodoPago === 'TARJETA' && (cargandoTarjetas || Boolean(errorTarjetas)))));
  const urlMapaRestaurante = tieneCoordenadasLocal ? `https://static-maps.yandex.ru/1.x/?ll=${longitudLocal},${latitudLocal}&size=600,150&z=16&l=map&pt=${longitudLocal},${latitudLocal},pm2rdm` : null;

  return (
    <div className="carrito-detalle" style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      
      <button onClick={() => { if (grupos.length > 1 && idCartActivo) setIdCartActivo(null); else onVolver(); }} style={{ padding: '0.5rem 1rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '1.5rem', fontWeight: 'bold' }}>
        {grupos.length > 1 && idCartActivo ? '← Volver a mis carritos' : '← Seguir comprando'}
      </button>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button disabled={procesandoStripe || Boolean(compraPorComprobar)} onClick={() => setCarrito(carrito.filter(p => p.id_restaurante !== idCartActivo))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>Vaciar este carrito</button>
      </div>

      {restauranteCerrado && (
        <div style={{ backgroundColor: '#ffeeba', padding: '1.2rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #ffe8a1' }}>
          <h4 style={{ color: '#856404', margin: '0 0 10px 0', fontSize: '1.1rem' }}>⚠️ El restaurante está cerrado</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            Abre aproximadamente: <strong style={{ color: '#333' }}>
              {restaurante.tiempo_reactivacion ? parsearFechaSegura(restaurante.tiempo_reactivacion)?.toLocaleString() || 'Pronto' : 'Pronto'}
            </strong>
          </p>
        </div>
      )}

      {carritoEnUso.length === 0 ? (
        <p style={{ color: '#666' }}>No tienes platos en este carrito.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '2rem' }}>
            {carritoEnUso.map(item => (
              <div key={item.id_plato} className="carrito-producto">
                <ImagenPlato plato={item} className="carrito-foto" style={{ width: '60px', height: '60px', borderRadius: '10px' }} />
                <div className="carrito-producto-info">
                  <h4 style={{ margin: '0 0 5px 0', color: esTemporal(item) || esIndefinido(item) ? '#d63031' : '#333', fontSize: '16px' }}>
                    {item.nombre} 
                    {(esTemporal(item) || esIndefinido(item)) && (
                      <span style={{ fontSize: '11px', color: '#d63031', marginLeft: '6px', background: '#ffebee', padding: '2px 6px', borderRadius: '10px' }}>No disponible</span>
                    )}
                  </h4>
                  <span style={{ color: '#0066cc', fontWeight: 'bold', fontSize: '14px' }}>{item.precio.toFixed(2)}&nbsp;€ /ud</span>
                </div>
                <div className="carrito-producto-cantidad" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '5px 8px', borderRadius: '25px', border: '1px solid #ddd' }}>
                  <button type="button" aria-label={'Reducir cantidad de ' + item.nombre} onClick={() => disminuirCantidad(item.id_plato)} disabled={item.cantidad <= 1 || procesandoStripe || Boolean(compraPorComprobar)} style={{ border: 'none', background: '#f5f5f5', borderRadius: '50%', width: '28px', height: '28px', cursor: item.cantidad <= 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold', color: item.cantidad <= 1 ? '#ccc' : '#333' }}>-</button>
                  <span style={{ fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{item.cantidad || 1}</span>
                  <button type="button" aria-label={'Aumentar cantidad de ' + item.nombre} onClick={() => aumentarCantidad(item.id_plato)} disabled={procesandoStripe || Boolean(compraPorComprobar)} style={{ border: 'none', background: '#f5f5f5', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                </div>
                <div className="carrito-producto-total" style={{ textAlign: 'right' }}><p style={{ margin: '0', fontWeight: 'bold', color: '#ff4500', fontSize: '16px' }}>{(item.precio * (item.cantidad || 1)).toFixed(2)}&nbsp;€</p></div>
                <button type="button" className="carrito-eliminar" onClick={() => eliminarPlato(item.id_plato)} disabled={procesandoStripe || Boolean(compraPorComprobar)} aria-label={'Eliminar ' + item.nombre + ' del carrito'} title="Eliminar producto"><IconoPapelera /></button>
              </div>
            ))}
          </div>

          <div ref={formularioPago} className="carrito-pago" role="region" aria-label="Completar el pedido" tabIndex={-1} style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem', scrollMarginTop: '90px' }}>
            
            <fieldset disabled={procesandoStripe || Boolean(compraPorComprobar)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', marginBottom: '10px', display: 'block' }}>Forma de entrega:</label>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={() => setTipoEntrega('DOMICILIO')}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer',
                    background: tipoEntrega === 'DOMICILIO' ? '#000' : '#fff',
                    color: tipoEntrega === 'DOMICILIO' ? '#fff' : '#666',
                    border: '1px solid #e0e0e0', transition: 'all 0.2s ease', fontSize: '14px'
                  }}
                >
                  A domicilio
                </button>
                <button
                  type="button"
                  onClick={() => setTipoEntrega('RECOGIDA')}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer',
                    background: tipoEntrega === 'RECOGIDA' ? '#000' : '#fff',
                    color: tipoEntrega === 'RECOGIDA' ? '#fff' : '#666',
                    border: '1px solid #e0e0e0', transition: 'all 0.2s ease', fontSize: '14px'
                  }}
                >
                  Recogida en local
                </button>
              </div>
            </div>

            {tipoEntrega === 'DOMICILIO' ? (
              <div style={{ position: 'relative', marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>Datos de Envío</h3>
                <p style={{ marginBottom: '10px', color: '#333', overflowWrap: 'anywhere' }}>{direccion || 'Selecciona la dirección de entrega.'}</p>
                <button type="button" onClick={onCambiarUbicacion} className="carrito-cambiar-direccion">
                  <span className="carrito-direccion-icono"><IconoInfoRestaurante tipo="ubicacion" /></span>
                  <span>Cambiar dirección de entrega</span>
                  <svg className="carrito-direccion-flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
                </button>
                {errorZonaEntrega && <p role="alert" style={{ color: '#b42318', marginTop: '12px' }}>{errorZonaEntrega}</p>}

                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', marginBottom: '3px', display: 'block' }}>Piso, Puerta, Portal (Opcional):</label>
                  <input type="text" placeholder="Ej. Piso 3, Puerta B..." value={detallesDireccion} onChange={e => setDetallesDireccion(e.target.value)} style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                <div style={{ border: '1px solid #eaeaea', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  {urlMapaRestaurante ? (
                    <img src={urlMapaRestaurante} alt="Mapa del restaurante" style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '140px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Mapa no disponible</div>
                  )}
                  <div style={{ padding: '15px' }}>
                    <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '1.1rem' }}>Recoger en {restaurante?.nombre || 'el local'}</h4>
                    <DireccionLocal key={direccionRestaurante} direccion={direccionRestaurante} urlMapa={urlUbicacionLocal} />
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ border: '1px solid #ccc', borderRadius: '12px', padding: '15px', marginTop: '15px', backgroundColor: '#fff' }}>
              <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#333' }}>Cuándo quieres tu pedido</h4>
              <div 
                onClick={() => { 
                  const dia = diaConfirmado || diasDisponibles[0];
                  setDiaProgramado(dia?.valor || '');
                  setHoraSeleccionadaTemp(opcionProgramada?.valor || dia?.horas[0]?.valor || '');
                  setMostrarModalProgramar(true); 
                }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: '15px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eaeaea'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span style={{ fontWeight: 'bold', color: '#333', fontSize: '14px' }}>
                    {modoRecogida === 'AHORA' 
                      ? (recogidaAhoraDisponible ? 'Lo antes posible' : 'Selecciona una hora')
                      : (opcionProgramada ? `Programado para: ${diaConfirmado.etiqueta}, ${opcionProgramada.etiqueta}` : 'Selecciona una hora disponible')}
                  </span>
                </div>
                <span style={{ color: '#0066cc', fontWeight: 'bold', fontSize: '14px' }}>Editar</span>
              </div>
            </div>
            
            <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', marginBottom: '10px', display: 'block' }}>Elige cómo quieres pagar:</label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setMetodoPago('TARJETA')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '15px', padding: '16px',
                    backgroundColor: metodoPago === 'TARJETA' ? '#fff5f2' : '#ffffff',
                    border: metodoPago === 'TARJETA' ? '2px solid #ff4500' : '1px solid #e0e0e0',
                    borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease', width: '100%'
                  }}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '10px',
                    backgroundColor: metodoPago === 'TARJETA' ? '#ff4500' : '#f5f5f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: metodoPago === 'TARJETA' ? '#fff' : '#888',
                    flexShrink: 0
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                      <line x1="1" y1="10" x2="23" y2="10"></line>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#333' }}>Pago online seguro</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Tarjeta de crédito, débito o Apple/Google Pay</p>
                  </div>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: metodoPago === 'TARJETA' ? '6px solid #ff4500' : '2px solid #ccc',
                    boxSizing: 'border-box',
                    flexShrink: 0
                  }} />
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPago('EFECTIVO')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '15px', padding: '16px',
                    backgroundColor: metodoPago === 'EFECTIVO' ? '#f0fdf4' : '#ffffff',
                    border: metodoPago === 'EFECTIVO' ? '2px solid #16864a' : '1px solid #e0e0e0',
                    borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease', width: '100%'
                  }}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '10px',
                    backgroundColor: metodoPago === 'EFECTIVO' ? '#16864a' : '#f5f5f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: metodoPago === 'EFECTIVO' ? '#fff' : '#888',
                    flexShrink: 0
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                      <circle cx="12" cy="12" r="2"></circle>
                      <path d="M6 12h.01M18 12h.01"></path>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#333' }}>Efectivo al recibir</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Paga directamente al repartidor en la entrega</p>
                  </div>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: metodoPago === 'EFECTIVO' ? '6px solid #16864a' : '2px solid #ccc',
                    boxSizing: 'border-box',
                    flexShrink: 0
                  }} />
                </button>
              </div>
            </div>

            {metodoPago === 'TARJETA' && (
              <div style={{ marginTop: '15px' }}>
                {cargandoTarjetas && !datosTarjetas && <p role="status">Cargando tus tarjetas…</p>}
                {errorTarjetas && <div role="alert" style={{ marginBottom: '15px', color: '#a42318' }}>
                  No se han podido cargar tus tarjetas. <button type="button" onClick={() => refrescarTarjetas().catch(() => {})}>Reintentar</button>
                </div>}
                {tarjetasAntiguas && <p style={{ padding: '12px', background: '#fff4dc', borderRadius: '8px', color: '#704b0b', fontSize: '14px' }}>
                  Para volver a usar las tarjetas que tenías guardadas, añádelas de nuevo una sola vez.
                </p>}
                {tarjetas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                    {tarjetas.map(t => (
                      <div key={t.id} onClick={() => { if (!pagoEnCurso.current && !guardadoEnCurso.current && !eliminandoTarjeta) setTarjetaSeleccionada(t.id); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', border: tarjetaSeleccionada === t.id ? '2px solid #ff4500' : '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', backgroundColor: tarjetaSeleccionada === t.id ? '#fff0eb' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tarjetaSeleccionada === t.id ? '#ff4500' : '#888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                            <line x1="1" y1="10" x2="23" y2="10"></line>
                          </svg>
                          <div>
                            <p style={{ margin: 0, fontWeight: 'bold', color: '#333', textTransform: 'capitalize' }}>{t.brand} •••• {t.last4}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{t.name}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button disabled={procesandoStripe || guardandoTarjeta || Boolean(eliminandoTarjeta)} onClick={(e) => eliminarTarjeta(t.id, e)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>{eliminandoTarjeta === t.id ? 'Eliminando…' : 'Eliminar'}</button>
                          {tarjetaSeleccionada === t.id && <span style={{ color: '#ff4500', fontWeight: 'bold' }}>✓</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button disabled={procesandoStripe || Boolean(eliminandoTarjeta)} onClick={() => setMostrarModalTarjeta(true)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: '1px dashed #ccc', padding: '15px', width: '100%', borderRadius: '8px', cursor: 'pointer', color: '#0066cc', fontWeight: 'bold', fontSize: '14px', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Añadir una tarjeta de crédito o débito
                </button>
              </div>
            )}

            </fieldset>
            {modoRecogida === 'PROGRAMADO' && <p className="carrito-aviso-reserva">Con tarjeta, el banco retiene el importe ahora y solo se cobra cuando llegue la hora y el pedido esté disponible. La fecha debe caber en el plazo de autorización de tu tarjeta. Si no puede servirse en los 30 minutos siguientes, se cancela sin cobrar. Con efectivo, pagarás al recibir o recoger.</p>}
            <div className="carrito-desglose" style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #eaeaea', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#666', fontSize: '15px' }}>
                <span>Subtotal</span>
                <span>{subtotal.toFixed(2)}&nbsp;€</span>
              </div>
              
              {tipoEntrega === 'DOMICILIO' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#666', fontSize: '15px' }}>
                  <span>Gastos de envío {distanciaKm > 0 ? `(${distanciaKm.toFixed(1)} km)` : ''}</span>
                  {superaGratis ? (
                    <span style={{ color: '#00b894', fontWeight: 'bold' }}>¡Gratis!</span>
                  ) : (
                    <span>{gastosEnvio.toFixed(2)}&nbsp;€</span>
                  )}
                </div>
              )}

              <div style={{ borderTop: '1px solid #eee', margin: '10px 0' }}></div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
                <span>Total</span>
                <span>{totalFinal.toFixed(2)}&nbsp;€</span>
              </div>

              {tipoEntrega === 'DOMICILIO' && !superaGratis && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center', fontSize: '14px', color: '#555' }}>
                  Te faltan <b style={{color: '#ff4500'}}>{(gratisDesde - subtotal).toFixed(2)}&nbsp;€</b> para envío gratis
                </div>
              )}
            </div>

            <button type="button" className="boton-con-estado" onClick={iniciarPago} disabled={bloqueado} aria-busy={procesandoPago || procesandoStripe} style={{ padding: '1.2rem', background: '#16864a', color: '#fff', border: 'none', borderRadius: '10px', cursor: bloqueado ? 'not-allowed' : 'pointer', opacity: bloqueado ? 0.6 : 1, fontWeight: 'bold', fontSize: '1.2rem', marginTop: '0.5rem', transition: 'all 0.2s' }}>
              {(procesandoPago || procesandoStripe) && <IconoEstado tipo="cargando" tamano={22} />}
              {procesandoPago ? 'Confirmando tu pedido...' : procesandoStripe ? metodoPago === 'TARJETA' ? 'Procesando el pago...' : 'Confirmando tu pedido...' : compraPorComprobar ? 'Comprobar compra' : `${modoRecogida === 'PROGRAMADO' ? 'Reservar' : 'Pagar'} ${totalFinal.toFixed(2)}\u00a0€`}
            </button>
            {mensajePago?.idRestaurante === idCartActivo && <div ref={mensajePagoRef} tabIndex={-1} style={{ outline: 'none' }}><MensajeAccion mensaje={mensajePago} onCerrar={() => setMensajePago(null)} /></div>}
          </div>
        </>
      )}

      {/* MODAL DE INTERCEPCIÓN DE ERRORES/PAUSAS EN EL CARRITO */}
      {modalIntercepcion === 'PLATOS_PAUSADOS' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '450px', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#fff0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#dc3545' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', color: '#1a1a1a' }}>Hay productos no disponibles</h3>
            <p style={{ color: '#666', fontSize: '15px', marginBottom: '20px' }}>Algunos productos de tu carrito están agotados temporalmente y no pueden ser cobrados ahora mismo.</p>

            <ul style={{ textAlign: 'left', background: '#f9f9f9', padding: '15px 15px 15px 35px', borderRadius: '10px', color: '#333', fontSize: '14px', marginBottom: '25px', border: '1px solid #eee' }}>
              {platosIndefinidos.map(p => {
                const subs = obtenerNombresSubPausados(p, true);
                const desc = subs.length > 0 ? ` (Menú contiene: ${subs.join(', ')})` : ' (Agotado)';
                return <li key={p.id_plato} style={{ marginBottom: '8px' }}><b>{p.nombre}</b> {desc}</li>;
              })}
              {platosTemporales.map(p => {
                const subs = obtenerNombresSubPausados(p, false);
                const cascadaDate = obtenerMaxTiempoCascada(p);
                const maxFechaObj = cascadaDate || parsearFechaSegura(p.tiempo_disponible);
                
                let textoAviso = 'pronto';
                if (maxFechaObj) {
                  const esHoy = maxFechaObj.getDate() === new Date().getDate();
                  const hora = maxFechaObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                  textoAviso = esHoy ? `hoy a las ${hora}` : `el ${maxFechaObj.toLocaleDateString()} a las ${hora}`;
                }
                const desc = subs.length > 0 ? ` (contiene: ${subs.join(', ')})` : '';
                return (
                  <li key={p.id_plato} style={{ marginBottom: '8px' }}>
                    <b>{p.nombre}</b> {desc} <br/><span style={{ color: '#d63031' }}>(Pausado hasta {textoAviso})</span>
                  </li>
                );
              })}
            </ul>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  const idsAgotados = [...platosIndefinidos, ...platosTemporales].map(p => p.id_plato);
                  setCarrito(carrito.filter(p => !idsAgotados.includes(p.id_plato)));
                  setModalIntercepcion(null);
                }} 
                style={{ width: '100%', padding: '14px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
              >
                Eliminar agotados y continuar el pago
              </button>

              {platosIndefinidos.length === 0 && platosTemporales.length > 0 && (
                <button 
                  onClick={() => {
                    setModalIntercepcion(null);
                    const dia = diaConfirmado || diasDisponibles[0];
                    setDiaProgramado(dia?.valor || '');
                    setHoraSeleccionadaTemp(opcionProgramada?.valor || dia?.horas[0]?.valor || '');
                    setMostrarModalProgramar(true);
                  }} 
                  style={{ width: '100%', padding: '14px', background: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eaeaea'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                >
                  Reservar el carrito para más tarde
                </button>
              )}
              
              <button 
                onClick={() => setModalIntercepcion(null)} 
                style={{ width: '100%', padding: '10px', background: 'none', color: '#666', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Cancelar y volver al carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {modalIntercepcion === 'RESTAURANTE_CERRADO' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '420px', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#fff5f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#ff4500' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', color: '#1a1a1a' }}>El local está cerrado en este momento</h3>
            <p style={{ color: '#666', fontSize: '15px', marginBottom: '25px', lineHeight: '1.5' }}>
              El restaurante vuelve a abrir {restaurante.tiempo_reactivacion ? (() => {
                  const fechaObj = parsearFechaSegura(restaurante.tiempo_reactivacion);
                  if (!fechaObj) return 'más tarde';
                  const esHoy = fechaObj.getDate() === new Date().getDate();
                  const hora = fechaObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                  return esHoy ? `hoy a las ${hora}` : `el ${fechaObj.toLocaleDateString()} a las ${hora}`;
                })() : 'más tarde'}. <br/><br/>No puedes realizar un pedido para ahora mismo, pero puedes <b>programar una reserva</b> para cuando abran.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  setModalIntercepcion(null);
                  const dia = diaConfirmado || diasDisponibles[0];
                  setDiaProgramado(dia?.valor || '');
                  setHoraSeleccionadaTemp(opcionProgramada?.valor || dia?.horas[0]?.valor || '');
                  setMostrarModalProgramar(true);
                }} 
                style={{ width: '100%', padding: '14px', background: '#000', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Programar una reserva
              </button>
              
              <button 
                onClick={() => setModalIntercepcion(null)} 
                style={{ width: '100%', padding: '14px', background: 'none', color: '#666', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TARJETA EXISTENTE */}
      {mostrarModalTarjeta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-tarjeta" style={{ background: '#fff', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '400px', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <button disabled={guardandoTarjeta} aria-label="Cerrar tarjeta" onClick={() => setMostrarModalTarjeta(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            <h3 id="titulo-tarjeta" style={{ margin: '0 0 12px 0', color: '#1a1a1a', fontSize: '1.4rem' }}>Añadir una tarjeta</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>Guardaremos esta tarjeta de forma segura para tus próximos pedidos.</p>
            
            <label htmlFor="titular-tarjeta" style={{ fontSize: '13px', color: '#555', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Nombre en la tarjeta</label>
            <input id="titular-tarjeta" disabled={guardandoTarjeta} type="text" value={nuevoTitular} onChange={e => setNuevoTitular(e.target.value)} placeholder="Ej. Juan Pérez" style={{ width: '100%', padding: '14px', marginBottom: '20px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box', outline: 'none', fontSize: '15px' }} />
            
            <label style={{ fontSize: '13px', color: '#555', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Información de la tarjeta</label>
            <div style={{ padding: '16px 14px', border: '1px solid #ddd', borderRadius: '10px', marginBottom: '25px', backgroundColor: '#fafafa' }}>
              <CardElement options={{ style: { base: { fontSize: '16px', color: '#333', '::placeholder': { color: '#aab7c4' } } } }} />
            </div>
            
            <button onClick={handleGuardarTarjeta} disabled={guardandoTarjeta || !stripe || !elements} style={{ width: '100%', background: '#ff4500', color: '#fff', padding: '16px', borderRadius: '10px', fontWeight: 'bold', border: 'none', fontSize: '15px', cursor: guardandoTarjeta ? 'not-allowed' : 'pointer', opacity: guardandoTarjeta ? 0.7 : 1, transition: 'background 0.2s' }}>
              {guardandoTarjeta ? 'Guardando...' : 'Guardar y continuar'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE PROGRAMAR HORARIO */}
      {mostrarModalProgramar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '420px', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            
            <button onClick={() => setMostrarModalProgramar(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.4rem', color: '#1a1a1a' }}>Programar el pedido</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Elige cuándo quieres que tu pedido esté listo. Las franjas son de 30 minutos.</p>
            
            {recogidaAhoraDisponible && (
              <button type="button" onClick={() => { setModoRecogida('AHORA'); setHoraProgramada(''); setMostrarModalProgramar(false); }}
                style={{ width: '100%', marginBottom: '20px', padding: '14px', borderRadius: '10px', border: '2px solid #eaeaea', background: '#fff', cursor: 'pointer', fontWeight: 'bold', color: '#333', transition: 'border-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#ff4500'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#eaeaea'}
              >
                Lo antes posible
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>Fecha</label>
                <select 
                  value={diaProgramado} 
                  onChange={(e) => {
                    const nuevoDia = e.target.value;
                    setDiaProgramado(nuevoDia);
                    const nuevasHoras = diasDisponibles.find(dia => dia.valor === nuevoDia)?.horas || [];
                    setHoraSeleccionadaTemp(nuevasHoras[0]?.valor || '');
                  }}
                  style={{ padding: '14px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '15px', outline: 'none', cursor: 'pointer', backgroundColor: '#fafafa', appearance: 'auto' }}
                >
                  {diasDisponibles.length === 0 && <option value="">Sin fechas disponibles</option>}
                  {diasDisponibles.map(dia => (
                    <option key={dia.valor} value={dia.valor}>{dia.etiqueta}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>Hora</label>
                <select 
                  value={horaSeleccionadaTemp} 
                  onChange={(e) => setHoraSeleccionadaTemp(e.target.value)}
                  style={{ padding: '14px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '15px', outline: 'none', cursor: 'pointer', backgroundColor: '#fafafa', appearance: 'auto' }}
                >
                  {horasDisponiblesList.map(hora => (
                    <option key={hora.valor} value={hora.valor}>{hora.etiqueta}</option>
                  ))}
                </select>
                {horasDisponiblesList.length === 0 && (
                  <p style={{ color: '#d63031', fontSize: '13px', margin: 0, fontWeight: 'bold' }}>El local ya no acepta pedidos para este día.</p>
                )}
              </div>

            </div>

            <button 
              onClick={() => {
                if (horasDisponiblesList.some(hora => hora.valor === horaSeleccionadaTemp)) {
                  setModoRecogida('PROGRAMADO'); 
                  setHoraProgramada(horaSeleccionadaTemp); 
                }
                setMostrarModalProgramar(false);
              }}
              disabled={!horasDisponiblesList.some(hora => hora.valor === horaSeleccionadaTemp)}
              style={{ marginTop: '25px', width: '100%', padding: '16px', background: '#000', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: horasDisponiblesList.length === 0 ? 'not-allowed' : 'pointer', opacity: horasDisponiblesList.length === 0 ? 0.6 : 1, transition: 'background 0.2s' }}
            >
              Confirmar horario
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

export default function Carrito(props) {
  return (
    <Elements stripe={stripePromise}>
      <CarritoInterno {...props} />
    </Elements>
  );
}
