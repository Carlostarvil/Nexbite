import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { useState } from 'react';
import RegistroRestaurante from './RegistroRestaurante';

// MODIFICACIÓN: Añadimos 'tiempo_reactivacion' a la consulta
const OBTENER_MIS_RESTAURANTES = gql`
  query ObtenerMisRestaurantes {
    obtenerMisRestaurantes {
      id_restaurante
      nombre
      tipo
      imagen_url
      aceptando_pedidos
      tiempo_reactivacion
      latitud
      longitud
      radio_cobertura_km
      telefono
      direccion
      horarios_recogida { dia inicio fin }
    }
  }
`;

// Función para formatear fechas
const formatearFecha = (fechaStr) => {
  if (!fechaStr || String(fechaStr).includes('Indefinido')) return 'Sin estimación';
  const timestamp = !isNaN(fechaStr) && String(fechaStr).trim() !== '' ? Number(fechaStr) : fechaStr;
  const fecha = new Date(timestamp);
  if (isNaN(fecha.getTime())) return String(fechaStr); 
  return fecha.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function MisLocales({ onCrearNuevo, onGestionarMenu, onGestionarPedidos }) {
  const [localEdicion, setLocalEdicion] = useState(null);
  const [aviso, setAviso] = useState('');
  const { loading, error, data, refetch } = useQuery(OBTENER_MIS_RESTAURANTES, { fetchPolicy: 'network-only' });

  if (localEdicion) return <RegistroRestaurante key={localEdicion.id_restaurante} restaurante={localEdicion}
    onCancelar={() => setLocalEdicion(null)}
    onGuardado={() => {
      setLocalEdicion(null);
      setAviso('Los cambios del local se han guardado.');
      refetch().catch(() => setAviso('Los cambios se han guardado, pero no se ha podido actualizar la lista.'));
    }} />;

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando tus negocios...</div>;
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>
    {aviso && <p role="status">{aviso}</p>}
    <p>Error al cargar: {error.message}</p>
    <button onClick={() => refetch().catch(() => null)}>Volver a intentar</button>
  </div>;

  const locales = data?.obtenerMisRestaurantes || [];

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ color: '#333', margin: 0 }}>🏪 Mis Negocios</h2>
        <button onClick={onCrearNuevo} style={{ padding: '0.8rem 1.5rem', background: '#ff4500', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Registrar Nuevo Local
        </button>
      </div>

      {aviso && <p role="status" style={{ padding: '12px 15px', borderRadius: '8px', background: '#e8f5e9', color: '#256029', marginTop: 0 }}>{aviso}</p>}

      {locales.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3>Aún no tienes ningún negocio registrado</h3>
          <p style={{ color: '#666' }}>Haz clic en el botón de arriba para registrar tu primer local y empezar a vender.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1.5rem' }}>
          {locales.map(local => (
            <div key={local.id_restaurante} style={{ background: '#fff', border: '1px solid #eaeaea', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
              {local.imagen_url ? (
                <img src={local.imagen_url} alt={local.nombre} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '180px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>🏪</div>
              )}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <h3 style={{ margin: '0 0 10px 0' }}>{local.nombre}</h3>
                <div>
                  <span style={{ fontSize: '12px', background: '#ffe4cc', color: '#ff4500', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>{local.tipo}</span>
                  
                  {/* MODIFICACIÓN: Mostramos la hora exacta en la etiqueta de pausa */}
                  {local.aceptando_pedidos === false && (
                    <span style={{ fontSize: '12px', background: '#ffcccc', color: '#cc0000', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', marginLeft: '10px' }}>
                      ⏸️ Pausado (Vuelve: {formatearFecha(local.tiempo_reactivacion)})
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: 'auto', paddingTop: '15px' }}>
                  <button type="button" aria-label={`Editar ${local.nombre}`}
                    onClick={() => { setAviso(''); setLocalEdicion(local); }}
                    style={{ flex: '1 1 80px', padding: '0.8rem', background: '#f3f4f6', color: '#333', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                    ✏️ Editar
                  </button>
                  <button 
                    onClick={() => onGestionarMenu(local)} 
                    style={{ flex: 1, padding: '0.8rem', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s', fontSize: '14px' }}
                  >
                    📋 Menú
                  </button>
                  <button 
                    onClick={() => onGestionarPedidos(local)} 
                    style={{ flex: 1, padding: '0.8rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s', fontSize: '14px' }}
                  >
                    🛵 Pedidos
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
