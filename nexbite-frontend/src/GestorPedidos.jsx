import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

const OBTENER_PEDIDOS = gql`
  query ObtenerPedidosVendedor($id_restaurante: ID!) {
    obtenerPedidosVendedor(id_restaurante: $id_restaurante) {
      id_pedido
      nombre_plato
      estado
      metodo_pago
      direccion_envio
    }
    # AÑADIDO: Consultamos el estado real del restaurante para saber cuándo vuelve
    obtenerRestaurantePorId(id_restaurante: $id_restaurante) {
      id_restaurante
      aceptando_pedidos
      tiempo_reactivacion
    }
  }
`;

const ACTUALIZAR_PEDIDO = gql`
  mutation ActualizarEstadoPedido($id_pedido: ID!, $nuevo_estado: String!, $motivo_rechazo: String, $mensaje_personalizado: String) {
    actualizarEstadoPedido(id_pedido: $id_pedido, nuevo_estado: $nuevo_estado, motivo_rechazo: $motivo_rechazo, mensaje_personalizado: $mensaje_personalizado) {
      id_pedido
      estado
    }
  }
`;

// MODIFICACIÓN: Añadido el parámetro de $tiempo
const CAMBIAR_ESTADO_RESTAURANTE = gql`
  mutation CambiarEstadoRestaurante($id_restaurante: ID!, $aceptando: Boolean!, $tiempo: String) {
    cambiarEstadoRestaurante(id_restaurante: $id_restaurante, aceptando: $aceptando, tiempo: $tiempo) {
      id_restaurante
      aceptando_pedidos
      tiempo_reactivacion
    }
  }
`;

const ELIMINAR_PEDIDO = gql`
  mutation EliminarPedido($id_pedido: ID!) {
    eliminarPedido(id_pedido: $id_pedido)
  }
`;

const formatearFecha = (fechaStr) => {
  if (!fechaStr || String(fechaStr).includes('Indefinido')) return 'Sin estimación';
  const timestamp = !isNaN(fechaStr) && String(fechaStr).trim() !== '' ? Number(fechaStr) : fechaStr;
  const fecha = new Date(timestamp);
  if (isNaN(fecha.getTime())) return String(fechaStr); 
  return fecha.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function GestorPedidos({ idRestaurante, nombreRestaurante, estadoPausa }) {
  const [modalRechazo, setModalRechazo] = useState({ visible: false, id_pedido: null });
  const [motivo, setMotivo] = useState('Falta de ingredientes o stock');
  const [mensajeExtra, setMensajeExtra] = useState('');

  // NUEVO: Estados para controlar la pausa temporal
  const [tipoPausa, setTipoPausa] = useState('1 hora');
  const [fechaExacta, setFechaExacta] = useState('');

  const { loading, error, data, refetch } = useQuery(OBTENER_PEDIDOS, { 
    variables: { id_restaurante: idRestaurante },
    fetchPolicy: 'network-only'
  });

  const [actualizarEstado] = useMutation(ACTUALIZAR_PEDIDO, {
    refetchQueries: [{ query: OBTENER_PEDIDOS, variables: { id_restaurante: idRestaurante } }]
  });

  const [eliminarPedidoMut] = useMutation(ELIMINAR_PEDIDO, {
    refetchQueries: [{ query: OBTENER_PEDIDOS, variables: { id_restaurante: idRestaurante } }]
  });

  const [cambiarEstadoRestaurante, { loading: cargandoPausa }] = useMutation(CAMBIAR_ESTADO_RESTAURANTE);

  // NUEVO: Lógica de pausa unificada
  const handleTogglePausa = async (nuevoAceptando) => {
    let tiempoFinal = null;
    
    if (!nuevoAceptando) {
      if (tipoPausa === 'Exacta') {
        if (!fechaExacta) return alert('⚠️ Por favor, selecciona una fecha y hora en el calendario.');
        tiempoFinal = fechaExacta;
      } else {
        tiempoFinal = tipoPausa;
      }
    }

    try {
      await cambiarEstadoRestaurante({ variables: { id_restaurante: idRestaurante, aceptando: nuevoAceptando, tiempo: tiempoFinal } });
      refetch();
    } catch (err) {
      alert('Error al cambiar el estado del restaurante.');
    }
  };

  const cambiarEstadoPedido = async (id_pedido, nuevo_estado, motivo_rechazo = null, mensaje_personalizado = null) => {
    try {
      await actualizarEstado({ variables: { id_pedido, nuevo_estado, motivo_rechazo, mensaje_personalizado } });
    } catch (err) {
      alert('Error al actualizar el estado del pedido.');
    }
  };

  const handleSelectChange = (id_pedido, nuevo_estado) => {
    if (nuevo_estado === 'CANCELADO') {
      setModalRechazo({ visible: true, id_pedido });
    } else {
      cambiarEstadoPedido(id_pedido, nuevo_estado);
    }
  };

  const confirmarRechazo = async () => {
    await cambiarEstadoPedido(modalRechazo.id_pedido, 'CANCELADO', motivo, mensajeExtra);
    setModalRechazo({ visible: false, id_pedido: null });
    setMotivo('Falta de ingredientes o stock');
    setMensajeExtra('');
  };

  const handleEliminarPedido = async (id_pedido) => {
    if (window.confirm("⚠️ ¿Estás seguro de que quieres ELIMINAR permanentemente este pedido del historial? Esta acción no se puede deshacer.")) {
      try {
        await eliminarPedidoMut({ variables: { id_pedido } });
      } catch (err) {
        alert("Error al eliminar el pedido.");
      }
    }
  };

  const fechaMinimaCalendario = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  if (loading) return <p>Cargando pedidos...</p>;
  if (error) return <p style={{color: 'red'}}>Error: {error.message}</p>;

  const pedidos = data?.obtenerPedidosVendedor || [];
  const restaurante = data?.obtenerRestaurantePorId;
  const aceptando = restaurante ? restaurante.aceptando_pedidos : estadoPausa !== false;

  return (
    <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      
      {modalRechazo.visible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#d63031' }}>❌ Cancelar Pedido</h3>
            
            <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Motivo de la cancelación:</p>
            <select 
              value={motivo} 
              onChange={(e) => setMotivo(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: '15px' }}
            >
              <option value="Falta de ingredientes o stock">Falta de ingredientes o stock</option>
              <option value="Zona de entrega fuera de cobertura">Zona de entrega fuera de cobertura</option>
              <option value="Cierre adelantado / Problemas técnicos">Cierre adelantado / Problemas técnicos</option>
              <option value="Exceso de pedidos en cocina">Exceso de pedidos en cocina</option>
            </select>

            <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Mensaje opcional para el cliente:</p>
            <textarea 
              placeholder="Ej: Lo sentimos mucho, te ofrecemos un descuento para mañana..." 
              value={mensajeExtra} 
              onChange={(e) => setMensajeExtra(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', minHeight: '80px', marginBottom: '20px' }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setModalRechazo({ visible: false, id_pedido: null })} 
                style={{ padding: '10px 15px', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Volver
              </button>
              <button 
                onClick={confirmarRechazo} 
                style={{ padding: '10px 15px', background: '#d63031', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ color: '#28a745', margin: 0 }}>🛵 Pedidos: {nombreRestaurante}</h2>
          <p style={{ color: '#666', margin: '5px 0 0 0' }}>Gestiona los pedidos entrantes.</p>
        </div>

        {/* CONTROLES DE PAUSA AVANZADOS */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {aceptando ? (
            <>
              <select 
                value={tipoPausa} 
                onChange={(e) => setTipoPausa(e.target.value)} 
                disabled={cargandoPausa} 
                style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #ccc', outline: 'none' }}
              >
                <option value="30 minutos">Pausar 30 min</option>
                <option value="1 hora">Pausar 1 hora</option>
                <option value="2 horas">Pausar 2 horas</option>
                <option value="1 día">Pausar todo el día</option>
                <option value="Exacta">Hasta fecha/hora exacta...</option>
                <option value="Indefinido">Pausar Indefinidamente</option>
              </select>

              {tipoPausa === 'Exacta' && (
                <input 
                  type="datetime-local" 
                  value={fechaExacta}
                  min={fechaMinimaCalendario}
                  onChange={(e) => setFechaExacta(e.target.value)}
                  disabled={cargandoPausa}
                  style={{ padding: '0.8rem', borderRadius: '6px', border: '2px solid #dc3545', outline: 'none' }}
                />
              )}

              <button 
                onClick={() => handleTogglePausa(false)} 
                disabled={cargandoPausa}
                style={{ padding: '0.8rem 1.5rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}
              >
                {cargandoPausa ? 'Procesando...' : '🛑 Pausar Local'}
              </button>
            </>
          ) : (
            <button 
              onClick={() => handleTogglePausa(true)} 
              disabled={cargandoPausa}
              style={{ padding: '1rem 2rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', boxShadow: '0 4px 10px rgba(40, 167, 69, 0.3)' }}
            >
              {cargandoPausa ? 'Procesando...' : '▶️ REANUDAR (Aceptar Pedidos)'}
            </button>
          )}
        </div>
      </div>

      {!aceptando && (
        <div style={{ backgroundColor: '#ffeeba', color: '#856404', padding: '1.2rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span>⚠️ Tu restaurante está pausado. Los clientes verán un aviso y no podrán hacer nuevos pedidos.</span>
          <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>🕑 Hora de apertura programada: {formatearFecha(restaurante?.tiempo_reactivacion)}</span>
        </div>
      )}

      {pedidos.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: '#888' }}>No hay pedidos para este restaurante en este momento.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {pedidos.map(pedido => (
            <div key={pedido.id_pedido} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: pedido.estado === 'ENTREGADO' ? '#f8f9fa' : '#fff', flexWrap: 'wrap', gap: '15px' }}>
              
              <div>
                <span style={{ fontSize: '12px', color: '#888' }}>ID: {pedido.id_pedido}</span>
                <h3 style={{ margin: '5px 0' }}>{pedido.nombre_plato}</h3>
                <p style={{ margin: '5px 0', color: '#555' }}><strong>📍 Dirección:</strong> {pedido.direccion_envio}</p>
                <p style={{ margin: '5px 0', color: '#555' }}><strong>💳 Pago:</strong> {pedido.metodo_pago}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                <span style={{ 
                  padding: '5px 10px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px',
                  backgroundColor: pedido.estado === 'PENDIENTE' ? '#ffc107' : pedido.estado === 'PREPARANDO' ? '#17a2b8' : '#28a745',
                  color: pedido.estado === 'PENDIENTE' ? '#000' : '#fff'
                }}>
                  {pedido.estado}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select 
                    value={pedido.estado} 
                    onChange={(e) => handleSelectChange(pedido.id_pedido, e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer' }}
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="PREPARANDO">Preparando en cocina</option>
                    <option value="ENVIADO">En camino / Enviado</option>
                    <option value="ENTREGADO">Entregado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>

                  <button 
                    onClick={() => handleEliminarPedido(pedido.id_pedido)}
                    style={{ padding: '0.5rem 0.6rem', backgroundColor: '#ff7675', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1.1rem' }}
                    title="Eliminar pedido permanentemente"
                  >
                    🗑️
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}