import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { DIAS_RECOGIDA, validarHorariosRecogida } from '../../shared/horariosRecogida.js';

// Arreglo para los iconos de Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const REGISTRAR_NEGOCIO = gql`
  mutation RegistrarNegocio($nombre: String!, $tipo: String!, $latitud: Float, $longitud: Float, $imagen_url: String, $radio_cobertura_km: Float, $telefono: String, $direccion: String, $horarios_recogida: [FranjaRecogidaInput!]!) {
    registrarNegocio(nombre: $nombre, tipo: $tipo, latitud: $latitud, longitud: $longitud, imagen_url: $imagen_url, radio_cobertura_km: $radio_cobertura_km, telefono: $telefono, direccion: $direccion, horarios_recogida: $horarios_recogida) {
      id_restaurante
      nombre
    }
  }
`;

const ACTUALIZAR_NEGOCIO = gql`
  mutation ActualizarNegocio($id_restaurante: ID!, $nombre: String!, $tipo: String!, $latitud: Float!, $longitud: Float!, $imagen_url: String!, $radio_cobertura_km: Float!, $telefono: String!, $direccion: String, $horarios_recogida: [FranjaRecogidaInput!]) {
    actualizarNegocio(id_restaurante: $id_restaurante, nombre: $nombre, tipo: $tipo, latitud: $latitud, longitud: $longitud, imagen_url: $imagen_url, radio_cobertura_km: $radio_cobertura_km, telefono: $telefono, direccion: $direccion, horarios_recogida: $horarios_recogida) {
      id_restaurante
      nombre
      tipo
      latitud
      longitud
      imagen_url
      radio_cobertura_km
      telefono
      direccion
      horarios_recogida { dia inicio fin }
      aceptando_pedidos
      tiempo_reactivacion
    }
  }
`;

const CATEGORIAS_DISPONIBLES = [
  { id: 'Restaurante', emoji: '🍽️' },
  { id: 'Supermercado', emoji: '🛒' },
  { id: 'Farmacia', emoji: '💊' },
  { id: 'Hamburguesas', emoji: '🍔' },
  { id: 'Pizza', emoji: '🍕' },
  { id: 'Desayuno', emoji: '☕' },
  { id: 'Asiática', emoji: '🍣' },
  { id: 'Sana', emoji: '🥗' },
  { id: 'Americana', emoji: '🌭' },
  { id: 'Postres', emoji: '🍰' },
  { id: 'Sándwiches', emoji: '🥪' },
  { id: 'Mexicana', emoji: '🌮' },
  { id: 'Pollo', emoji: '🍗' }
];

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

export default function RegistroRestaurante({ restaurante = null, onGuardado, onCancelar }) {
  const esEdicion = Boolean(restaurante?.id_restaurante);
  const ubicacionInicial = restaurante?.latitud != null && restaurante?.longitud != null
    ? { lat: restaurante.latitud, lng: restaurante.longitud } : null;
  const radioInicial = restaurante?.radio_cobertura_km ?? 10;
  const radioPredefinido = [3, 5, 10, 20].includes(radioInicial);
  
  const normalizarTipoInicial = (tipo) => {
    if (!tipo) return 'Restaurante';
    if (tipo === 'RESTAURANTE') return 'Restaurante';
    if (tipo === 'SUPERMERCADO') return 'Supermercado';
    if (tipo === 'FARMACIA') return 'Farmacia';
    return tipo;
  };

  const [formData, setFormData] = useState(() => ({
    nombre: restaurante?.nombre ?? '',
    tipo: normalizarTipoInicial(restaurante?.tipo),
    imagen_url: restaurante?.imagen_url ?? '',
    telefono: restaurante?.telefono ?? '',
    direccion: restaurante?.direccion ?? '',
  }));

  const [radioSeleccion, setRadioSeleccion] = useState(radioPredefinido ? String(radioInicial) : 'otro');
  const [configurarHorarios, setConfigurarHorarios] = useState(!esEdicion || restaurante.horarios_recogida != null);
  
  const [horariosRecogida, setHorariosRecogida] = useState(() =>
    DIAS_RECOGIDA.map((_, dia) => {
      const franjas = restaurante?.horarios_recogida?.filter(franja => franja.dia === dia)
        .map(({ inicio, fin }) => ({ inicio, fin }));
      return {
        activo: franjas ? franjas.length > 0 : true,
        franjas: franjas?.length ? franjas : [{ inicio: '12:00', fin: '23:00' }],
      };
    })
  );

  const actualizarDia = (dia, actualizar) => setHorariosRecogida(anterior =>
    anterior.map((horario, indice) => indice === dia ? actualizar(horario) : horario)
  );
  
  const [radioPersonalizado, setRadioPersonalizado] = useState(radioPredefinido ? '' : String(radioInicial));

  const [posicion, setPosicion] = useState(ubicacionInicial);
  const [centroMapa, setCentroMapa] = useState(ubicacionInicial ? [ubicacionInicial.lat, ubicacionInicial.lng] : [40.4168, -3.7038]);
  const [busqueda, setBusqueda] = useState(restaurante?.direccion ?? '');
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);

  const seleccionAutomatica = useRef(esEdicion);

  const [registrar, { loading: registrando }] = useMutation(REGISTRAR_NEGOCIO);
  const [actualizar, { loading: actualizando }] = useMutation(ACTUALIZAR_NEGOCIO);
  const [errorFormulario, setErrorFormulario] = useState('');
  const loading = registrando || actualizando;

  useEffect(() => {
    if (esEdicion) return;
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
  }, [esEdicion]);

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(anterior => ({ ...anterior, imagen_url: reader.result }));
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
    setFormData(prev => ({ ...prev, direccion: lugar.display_name })); 
    setSugerencias([]); 
  };

  const handleChangeBuscador = (e) => {
    seleccionAutomatica.current = false; 
    setBusqueda(e.target.value);
    setFormData(prev => ({ ...prev, direccion: e.target.value })); 
  };

  const toggleCategoria = (catId) => {
    const seleccionados = formData.tipo ? formData.tipo.split(',').map(t => t.trim()) : [];
    let nuevosSeleccionados;
    
    if (seleccionados.includes(catId)) {
      nuevosSeleccionados = seleccionados.filter(t => t !== catId);
    } else {
      nuevosSeleccionados = [...seleccionados, catId];
    }
    
    setFormData({ ...formData, tipo: nuevosSeleccionados.join(', ') });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorFormulario('');

    if (!formData.tipo || formData.tipo.trim() === '') {
      return alert('⚠️ Selecciona al menos una categoría para tu local.');
    }

    if (!formData.imagen_url) {
      return alert('⚠️ Es obligatorio subir una imagen de portada para tu negocio.');
    }

    if (!posicion) {
      return alert('⚠️ Por favor, busca tu dirección o haz clic en el mapa para colocar el pin.');
    }

    const radioFinal = parseFloat(radioSeleccion === 'otro' ? radioPersonalizado : radioSeleccion);
    if (!Number.isFinite(radioFinal) || radioFinal <= 0 || radioFinal > 500) {
      return alert('⚠️ La distancia de reparto debe ser un número válido entre 0 y 500 kilómetros.');
    }

    try {
      const horarios = configurarHorarios ? validarHorariosRecogida(horariosRecogida.flatMap((horario, dia) =>
        horario.activo ? horario.franjas.map(franja => ({ dia, ...franja })) : []
      )) : null;
      
      const variables = {
        ...formData,
        radio_cobertura_km: radioFinal,
        horarios_recogida: horarios,
        latitud: posicion.lat,
        longitud: posicion.lng,
      };
      
      if (esEdicion) {
        const resultado = await actualizar({ variables: { ...variables, id_restaurante: restaurante.id_restaurante } });
        onGuardado?.(resultado.data.actualizarNegocio);
      } else {
        await registrar({ variables });
        alert('✅ ¡Negocio registrado con éxito!');
        window.location.reload();
      }
    } catch (err) {
      setErrorFormulario(err.message);
    }
  };

  const inputStyle = { padding: '12px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', fontSize: '1rem', width: '100%', boxSizing: 'border-box' };
  const tiposActuales = formData.tipo ? formData.tipo.split(',').map(t => t.trim()) : [];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', color: '#ff4500', marginTop: 0 }}>{esEdicion ? '✏️ Editar local' : '🏪 Abre tu Negocio en NexBite'}</h2>
      {errorFormulario && <p role="alert" style={{ padding: '12px', background: '#fdecea', color: '#b71c1c', borderRadius: '6px' }}>{errorFormulario}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div>
          <label style={{ fontWeight: 'bold', color: '#555', fontSize: '14px', display: 'block', marginBottom: '5px' }}>Nombre de tu local</label>
          <input type="text" placeholder="Ej: Pizzería Luigi" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} style={inputStyle} />
        </div>

        <div>
          <label style={{ fontWeight: 'bold', color: '#555', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Categorías del negocio (Elige varias)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {CATEGORIAS_DISPONIBLES.map(cat => {
              const isSelected = tiposActuales.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategoria(cat.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
                    fontSize: '14px', fontWeight: isSelected ? 'bold' : 'normal',
                    border: isSelected ? '1px solid #ff4500' : '1px solid #ddd',
                    backgroundColor: isSelected ? '#fff0eb' : '#fff',
                    color: isSelected ? '#ff4500' : '#444',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{cat.emoji}</span> {cat.id}
                </button>
              );
            })}
          </div>
        </div>

        <fieldset style={{ margin: 0, padding: '15px', border: '1px solid #e5e5e5', borderRadius: '8px', minWidth: 0 }}>
          <legend style={{ fontWeight: 'bold', color: '#555' }}>Horarios de recogida</legend>
          
          {esEdicion && restaurante.horarios_recogida == null && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#555', marginBottom: '12px' }}>
              <input type="checkbox" checked={configurarHorarios} onChange={e => setConfigurarHorarios(e.target.checked)} />
              Configurar horarios de recogida
            </label>
          )}
          
          {!configurarHorarios && (
            <p style={{ fontSize: '13px', color: '#666' }}>Este local aún no tiene horarios de recogida definidos. Puedes configurarlos al editarlo.</p>
          )}

          {configurarHorarios && (
            <>
              <p style={{ margin: '0 0 15px', fontSize: '13px', color: '#666' }}>
                Selecciona los días y las horas en que los clientes pueden recoger sus pedidos (hora peninsular).
                Puedes añadir varias franjas para separar comida y cena. Si la hora de cierre es anterior a la de apertura, termina al día siguiente.
              </p>
              
              {horariosRecogida.map((horario, dia) => (
                <div key={dia} style={{ padding: '10px 0', borderTop: dia ? '1px solid #eee' : 'none' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#444', marginBottom: '8px' }}>
                    <input type="checkbox" checked={horario.activo} onChange={e => actualizarDia(dia, h => ({ ...h, activo: e.target.checked }))} />
                    {DIAS_RECOGIDA[dia]}
                    {!horario.activo && <span style={{ fontWeight: 'normal', color: '#888', fontSize: '13px' }}>Sin recogida</span>}
                  </label>
                  
                  {horario.activo && (
                    <>
                      {horario.franjas.map((franja, indice) => (
                        <div key={indice} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ flex: '1 1 130px', fontSize: '13px', color: '#555' }}>
                            Desde
                            <input type="time" required aria-label={`${DIAS_RECOGIDA[dia]}, inicio de franja ${indice + 1}`} value={franja.inicio}
                              onChange={e => actualizarDia(dia, h => ({ ...h, franjas: h.franjas.map((f, i) => i === indice ? { ...f, inicio: e.target.value } : f) }))}
                              style={{ ...inputStyle, marginTop: '4px' }} />
                          </label>
                          <label style={{ flex: '1 1 130px', fontSize: '13px', color: '#555' }}>
                            Hasta
                            <input type="time" required aria-label={`${DIAS_RECOGIDA[dia]}, fin de franja ${indice + 1}`} value={franja.fin}
                              onChange={e => actualizarDia(dia, h => ({ ...h, franjas: h.franjas.map((f, i) => i === indice ? { ...f, fin: e.target.value } : f) }))}
                              style={{ ...inputStyle, marginTop: '4px' }} />
                          </label>
                          {horario.franjas.length > 1 && (
                            <button type="button" aria-label={`Eliminar franja ${indice + 1} del ${DIAS_RECOGIDA[dia]}`}
                              onClick={() => actualizarDia(dia, h => ({ ...h, franjas: h.franjas.filter((_, i) => i !== indice) }))}
                              style={{ background: '#fff', border: '1px solid #ddd', padding: '10px', borderRadius: '6px', cursor: 'pointer', color: '#c0392b' }}>
                              Eliminar
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" disabled={horario.franjas.length >= 4}
                        onClick={() => actualizarDia(dia, h => ({ ...h, franjas: [...h.franjas, { inicio: '', fin: '' }] }))}
                        style={{ border: 'none', background: 'none', color: '#0066cc', padding: '4px 0', cursor: 'pointer', fontWeight: 'bold' }}>
                        + Añadir franja
                      </button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </fieldset>

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
          {esEdicion && formData.imagen_url && <p style={{ margin: '0 0 8px', color: '#666', fontSize: '13px' }}>La portada actual se conserva. Selecciona otra imagen si quieres cambiarla.</p>}
          <input type="file" accept="image/*" onChange={handleImageChange} required={!formData.imagen_url} style={inputStyle} />
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
          {loading ? (esEdicion ? 'Guardando...' : 'Registrando...') : (esEdicion ? 'Guardar cambios' : '🚀 Registrar Negocio')}
        </button>
        {esEdicion && <button type="button" onClick={onCancelar} disabled={loading} style={{ padding: '1rem', background: '#f3f4f6', color: '#444', border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>}
      </form>
    </div>
  );
}