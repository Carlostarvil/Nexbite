import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';

const OBTENER_DATOS = gql`
  query ObtenerDatosPanelPedidos($id: ID!) {
    obtenerPedidosVendedor(id_restaurante: $id) { id_pedido, nombre_plato, estado, direccion_envio, metodo_pago }
    obtenerRestaurantePorId(id_restaurante: $id) { id_restaurante, aceptando_pedidos, tiempo_reactivacion }
  }
`;

const ACTUALIZAR_PEDIDO = gql`
  mutation ActualizarEstadoPedido($id_pedido: ID!, $nuevo_estado: String!) {
    actualizarEstadoPedido(id_pedido: $id_pedido, nuevo_estado: $nuevo_estado) { id_pedido, estado }
  }
`;

const CAMBIAR_ESTADO_REST = gql`
  mutation CambiarEstado($id_restaurante: ID!, $aceptando: Boolean!, $tiempo: String) {
    cambiarEstadoRestaurante(id_restaurante: $id_restaurante, aceptando: $aceptando, tiempo: $tiempo) { 
      id_restaurante, 
      aceptando_pedidos, 
      tiempo_reactivacion 
    }
  }
`;

const formatearFecha = (fechaStr) => {
  if (!fechaStr || String(fechaStr).includes('Indefinido')) return 'Indefinido';
  const timestamp = !isNaN(fechaStr) && String(fechaStr).trim() !== '' ? Number(fechaStr) : fechaStr;
  const fecha = new Date(timestamp);
  if (isNaN(fecha.getTime())) return String(fechaStr); 
  return fecha.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function PanelPedidos({ idRestaurante, nombreRestaurante, onVolver }) {
  const { data, loading, refetch } = useQuery(OBTENER_DATOS, { variables: { id: idRestaurante }, pollInterval: 5000 });
  
  const [actualizarPedido] = useMutation(ACTUALIZAR_PEDIDO);
  const [cambiarEstadoRestaurante, { loading: cargandoPausa }] = useMutation(CAMBIAR_ESTADO_REST);
  
  // MODIFICACIÓN: Estados separados para el tipo de pausa y la fecha exacta del calendario
  const [tipoPausa, setTipoPausa] = useState('1 hora');
  const [fechaExacta, setFechaExacta] = useState('');

  const restaurante = data?.obtenerRestaurantePorId;
  const pedidos = data?.obtenerPedidosVendedor || [];

  const handleEstado = async (id_pedido, estadoActual, accionEspecial = null) => {
    let nuevoEstado = '';
    const estadoNorm = estadoActual.toUpperCase();

    if (accionEspecial === 'RECHAZAR') {
      nuevoEstado = 'RECHAZADO';
    } else {
      if (estadoNorm === 'PENDIENTE') nuevoEstado = 'EN COCINA';
      else if (estadoNorm === 'EN COCINA') nuevoEstado = 'EN CAMINO';
      else if (estadoNorm === 'EN CAMINO') nuevoEstado = 'ENTREGADO';
    }
    
    if (nuevoEstado) {
      try {
        await actualizarPedido({ variables: { id_pedido, nuevo_estado: nuevoEstado } });
        refetch();
      } catch (err) {
        alert('Error al actualizar el estado en la base de datos.');
      }
    }
  };

  const ejecutarPausa = async (aceptando) => {
    let tiempoFinal = null;
    
    // Si estamos pausando el restaurante (aceptando = false)
    if (!aceptando) {
      if (tipoPausa === 'Exacta') {
        if (!fechaExacta) return alert('⚠️ Por favor, selecciona una fecha y hora en el calendario.');
        tiempoFinal = fechaExacta; // Enviamos la fecha del calendario (ej: "2026-10-15T19:30")
      } else {
        tiempoFinal = tipoPausa; // Enviamos el texto normal (ej: "1 hora")
      }
    }

    try {
      await cambiarEstadoRestaurante({ variables: { id_restaurante: idRestaurante, aceptando, tiempo: tiempoFinal } });
      refetch();
    } catch (error) {
      alert('Hubo un error al cambiar el estado del restaurante.');
    }
  };

  // Obtenemos la hora actual para evitar que el usuario elija horas en el pasado en el calendario
  const fechaMinimaCalendario = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button onClick={onVolver} style={{ padding: '0.5rem 1rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem', fontWeight: 'bold' }}>← Volver a Mis Locales</button>
        <h2 style={{ color: '#ff4500', margin: 0 }}>📦 Pedidos en tiempo real: {nombreRestaurante}</h2>
      </div>

      {restaurante && (
        <div style={{ padding: '1.5rem', marginBottom: '2rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', backgroundColor: restaurante.aceptando_pedidos ? '#e8f5e9' : '#ffeaa7', border: `2px solid ${restaurante.aceptando_pedidos ? '#4cd137' : '#fbc531'}` }}>
          <div>
            <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>{restaurante.aceptando_pedidos ? '🟢 Restaurante Abierto' : '🔴 Restaurante Pausado'}</h2>
            {!restaurante.aceptando_pedidos ? (
              <p style={{ margin: 0, color: '#d63031', fontWeight: 'bold' }}>Los clientes no pueden hacer pedidos. Reapertura: {formatearFecha(restaurante.tiempo_reactivacion)}</p>
            ) : (
              <p style={{ margin: 0, color: '#27ae60', fontWeight: 'bold' }}>Recibiendo comandas con normalidad.</p>
            )}
          </div>
          <div>
            {restaurante.aceptando_pedidos ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <select value={tipoPausa} onChange={(e) => setTipoPausa(e.target.value)} disabled={cargandoPausa} style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #ccc' }}>
                  <option value="30 minutos">Pausar 30 min</option>
                  <option value="1 hora">Pausar 1 hora</option>
                  <option value="2 horas">Pausar 2 horas</option>
                  <option value="1 día">Pausar todo el día</option>
                  <option value="Exacta">Hasta fecha/hora exacta...</option>
                  <option value="Indefinido">Pausar Indefinidamente</option>
                </select>

                {/* MODIFICACIÓN: Mostrar el calendario solo si elige "Exacta" */}
                {tipoPausa === 'Exacta' && (
                  <input 
                    type="datetime-local" 
                    value={fechaExacta}
                    min={fechaMinimaCalendario}
                    onChange={(e) => setFechaExacta(e.target.value)}
                    disabled={cargandoPausa}
                    style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #0066cc', outline: 'none' }}
                  />
                )}

                <button 
                  onClick={() => ejecutarPausa(false)} 
                  disabled={cargandoPausa}
                  style={{ padding: '0.8rem 1.5rem', background: '#d63031', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {cargandoPausa ? 'Procesando...' : 'Pausar Local'}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => ejecutarPausa(true)} 
                disabled={cargandoPausa}
                style={{ padding: '1rem 2rem', background: '#4cd137', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                {cargandoPausa ? 'Procesando...' : '✅ Reabrir Local Ahora'}
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? <p>Cargando comandas...</p> : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {pedidos.length === 0 && <p style={{ color: '#666', fontStyle: 'italic' }}>Aún no hay pedidos para este local.</p>}
          
          {pedidos.map(pedido => {
            const estadoVisual = pedido.estado.toUpperCase();
            
            let colorBorde = '#eee';
            if (estadoVisual === 'PENDIENTE') colorBorde = '#dc3545';
            else if (estadoVisual === 'EN COCINA') colorBorde = '#ffc107';
            else if (estadoVisual === 'EN CAMINO') colorBorde = '#17a2b8';
            else if (estadoVisual === 'ENTREGADO') colorBorde = '#28a745';
            else if (estadoVisual === 'RECHAZADO') colorBorde = '#6c757d';

            return (
              <div key={pedido.id_pedido} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px', borderLeft: `5px solid ${colorBorde}`, backgroundColor: estadoVisual === 'RECHAZADO' ? '#f8f9fa' : '#fff' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', textDecoration: estadoVisual === 'RECHAZADO' ? 'line-through' : 'none', color: estadoVisual === 'RECHAZADO' ? '#666' : '#000' }}>
                    {pedido.nombre_plato}
                  </h3>
                  <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>📍 {pedido.direccion_envio} | 💳 Pago: {pedido.metodo_pago}</p>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#888' }}>ID Pedido: #{pedido.id_pedido}</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <b style={{ color: estadoVisual === 'RECHAZADO' ? '#dc3545' : '#555' }}>
                    {estadoVisual === 'RECHAZADO' ? '❌ RECHAZADO' : `Estado: ${estadoVisual}`}
                  </b>
                  
                  {estadoVisual !== 'ENTREGADO' && estadoVisual !== 'RECHAZADO' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {estadoVisual === 'PENDIENTE' && (
                        <button 
                          onClick={() => {
                            if(window.confirm("¿Seguro que quieres rechazar este pedido? El cliente será notificado.")) {
                              handleEstado(pedido.id_pedido, pedido.estado, 'RECHAZAR');
                            }
                          }} 
                          style={{ padding: '0.8rem 1rem', background: '#fff', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          Denegar
                        </button>
                      )}
                      
                      <button 
                        onClick={() => handleEstado(pedido.id_pedido, pedido.estado)} 
                        style={{ padding: '0.8rem 1.5rem', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        {estadoVisual === 'PENDIENTE' ? '🍳 Empezar a cocinar' : estadoVisual === 'EN COCINA' ? '🛵 Enviar pedido' : '✅ Marcar Entregado'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}