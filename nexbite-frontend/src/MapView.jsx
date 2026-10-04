import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
// Añadimos useMap a la importación
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import TituloSeccion from './TituloSeccion';
import { coordenadasValidas } from '../../shared/zonaEntrega.js';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const OBTENER_CERCANOS = gql`
  query ObtenerRestaurantesCercanos($lat: Float!, $lng: Float!, $solo_con_entrega: Boolean!) {
    obtenerRestaurantesCercanos(latitud: $lat, longitud: $lng, solo_con_entrega: $solo_con_entrega) {
      id_restaurante
      nombre
      tipo
      latitud
      longitud
      distancia_km
      imagen_url
    }
  }
`;

// NUEVO COMPONENTE: Este componente "invisible" se mete dentro del mapa
// y fuerza a Leaflet a activar o desactivar la rueda del ratón en tiempo real.
function ControladorZoomMapa({ zoomActivo }) {
  const map = useMap();
  
  useEffect(() => {
    if (zoomActivo) {
      map.scrollWheelZoom.enable();
    } else {
      map.scrollWheelZoom.disable();
    }
  }, [zoomActivo, map]);
  
  return null;
}

export default function MapView({ onSelectRestaurante, ubicacion, soloConEntrega = true }) {
  const [zoomActivo, setZoomActivo] = useState(false);

  const { loading, error, data } = useQuery(OBTENER_CERCANOS, {
    variables: { lat: ubicacion?.lat, lng: ubicacion?.lng, solo_con_entrega: soloConEntrega },
    skip: !coordenadasValidas(ubicacion?.lat, ubicacion?.lng),
  });

  if (!coordenadasValidas(ubicacion?.lat, ubicacion?.lng)) return <div style={{ padding: '2rem' }}>Selecciona una ubicación para ver los locales.</div>;

  return (
    <div>
      <div 
        style={{ marginTop: '2rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid #ddd', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', position: 'relative' }}
        onMouseLeave={() => setZoomActivo(false)}
      >
        
        {!zoomActivo && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255,255,255,0)',
            zIndex: 1000, 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto'
          }}>
            <button type="button" onClick={(event) => {
              event.stopPropagation();
              setZoomActivo(true);
            }} style={{
              backgroundColor: 'rgba(0,0,0,0.6)', color: 'white',
              padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem',
              fontWeight: 'bold', backdropFilter: 'blur(2px)',
              opacity: 0.8, transition: 'opacity 0.3s ease',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit'
            }}>
              {/* MODIFICADO: Texto actualizado a lo que pediste */}
              👆 Presiona para explorar
            </button>
          </div>
        )}

        <div inert={!zoomActivo}>
          <MapContainer 
            center={[ubicacion.lat, ubicacion.lng]} 
            zoom={13}
            zoomControl={false} 
            scrollWheelZoom={false} // Inicialmente apagado
            style={{ height: '400px', width: '100%' }}
          >
            {/* NUEVO: Llamamos al controlador pasándole el estado actual */}
            <ControladorZoomMapa zoomActivo={zoomActivo} />
          
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
            <Marker position={[ubicacion.lat, ubicacion.lng]}>
              <Tooltip permanent direction="top" offset={[0, -35]} className="tooltip-ubicacion">
                📍 <b>Dirección seleccionada</b>
              </Tooltip>
            </Marker>

            {data?.obtenerRestaurantesCercanos?.filter(rest => coordenadasValidas(rest?.latitud, rest?.longitud)).map((rest) => (
              <Marker 
                key={rest.id_restaurante} 
                position={[rest.latitud, rest.longitud]}
                eventHandlers={{
                  click: () => {
                    if (zoomActivo) onSelectRestaurante(rest.id_restaurante);
                  }
                }}
              >
                <Tooltip direction="top" offset={[0, -35]}>
                  <div style={{ textAlign: 'center', minWidth: '140px', padding: '5px' }}>
                  
                    {rest.imagen_url ? (
                      <img 
                        src={rest.imagen_url} 
                        alt={rest.nombre} 
                        style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} 
                      />
                    ) : (
                      <div style={{ width: '100%', height: '80px', backgroundColor: '#eee', borderRadius: '6px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🏪</div>
                    )}
                  
                    <h4 style={{ margin: '0 0 5px 0', color: '#ff4500', fontSize: '15px' }}>{rest.nombre}</h4>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>{rest.tipo} • A {rest.distancia_km.toFixed(1)} km</p>
                  
                    <span style={{ fontSize: '11px', color: '#0066cc', fontWeight: 'bold', backgroundColor: '#e6f2ff', padding: '3px 8px', borderRadius: '10px' }}>
                      👆 Presiona para ver menú
                    </span>

                  </div>
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
      
      <TituloSeccion titulo={soloConEntrega ? 'Locales que entregan aquí' : 'Locales cercanos para recoger'} nivel={3} compacto />
      {loading && <p>Calculando distancias espaciales...</p>}
      {error && <p role="alert" style={{ color: '#b42318' }}>No se pudieron cargar los locales del mapa.</p>}
      {!loading && !error && data?.obtenerRestaurantesCercanos?.length === 0 && <p>No hay locales disponibles en esta zona.</p>}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
        {data?.obtenerRestaurantesCercanos?.map((rest) => (
          <div 
            key={rest.id_restaurante} 
            onClick={() => onSelectRestaurante(rest.id_restaurante)}
            style={{ backgroundColor: '#f0f8ff', border: '1px solid #cce7ff', padding: '1.5rem', borderRadius: '12px', cursor: 'pointer' }}
          >
            <h4 style={{ margin: '0 0 10px 0' }}>{rest.nombre}</h4>
            <span style={{ background: '#cce7ff', color: '#0066cc', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{rest.tipo}</span>
            <p style={{ margin: '10px 0 0 0', fontSize: '14px', color: '#555' }}>Distancia: <b>{rest.distancia_km.toFixed(1)} km</b></p>
          </div>
        ))}
      </div>
    </div>
  );
}
