import { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { generarOpcionesRecogida, recogidaDisponible, validarFechaRecogida } from '../../shared/horariosRecogida.js';
import { validarZonaEntrega } from '../../shared/zonaEntrega.js';

// Importaciones de Stripe
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Inicialización de Stripe
const stripePromise = loadStripe('pk_test_51TvpS8Q6Lca9bAZqO8Skya79dRCVkCyvtSrQqZkCUHVdM43VK4xQUCBzANz8i3BbUFEISBeJdo1mb8Uj1lahMH9q009ej7QEHn');

const CREAR_PEDIDO = gql`
  mutation CrearPedido($id_usuario: ID!, $id_restaurante: ID!, $id_plato: ID!, $metodo_pago: String!, $direccion_envio: String!, $fecha_programada: String, $latitud_cliente: Float, $longitud_cliente: Float) {
    crearPedido(id_usuario: $id_usuario, id_restaurante: $id_restaurante, id_plato: $id_plato, metodo_pago: $metodo_pago, direccion_envio: $direccion_envio, fecha_programada: $fecha_programada, latitud_cliente: $latitud_cliente, longitud_cliente: $longitud_cliente) {
      id_pedido
    }
  }
`;

const SOLICITAR_AVISO = gql`
  mutation SolicitarAviso($id_usuario: ID!, $tipo: String!, $id_referencia: ID!) {
    solicitarAviso(id_usuario: $id_usuario, tipo: $tipo, id_referencia: $id_referencia)
  }
`;

const CREAR_INTENCION_PAGO = gql`
  mutation CrearIntencionPago($monto: Float!) {
    crearIntencionPago(monto: $monto)
  }
`;

const OBTENER_ESTADO_RESTAURANTE = gql`
  query ObtenerEstadoRestaurante($id: ID!) {
    obtenerRestaurantePorId(id_restaurante: $id) { 
      nombre
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

function TarjetaCarritoGrupo({ grupo, onSeleccionar, onEliminar }) {
  const { data } = useQuery(OBTENER_INFO_BASICA_REST, { variables: { id: grupo.id_restaurante } });
  const rest = data?.obtenerRestaurantePorId;
  const total = grupo.platos.reduce((sum, p) => sum + (p.precio * (p.cantidad || 1)), 0);

  return (
    <div 
      onClick={() => onSeleccionar(grupo.id_restaurante)} 
      style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: '1px solid #eee', borderRadius: '12px', background: '#fafafa', marginBottom: '15px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {rest?.imagen_url ? (
        <img src={rest.imagen_url} alt={rest?.nombre} style={{ width: '65px', height: '65px', borderRadius: '8px', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '65px', height: '65px', borderRadius: '8px', backgroundColor: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🏪</div>
      )}
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '16px' }}>{rest?.nombre || 'Cargando...'}</h4>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{grupo.totalItems} artículo{grupo.totalItems > 1 ? 's' : ''}</p>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
        <p style={{ margin: 0, fontWeight: 'bold', color: '#0066cc', fontSize: '16px' }}>€{total.toFixed(2)}</p>
        <span style={{ fontSize: '12px', background: '#ff4500', color: 'white', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>Ver pedido &rarr;</span>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onEliminar(grupo.id_restaurante); }} 
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', padding: '5px', marginLeft: '10px', opacity: 0.5, transition: 'opacity 0.2s' }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
        onMouseLeave={(e) => e.currentTarget.style.opacity = 0.5}
        title="Eliminar este carrito"
      >
        🗑️
      </button>
    </div>
  );
}

function CarritoInterno({ carrito, setCarrito, onVolver, vaciarCarrito, idUsuario, ubicacionEntrega, onCambiarUbicacion, tipoEntregaInicial = 'DOMICILIO', idRestauranteInicial = null, irAPago = false }) {
  const stripe = useStripe();
  const elements = useElements();

  const [idCartActivo, setIdCartActivo] = useState(() => idRestauranteInicial == null ? null : carrito.find(plato => String(plato.id_restaurante) === String(idRestauranteInicial))?.id_restaurante ?? null);
  const formularioPago = useRef(null);
  useEffect(() => {
    if (irAPago && idCartActivo && formularioPago.current) {
      formularioPago.current.focus({ preventScroll: true });
      formularioPago.current.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }, [irAPago, idCartActivo]);
  const [tipoEntrega, setTipoEntrega] = useState(tipoEntregaInicial);
  
  // Cada carrito mantiene su selección; nunca se aplica la hora de otro restaurante.
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

  const [tarjetas, setTarjetas] = useState(() => {
    const guardadas = localStorage.getItem('nexbite_tarjetas');
    return guardadas ? JSON.parse(guardadas) : [];
  });
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState(tarjetas.length > 0 ? tarjetas[0].id : null);
  const [mostrarModalTarjeta, setMostrarModalTarjeta] = useState(false);
  const [nuevoTitular, setNuevoTitular] = useState('');
  const [guardandoTarjeta, setGuardandoTarjeta] = useState(false);

  const [direccionRestaurante, setDireccionRestaurante] = useState('Obteniendo dirección del local...');

  const handleGuardarTarjeta = async () => {
    if (!nuevoTitular.trim()) return alert("Ingresa el nombre del titular de la tarjeta.");
    if (!stripe || !elements) return;
    
    setGuardandoTarjeta(true);
    const cardEl = elements.getElement(CardElement);
    
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardEl,
      billing_details: { name: nuevoTitular }
    });

    setGuardandoTarjeta(false);
    
    if (error) {
      alert("Error en la tarjeta: " + error.message);
    } else {
      const nuevaTarjeta = {
        id: paymentMethod.id,
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        name: nuevoTitular
      };
      const nuevasTarjetas = [...tarjetas, nuevaTarjeta];
      setTarjetas(nuevasTarjetas);
      localStorage.setItem('nexbite_tarjetas', JSON.stringify(nuevasTarjetas));
      setTarjetaSeleccionada(nuevaTarjeta.id);
      setMostrarModalTarjeta(false);
      setNuevoTitular('');
      cardEl.clear();
    }
  };

  const eliminarTarjeta = (id, e) => {
    e.stopPropagation();
    const nuevas = tarjetas.filter(t => t.id !== id);
    setTarjetas(nuevas);
    localStorage.setItem('nexbite_tarjetas', JSON.stringify(nuevas));
    if (tarjetaSeleccionada === id) {
      setTarjetaSeleccionada(nuevas.length > 0 ? nuevas[0].id : null);
    }
  };

  const [procesandoStripe, setProcesandoStripe] = useState(false);
  const [comprobandoHorario, setComprobandoHorario] = useState(false);
  const [crearPedido, { loading: procesandoPago }] = useMutation(CREAR_PEDIDO);
  const [crearIntencion] = useMutation(CREAR_INTENCION_PAGO);
  const [pedirAviso] = useMutation(SOLICITAR_AVISO);

  const gruposObj = carrito.reduce((acc, plato) => {
    if (!acc[plato.id_restaurante]) acc[plato.id_restaurante] = { id_restaurante: plato.id_restaurante, platos: [], totalItems: 0 };
    acc[plato.id_restaurante].platos.push(plato);
    acc[plato.id_restaurante].totalItems += (plato.cantidad || 1);
    return acc;
  }, {});
  const grupos = Object.values(gruposObj);

  useEffect(() => {
    if (grupos.length === 1 && !idCartActivo) setIdCartActivo(grupos[0].id_restaurante);
    else if (grupos.length === 0) setIdCartActivo(null);
    else if (idCartActivo && !grupos.find(g => g.id_restaurante === idCartActivo)) setIdCartActivo(null); 
  }, [grupos, idCartActivo]);

  const carritoEnUso = idCartActivo ? carrito.filter(p => p.id_restaurante === idCartActivo) : [];
  const idRestauranteCarrito = idCartActivo;

  const aumentarCantidad = (id_plato) => setCarrito(carrito.map(p => String(p.id_plato) === String(id_plato) ? { ...p, cantidad: (p.cantidad || 1) + 1 } : p));
  const disminuirCantidad = (id_plato) => setCarrito(carrito.map(p => (String(p.id_plato) === String(id_plato) && p.cantidad > 1) ? { ...p, cantidad: p.cantidad - 1 } : p));
  const eliminarPlato = (id_plato) => setCarrito(carrito.filter(p => p.id_plato !== id_plato));

  const { data: dataRest, loading: cargandoRestaurante, error: errorRestaurante, refetch: refrescarRestaurante } = useQuery(OBTENER_ESTADO_RESTAURANTE, { variables: { id: idRestauranteCarrito }, skip: !idRestauranteCarrito });
  const restaurante = dataRest?.obtenerRestaurantePorId;
  const opcionesRecogida = useMemo(() => restaurante ? generarOpcionesRecogida(restaurante.horarios_recogida, ahora) : [], [restaurante, ahora]);
  const diasDisponibles = opcionesRecogida;
  const horasDisponiblesList = diasDisponibles.find(dia => dia.valor === diaProgramado)?.horas || [];
  const opcionProgramada = diasDisponibles.flatMap(dia => dia.horas).find(hora => hora.valor === horaProgramada);
  const diaConfirmado = diasDisponibles.find(dia => dia.horas.some(hora => hora.valor === horaProgramada));
  const recogidaAhoraDisponible = restaurante && restaurante.aceptando_pedidos && recogidaDisponible(restaurante.horarios_recogida, ahora, 15);

  const total = carritoEnUso.reduce((suma, plato) => suma + (plato.precio * (plato.cantidad || 1)), 0);

  const restauranteCerrado = restaurante ? !restaurante.aceptando_pedidos : false;
  let errorZonaEntrega = '';
  if (tipoEntrega === 'DOMICILIO' && restaurante && !cargandoRestaurante) {
    try { validarZonaEntrega(restaurante, coordenadasEnvio?.lat, coordenadasEnvio?.lng); }
    catch (error) { errorZonaEntrega = error.message; }
  }
  const platosIndefinidos = carritoEnUso.filter(p => p.disponible === false && (!p.tiempo_disponible || p.tiempo_disponible.includes('Indefinido')));
  const platosTemporales = carritoEnUso.filter(p => p.disponible === false && p.tiempo_disponible && !p.tiempo_disponible.includes('Indefinido'));

  useEffect(() => {
    if (restaurante?.direccion) setDireccionRestaurante(restaurante.direccion);
    else if (restaurante?.latitud && restaurante?.longitud) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${restaurante.latitud}&lon=${restaurante.longitud}`)
        .then(res => res.json())
        .then(data => setDireccionRestaurante(data?.display_name ? data.display_name.split(', ').slice(0, 3).join(', ') : 'Dirección no encontrada'))
        .catch(() => setDireccionRestaurante('Error al obtener la dirección'));
    } else setDireccionRestaurante('Ubicación del local no especificada');
  }, [restaurante]);

  const handlePedirAvisoRestaurante = async () => {
    await pedirAviso({ variables: { id_usuario: idUsuario, tipo: 'RESTAURANTE', id_referencia: idRestauranteCarrito } });
    alert("¡Anotado! Te enviaremos un email automático en cuanto el restaurante vuelva a abrir.");
  };

  const handlePedirAvisoPlato = async (idPlato) => {
    await pedirAviso({ variables: { id_usuario: idUsuario, tipo: 'PLATO', id_referencia: idPlato } });
    alert("¡Anotado! Te enviaremos un email en cuanto este plato vuelva a estar disponible.");
  };

  const handlePagar = async (fechaParaProgramar = null) => {
    if (procesandoPago || procesandoStripe || comprobandoHorario) return;
    if (carritoEnUso.length === 0) return alert("Tu carrito está vacío.");
    
    if (tipoEntrega === 'DOMICILIO') {
      if (!direccion.trim()) return alert("Por favor ingresa la calle principal de envío.");
      if (!coordenadasEnvio) return alert('Selecciona la dirección de entrega.');
      setComprobandoHorario(true);
      try {
        const { data } = await refrescarRestaurante();
        validarZonaEntrega(data?.obtenerRestaurantePorId, coordenadasEnvio.lat, coordenadasEnvio.lng);
      } catch (error) {
        return alert(error.message);
      } finally {
        setComprobandoHorario(false);
      }
    }

    if (platosIndefinidos.length > 0) return alert("Debes eliminar los productos agotados antes de continuar.");

    const direccionFinal = tipoEntrega === 'RECOGIDA' 
      ? 'Recogida en el local' 
      : (detallesDireccion.trim() ? `${direccion} - Detalles: ${detallesDireccion}` : direccion);

    let fechaFinalBackend = fechaParaProgramar;
    if (tipoEntrega === 'RECOGIDA') {
      setComprobandoHorario(true);
      try {
        const { data } = await refrescarRestaurante();
        const local = data?.obtenerRestaurantePorId;
        if (!local) throw new Error('No se ha podido comprobar el horario del restaurante.');
        if (modoRecogida === 'PROGRAMADO' && !opcionProgramada) throw new Error('Vuelve a seleccionar una hora de recogida disponible.');
        if (modoRecogida === 'AHORA' && !local.aceptando_pedidos) throw new Error('El local no acepta pedidos inmediatos.');
        fechaFinalBackend = validarFechaRecogida(local.horarios_recogida, modoRecogida === 'PROGRAMADO' ? horaProgramada : fechaParaProgramar);
      } catch (error) {
        return alert(error.message);
      } finally {
        setComprobandoHorario(false);
      }
    }

    if (metodoPago === 'TARJETA') {
      if (!tarjetaSeleccionada) return alert("💳 Por favor, selecciona o añade una tarjeta para pagar.");
      if (!stripe) return alert("El sistema de pagos no está listo. Inténtalo de nuevo en unos segundos.");
      setProcesandoStripe(true);
      try {
        const resIntencion = await crearIntencion({ variables: { monto: total } });
        const clientSecret = resIntencion.data.crearIntencionPago;
        const result = await stripe.confirmCardPayment(clientSecret, { payment_method: tarjetaSeleccionada });
        if (result.error) {
          setProcesandoStripe(false);
          return alert("❌ Pago rechazado: " + result.error.message);
        }
      } catch (error) {
        setProcesandoStripe(false);
        return alert("❌ Error de conexión con el banco. Inténtalo de nuevo.");
      }
    }

    try {
      const promesas = [];
      carritoEnUso.forEach(plato => {
        const cantidadDeEstePlato = plato.cantidad || 1;
        for (let i = 0; i < cantidadDeEstePlato; i++) {
          promesas.push(
            crearPedido({
              variables: {
                id_usuario: idUsuario, 
                id_restaurante: plato.id_restaurante, 
                id_plato: plato.id_plato,
                metodo_pago: metodoPago, 
                direccion_envio: direccionFinal, 
                fecha_programada: fechaFinalBackend,
                latitud_cliente: tipoEntrega === 'RECOGIDA' ? null : coordenadasEnvio?.lat,
                longitud_cliente: tipoEntrega === 'RECOGIDA' ? null : coordenadasEnvio?.lng
              }
            })
          );
        }
      });
      await Promise.all(promesas);
      
      const carritoRestante = carrito.filter(p => p.id_restaurante !== idCartActivo);
      setCarrito(carritoRestante);
      
      if (fechaFinalBackend) alert("📅 ¡Reserva confirmada! El restaurante te espera a la hora programada.");
      else alert(tipoEntrega === 'RECOGIDA' ? "✅ ¡Pago realizado con éxito! Tu pedido se preparará para recoger lo antes posible." : "✅ ¡Pago realizado con éxito! En breve llegará tu comida.");
      
      if (carritoRestante.length > 0) setIdCartActivo(null); 
      else { vaciarCarrito(); onVolver(); }
    } catch(e) {
      alert("Error al procesar tu pedido: " + e.message.replace("GraphQL error: ", ""));
      setProcesandoStripe(false);
    }
  };

  if (grupos.length > 1 && !idCartActivo) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <button onClick={onVolver} style={{ padding: '0.5rem 1rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '1.5rem', fontWeight: 'bold' }}>← Volver</button>
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' }}>
          <h2 style={{ color: '#333', marginTop: 0, marginBottom: '1.5rem', borderBottom: '2px solid #ff4500', paddingBottom: '10px' }}>🛒 Tus Carritos Activos</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '1.1rem' }}>Tienes pedidos empezados en varios restaurantes. Elige cuál quieres completar primero:</p>
          {grupos.map(g => (
             <TarjetaCarritoGrupo key={g.id_restaurante} grupo={g} onSeleccionar={setIdCartActivo} onEliminar={(id) => setCarrito(carrito.filter(p => p.id_restaurante !== id))} />
          ))}
        </div>
      </div>
    );
  }

  const recogidaBloqueada = tipoEntrega === 'RECOGIDA' && (cargandoRestaurante || errorRestaurante || !restaurante || (modoRecogida === 'AHORA' ? !recogidaAhoraDisponible : !opcionProgramada));
  const entregaBloqueada = tipoEntrega === 'DOMICILIO' && (cargandoRestaurante || errorRestaurante || !restaurante || Boolean(errorZonaEntrega));
  const bloqueado = procesandoPago || procesandoStripe || comprobandoHorario || recogidaBloqueada || entregaBloqueada;
  const urlMapaRestaurante = (restaurante?.latitud && restaurante?.longitud) ? `https://static-maps.yandex.ru/1.x/?ll=${restaurante.longitud},${restaurante.latitud}&size=600,150&z=16&l=map&pt=${restaurante.longitud},${restaurante.latitud},pm2rdm` : null;

  return (
    <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      
      <button onClick={() => { if (grupos.length > 1 && idCartActivo) setIdCartActivo(null); else onVolver(); }} style={{ padding: '0.5rem 1rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '1.5rem', fontWeight: 'bold' }}>
        {grupos.length > 1 && idCartActivo ? '← Volver a mis carritos' : '← Seguir comprando'}
      </button>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button onClick={() => setCarrito(carrito.filter(p => p.id_restaurante !== idCartActivo))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>Vaciar este carrito</button>
      </div>

      {restauranteCerrado && (
        <div style={{ backgroundColor: '#ffeeba', padding: '1.2rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #ffe8a1' }}>
          <h4 style={{ color: '#856404', margin: '0 0 10px 0', fontSize: '1.1rem' }}>⚠️ El restaurante está cerrado</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Abre aproximadamente: <strong style={{ color: '#333' }}>{restaurante.tiempo_reactivacion ? new Date(Number(restaurante.tiempo_reactivacion)).toLocaleString() : 'Pronto'}</strong></p>
        </div>
      )}

      {platosIndefinidos.length > 0 && (
        <div style={{ backgroundColor: '#f8d7da', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #f5c6cb' }}>
          <h4 style={{ color: '#721c24', margin: '0 0 10px 0' }}>⛔ Productos Agotados Indefinidamente</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#721c24' }}>Debes eliminar los productos agotados para poder continuar.</p>
        </div>
      )}

      {carritoEnUso.length === 0 ? (
        <p style={{ color: '#666' }}>No tienes platos en este carrito.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '2rem' }}>
            {carritoEnUso.map(item => (
              <div key={item.id_plato} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: '1px solid #eee', borderRadius: '12px', background: '#fafafa' }}>
                {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} style={{ width: '65px', height: '65px', borderRadius: '8px', objectFit: 'cover' }} /> : <div style={{ width: '65px', height: '65px', borderRadius: '8px', backgroundColor: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🍽</div>}
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 5px 0', color: item.disponible === false ? '#d63031' : '#333', fontSize: '16px' }}>{item.nombre} {item.disponible === false && "(Agotado)"}</h4>
                  <span style={{ color: '#0066cc', fontWeight: 'bold', fontSize: '14px' }}>€{item.precio.toFixed(2)} /ud</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '5px 8px', borderRadius: '25px', border: '1px solid #ddd' }}>
                  <button onClick={() => disminuirCantidad(item.id_plato)} disabled={item.cantidad <= 1} style={{ border: 'none', background: '#f5f5f5', borderRadius: '50%', width: '28px', height: '28px', cursor: item.cantidad <= 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold', color: item.cantidad <= 1 ? '#ccc' : '#333' }}>-</button>
                  <span style={{ fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{item.cantidad || 1}</span>
                  <button onClick={() => aumentarCantidad(item.id_plato)} style={{ border: 'none', background: '#f5f5f5', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                </div>
                <div style={{ minWidth: '70px', textAlign: 'right' }}><p style={{ margin: '0', fontWeight: 'bold', color: '#ff4500', fontSize: '16px' }}>€{(item.precio * (item.cantidad || 1)).toFixed(2)}</p></div>
                <button onClick={() => eliminarPlato(item.id_plato)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px', opacity: 0.7 }} title="Eliminar producto">🗑️</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '2rem' }}>
            <span>Total</span>
            <span>€{total.toFixed(2)}</span>
          </div>

          <div ref={formularioPago} role="region" aria-label="Completar el pedido" tabIndex={-1} style={{ backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem', scrollMarginTop: '90px' }}>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', marginBottom: '10px', display: 'block' }}>Forma de entrega:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div onClick={() => setTipoEntrega('DOMICILIO')} style={{ border: tipoEntrega === 'DOMICILIO' ? '2px solid #ff4500' : '1px solid #e0e0e0', backgroundColor: tipoEntrega === 'DOMICILIO' ? '#fff0eb' : '#fff', borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', boxShadow: tipoEntrega === 'DOMICILIO' ? '0 4px 10px rgba(255, 69, 0, 0.1)' : 'none' }}>
                  <span style={{ fontSize: '2rem' }}>🛵</span>
                  <span style={{ fontWeight: 'bold', color: tipoEntrega === 'DOMICILIO' ? '#ff4500' : '#555' }}>A domicilio</span>
                </div>
                <div onClick={() => setTipoEntrega('RECOGIDA')} style={{ border: tipoEntrega === 'RECOGIDA' ? '2px solid #ff4500' : '1px solid #e0e0e0', backgroundColor: tipoEntrega === 'RECOGIDA' ? '#fff0eb' : '#fff', borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', boxShadow: tipoEntrega === 'RECOGIDA' ? '0 4px 10px rgba(255, 69, 0, 0.1)' : 'none' }}>
                  <span style={{ fontSize: '2rem' }}>🚶‍♂️</span>
                  <span style={{ fontWeight: 'bold', color: tipoEntrega === 'RECOGIDA' ? '#ff4500' : '#555' }}>Recogida en local</span>
                </div>
              </div>
            </div>

            {tipoEntrega === 'DOMICILIO' ? (
              <div style={{ position: 'relative', marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>Datos de Envío</h3>
                <p style={{ marginBottom: '10px', color: '#333', overflowWrap: 'anywhere' }}>{direccion || 'Selecciona la dirección de entrega.'}</p>
                <button type="button" onClick={onCambiarUbicacion} className="ubicacion-cambiar">Cambiar dirección de entrega</button>
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
                    <p style={{ margin: 0, color: '#666', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                       <span style={{ marginTop: '2px' }}>📍</span>
                       <span>{direccionRestaurante}</span>
                    </p>
                  </div>
                </div>

                <div style={{ border: '1px solid #ccc', borderRadius: '12px', padding: '15px', marginTop: '15px', backgroundColor: '#fff' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#333' }}>Opciones de recogida</h4>
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
                      <span style={{ fontSize: '1.2rem' }}>🕒</span>
                      <span style={{ fontWeight: 'bold', color: '#333', fontSize: '14px' }}>
                        {modoRecogida === 'AHORA' 
                          ? (recogidaAhoraDisponible ? 'Lo antes posible' : 'Selecciona una hora de recogida')
                          : (opcionProgramada ? `${diaConfirmado.etiqueta}, ${opcionProgramada.etiqueta}` : 'Vuelve a seleccionar una hora disponible')}
                      </span>
                    </div>
                    <span style={{ color: '#0066cc', fontWeight: 'bold', fontSize: '14px' }}>Editar</span>
                  </div>
                  {!recogidaAhoraDisponible && modoRecogida === 'AHORA' && <p style={{ fontSize: '13px', color: '#b45309', marginBottom: 0 }}>
                    {cargandoRestaurante ? 'Consultando el horario…' : errorRestaurante ? 'No se ha podido cargar el horario. Inténtalo de nuevo.' : 'La recogida inmediata no está disponible. Programa una hora dentro del horario del local.'}
                  </p>}
                </div>
              </div>
            )}
            
            <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', marginBottom: '10px', display: 'block' }}>Elige cómo quieres pagar:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div onClick={() => setMetodoPago('TARJETA')} style={{ border: metodoPago === 'TARJETA' ? '2px solid #ff4500' : '1px solid #e0e0e0', backgroundColor: metodoPago === 'TARJETA' ? '#fff0eb' : '#fff', borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', boxShadow: metodoPago === 'TARJETA' ? '0 4px 10px rgba(255, 69, 0, 0.1)' : 'none' }}>
                  <span style={{ fontSize: '2rem' }}>💳</span>
                  <span style={{ fontWeight: 'bold', color: metodoPago === 'TARJETA' ? '#ff4500' : '#555' }}>Tarjeta online</span>
                </div>
                <div onClick={() => setMetodoPago('EFECTIVO')} style={{ border: metodoPago === 'EFECTIVO' ? '2px solid #ff4500' : '1px solid #e0e0e0', backgroundColor: metodoPago === 'EFECTIVO' ? '#fff0eb' : '#fff', borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', boxShadow: metodoPago === 'EFECTIVO' ? '0 4px 10px rgba(255, 69, 0, 0.1)' : 'none' }}>
                  <span style={{ fontSize: '2rem' }}>💵</span>
                  <span style={{ fontWeight: 'bold', color: metodoPago === 'EFECTIVO' ? '#ff4500' : '#555' }}>Efectivo al recibir</span>
                </div>
              </div>
            </div>

            {metodoPago === 'TARJETA' && (
              <div style={{ marginTop: '15px' }}>
                {tarjetas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                    {tarjetas.map(t => (
                      <div key={t.id} onClick={() => setTarjetaSeleccionada(t.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', border: tarjetaSeleccionada === t.id ? '2px solid #ff4500' : '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', backgroundColor: tarjetaSeleccionada === t.id ? '#fff0eb' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.5rem' }}>{t.brand === 'visa' ? '💳' : '💳'}</span>
                          <div>
                            <p style={{ margin: 0, fontWeight: 'bold', color: '#333', textTransform: 'capitalize' }}>{t.brand} •••• {t.last4}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{t.name}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button onClick={(e) => eliminarTarjeta(t.id, e)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Eliminar</button>
                          {tarjetaSeleccionada === t.id && <span style={{ color: '#ff4500', fontWeight: 'bold' }}>✓</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setMostrarModalTarjeta(true)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: '1px dashed #ccc', padding: '15px', width: '100%', borderRadius: '8px', cursor: 'pointer', color: '#0066cc', fontWeight: 'bold', fontSize: '14px', justifyContent: 'center' }}>
                  <span>➕</span> Añadir una tarjeta de crédito o débito
                </button>
              </div>
            )}

            <button onClick={() => handlePagar(null)} disabled={bloqueado} style={{ padding: '1.2rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '1rem' }}>
              {procesandoPago || procesandoStripe || comprobandoHorario ? 'Procesando...' : `Pagar €${total.toFixed(2)}`}
            </button>
          </div>
        </>
      )}

      {mostrarModalTarjeta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '400px', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <button onClick={() => setMostrarModalTarjeta(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>❌</button>
            <h3 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '1.3rem' }}>Añadir una tarjeta</h3>
            <label style={{ fontSize: '13px', color: '#555', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Nombre en la tarjeta</label>
            <input type="text" value={nuevoTitular} onChange={e => setNuevoTitular(e.target.value)} placeholder="Ej. Juan Pérez" style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', outline: 'none' }} />
            <label style={{ fontSize: '13px', color: '#555', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Información de la tarjeta</label>
            <div style={{ padding: '14px 12px', border: '1px solid #ccc', borderRadius: '6px', marginBottom: '25px', backgroundColor: '#fff' }}><CardElement options={{ style: { base: { fontSize: '16px', color: '#333', '::placeholder': { color: '#aab7c4' } } } }} /></div>
            <button onClick={handleGuardarTarjeta} disabled={guardandoTarjeta} style={{ width: '100%', background: '#333', color: '#fff', padding: '15px', borderRadius: '8px', fontWeight: 'bold', border: 'none', fontSize: '1rem', cursor: guardandoTarjeta ? 'not-allowed' : 'pointer', opacity: guardandoTarjeta ? 0.7 : 1 }}>{guardandoTarjeta ? 'Guardando...' : 'Guardar y continuar'}</button>
          </div>
        </div>
      )}

      {/* MODAL PARA PROGRAMAR RECOGIDA (CON SELECTS NATIVOS Y CORRECCIÓN DE ESTADO) */}
      {mostrarModalProgramar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '400px', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            
            <button onClick={() => setMostrarModalProgramar(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>×</button>
            
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', color: '#333' }}>Programar la recogida</h3>
            <p style={{ fontSize: '13px', color: '#666' }}>Horas disponibles del local, en hora peninsular. Cada franja de recogida dura 30 minutos.</p>
            {recogidaAhoraDisponible && <button type="button" onClick={() => { setModoRecogida('AHORA'); setHoraProgramada(''); setMostrarModalProgramar(false); }}
              style={{ marginBottom: '15px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>Recoger lo antes posible</button>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* SELECTOR DE DÍA */}
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
                  style={{ padding: '14px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '15px', outline: 'none', cursor: 'pointer', backgroundColor: '#fff', appearance: 'auto' }}
                >
                  {diasDisponibles.length === 0 && <option value="">Sin fechas disponibles</option>}
                  {diasDisponibles.map(dia => (
                    <option key={dia.valor} value={dia.valor}>{dia.etiqueta}</option>
                  ))}
                </select>
              </div>

              {/* SELECTOR DE HORA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>Hora</label>
                <select 
                  value={horaSeleccionadaTemp} 
                  onChange={(e) => setHoraSeleccionadaTemp(e.target.value)}
                  style={{ padding: '14px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '15px', outline: 'none', cursor: 'pointer', backgroundColor: '#fff', appearance: 'auto' }}
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
              style={{ marginTop: '25px', width: '100%', padding: '15px', background: '#000', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: horasDisponiblesList.length === 0 ? 'not-allowed' : 'pointer', opacity: horasDisponiblesList.length === 0 ? 0.6 : 1, transition: 'background 0.2s' }}
            >
              Programar
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
