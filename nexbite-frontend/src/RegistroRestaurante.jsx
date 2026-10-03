import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Arreglo para los iconos de Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// AÑADIDOS teléfono y dirección a la mutación
const REGISTRAR_NEGOCIO = gql`
  mutation RegistrarNegocio($nombre: String!, $tipo: String!, $latitud: Float, $longitud: Float, $imagen_url: String, $radio_cobertura_km: Float, $telefono: String, $direccion: String) {
    registrarNegocio(nombre: $nombre, tipo: $tipo, latitud: $latitud, longitud: $longitud, imagen_url: $imagen_url, radio_cobertura_km: $radio_cobertura_km, telefono: $telefono, direccion: $direccion) {
      id_restaurante
      nombre
    }
  }
`;

function CapturadorUbicacion({ posicion, setPosicion }) {
  useMapEvents({
    click(e) { setPosicion({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return posicion ? <Marker position={[posicion.lat, posicion.lng]} /> : null;
}

function RecentrarMapa({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16);
  }, [lat, lng, map]);
  return null;
}

export default function RegistroRestaurante() {
  const [formData, setFormData] = useState({ 
    nombre: '', 
    tipo: 'RESTAURANTE', 
    imagen_url: '',
    radio_cobertura_km: 10.0,
    telefono: '', // NUEVO
    direccion: '' // NUEVO
  });

  const [radioSeleccion, setRadioSeleccion] = useState("10"); 
  const [radioPersonalizado, setRadioPersonalizado] = useState(""); 

  const [posicion, setPosicion] = useState(null); 
  const [centroMapa, setCentroMapa] = useState([40.4168, -3.7038]); 
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);

  const seleccionAutomatica = useRef(false);

  const [registrar, { loading, error }] = useMutation(REGISTRAR_NEGOCIO);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCentroMapa([lat, lng]);
          setPosicion({ lat, lng });
        },
        () => console.log("Sin GPS. Usando ubicación por defecto.")
      );
    }
  }, []);

  useEffect(() => {
    if (busqueda.trim().length < 4 || seleccionAutomatica.current) {
      setSugerencias([]);
      return;
    }

    const timerDeBusqueda = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(busqueda)}`);
        const data = await res.json();
        setSugerencias(data);
      } catch (err) {
        console.error("Error al buscar dirección", err);
      }
      setBuscando(false);
    }, 600); 

    return () => clearTimeout(timerDeBusqueda); 
  }, [busqueda]);

  useEffect(() => {
    if (radioSeleccion === "otro") {
      const num = parseFloat(radioPersonalizado);
      setFormData(prev => ({ ...prev, radio_cobertura_km: isNaN(num) || num <= 0 ? 10 : num }));
    } else {
      setFormData(prev => ({ ...prev, radio_cobertura_km: parseFloat(radioSeleccion) }));
    }
  }, [radioSeleccion, radioPersonalizado]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, imagen_url: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const seleccionarSugerencia = (lugar) => {
    seleccionAutomatica.current = true; 
    const lat = parseFloat(lugar.lat);
    const lng = parseFloat(lugar.lon);

    setPosicion({ lat, lng });
    setCentroMapa([lat, lng]); 
    setBusqueda(lugar.display_name); 
    setFormData(prev => ({ ...prev, direccion: lugar.display_name })); // Autocompletar dirección con la búsqueda
    setSugerencias([]); 
  };

  const handleChangeBuscador = (e) => {
    seleccionAutomatica.current = false; 
    setBusqueda(e.target.value);
    setFormData(prev => ({ ...prev, direccion: e.target.value })); // Mantener sincronizada la dirección escrita a mano
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.imagen_url) {
      return alert('⚠️ Es obligatorio subir una imagen de portada para tu negocio.');
    }

    if (!posicion) {
      return alert('⚠️ Por favor, busca tu dirección o haz clic en el mapa para colocar el pin.');
    }

    if (formData.radio_cobertura_km <= 0 || formData.radio_cobertura_km > 500) {
      return alert('⚠️ La distancia de reparto debe ser un número válido entre 0 y 500 kilómetros.');
    }

    try {
      await registrar({
        variables: { 
          ...formData, 
          latitud: posicion.lat, 
          longitud: posicion.lng
        }
      });
      alert('✅ ¡Negocio registrado con éxito!');
      window.location.reload();
    } catch (err) {
      alert('Error al registrar negocio: ' + err.message);
    }
  };

  const inputStyle = { padding: '12px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', fontSize: '1rem', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', color: '#ff4500', marginTop: 0 }}>🏪 Abre tu Negocio en NexBite</h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

        <div>
          <label style={{ fontWeight: 'bold', color: '#555', fontSize: '14px', display: 'block', marginBottom: '5px' }}>Nombre de tu local</label>
          <input type="text" placeholder="Ej: Pizzería Luigi" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} style={inputStyle} />
        </div>

        <div>
          <label style={{ fontWeight: 'bold', color: '#555', fontSize: '14px', display: 'block', marginBottom: '5px' }}>Tipo de negocio</label>
          <select value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})} style={inputStyle}>
            <option value="RESTAURANTE">Restaurante 🍔</option>
            <option value="SUPERMERCADO">Supermercado 🛒</option>
            <option value="FARMACIA">Farmacia 💊</option>
          </select>
        </div>

        {/* NUEVOS CAMPOS: TELÉFONO Y DIRECCIÓN */}
        <div>
          <label style={{ fontWeight: 'bold', color: '#555', fontSize: '14px', display: 'block', marginBottom: '5px' }}>Teléfono de contacto</label>
          <input type="tel" placeholder="Ej: +34 600 123 456" required value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
            Radio máximo de reparto (Km): 🛵
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select 
              value={radioSeleccion} 
              onChange={(e) => setRadioSeleccion(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
            >
              <option value="3">3 km (Cercano / Zona céntrica)</option>
              <option value="5">5 km (Estándar ciudad)</option>
              <option value="10">10 km (Amplio / Extendido)</option>
              <option value="20">20 km (Todo el municipio)</option>
              <option value="otro">⚙️ Otra distancia (Personalizada)</option>
            </select>
            
            {radioSeleccion === 'otro' && (
              <input 
                type="number" 
                placeholder="Ej: 7.5" 
                step="0.1"
                min="0.1"
                required={radioSeleccion === 'otro'}
                value={radioPersonalizado}
                onChange={(e) => setRadioPersonalizado(e.target.value)}
                style={{ ...inputStyle, width: '120px' }}
              />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
            Imagen de Portada <span style={{ color: 'red' }}>* (Obligatorio)</span>:
          </label>
          <input type="file" accept="image/*" onChange={handleImageChange} required style={inputStyle} />
          {formData.imagen_url && <img src={formData.imagen_url} alt="Vista previa" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px' }} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
            Encuentra tu dirección (esto actualizará el mapa y tu dirección pública):
          </label>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <input 
              type="text" 
              placeholder="Ej: Gran Vía 12, Madrid..." 
              value={busqueda} 
              onChange={handleChangeBuscador} 
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} 
            />
            {buscando && <span style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '12px', color: '#888' }}>Buscando...</span>}

            {sugerencias.length > 0 && (
              <ul style={{ 
                listStyle: 'none', padding: 0, margin: 0, 
                border: '1px solid #ccc', borderRadius: '6px', 
                maxHeight: '200px', overflowY: 'auto', 
                background: '#fff', position: 'absolute', 
                zIndex: 1000, width: '100%', top: '100%', marginTop: '4px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                {sugerencias.map((lugar, i) => (
                  <li 
                    key={i} 
                    onClick={() => seleccionarSugerencia(lugar)} 
                    style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '14px', color: '#333' }} 
                    onMouseEnter={(e) => e.target.style.background = '#f5f5f5'} 
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                  >
                    📍 {lugar.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ border: '2px solid #eaeaea', borderRadius: '8px', overflow: 'hidden', position: 'relative', zIndex: 1, marginTop: '10px' }}>
            <MapContainer center={centroMapa} zoom={14} style={{ height: '250px', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <CapturadorUbicacion posicion={posicion} setPosicion={setPosicion} />
              <RecentrarMapa lat={centroMapa[0]} lng={centroMapa[1]} />
            </MapContainer>
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ padding: '1rem', background: '#ff4500', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', marginTop: '15px' }}>
          {loading ? 'Registrando...' : '🚀 Registrar Negocio'}
        </button>
      </form>
    </div>
  );
}