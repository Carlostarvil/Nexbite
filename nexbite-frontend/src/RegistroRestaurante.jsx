import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { DIAS_RECOGIDA, validarHorariosRecogida } from '../../shared/horariosRecogida.js';
import MensajeAccion, { IconoEstado } from './MensajeAccion';
import { IconoVendedor, TituloVendedor } from './VendedorUI';
import { categoriasLocal, textoCategoriaLocal } from './vendedorUtils';
import EtiquetasLocal from './EtiquetasLocal';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const REGISTRAR_NEGOCIO = gql`
  mutation RegistrarNegocio($nombre: String!, $tipo: String!, $latitud: Float, $longitud: Float, $imagen_url: String, $radio_cobertura_km: Float, $telefono: String, $direccion: String, $horarios_recogida: [FranjaRecogidaInput!]!) {
    registrarNegocio(nombre: $nombre, tipo: $tipo, latitud: $latitud, longitud: $longitud, imagen_url: $imagen_url, radio_cobertura_km: $radio_cobertura_km, telefono: $telefono, direccion: $direccion, horarios_recogida: $horarios_recogida) { id_restaurante nombre }
  }
`;
const ACTUALIZAR_NEGOCIO = gql`
  mutation ActualizarNegocio($id_restaurante: ID!, $nombre: String!, $tipo: String!, $latitud: Float!, $longitud: Float!, $imagen_url: String!, $radio_cobertura_km: Float!, $telefono: String!, $direccion: String, $horarios_recogida: [FranjaRecogidaInput!]) {
    actualizarNegocio(id_restaurante: $id_restaurante, nombre: $nombre, tipo: $tipo, latitud: $latitud, longitud: $longitud, imagen_url: $imagen_url, radio_cobertura_km: $radio_cobertura_km, telefono: $telefono, direccion: $direccion, horarios_recogida: $horarios_recogida) {
      id_restaurante nombre tipo latitud longitud imagen_url radio_cobertura_km telefono direccion
      horarios_recogida { dia inicio fin } aceptando_pedidos tiempo_reactivacion
    }
  }
`;
const CATEGORIAS = ['RESTAURANTE', 'SUPERMERCADO', 'FARMACIA', 'HAMBURGUESAS', 'PIZZA', 'DESAYUNO', 'ASIÁTICA', 'SANA', 'AMERICANA', 'POSTRES', 'SÁNDWICHES', 'MEXICANA', 'POLLO'];

function CapturadorUbicacion({ posicion, setPosicion }) {
  useMapEvents({ click(e) { setPosicion({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return posicion ? <Marker position={[posicion.lat, posicion.lng]} /> : null;
}
function RecentrarMapa({ lat, lng }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], 16); }, [lat, lng, map]);
  return null;
}
function CabeceraPanel({ numero, titulo, descripcion }) {
  return <div className="vendedor-panel-titulo"><span>{numero}</span><div><h2>{titulo}</h2><p>{descripcion}</p></div></div>;
}

export default function RegistroRestaurante({ restaurante = null, onGuardado, onCancelar }) {
  const esEdicion = Boolean(restaurante?.id_restaurante);
  const ubicacionInicial = restaurante?.latitud != null && restaurante?.longitud != null ? { lat: restaurante.latitud, lng: restaurante.longitud } : null;
  const radioInicial = restaurante?.radio_cobertura_km ?? 10;
  const radioPredefinido = [3, 5, 10, 20].includes(radioInicial);
  const [formData, setFormData] = useState(() => ({
    nombre: restaurante?.nombre ?? '', tipo: categoriasLocal(restaurante?.tipo || 'RESTAURANTE').map(t => t.toUpperCase()),
    imagen_url: restaurante?.imagen_url ?? '', telefono: restaurante?.telefono ?? '', direccion: restaurante?.direccion ?? '',
  }));
  const [radioSeleccion, setRadioSeleccion] = useState(radioPredefinido ? String(radioInicial) : 'otro');
  const [radioPersonalizado, setRadioPersonalizado] = useState(radioPredefinido ? '' : String(radioInicial));
  const [configurarHorarios, setConfigurarHorarios] = useState(!esEdicion || restaurante.horarios_recogida != null);
  const [horariosRecogida, setHorariosRecogida] = useState(() => DIAS_RECOGIDA.map((_, dia) => {
    const franjas = restaurante?.horarios_recogida?.filter(f => f.dia === dia).map(({ inicio, fin }) => ({ inicio, fin }));
    return { activo: franjas ? franjas.length > 0 : true, franjas: franjas?.length ? franjas : [{ inicio: '12:00', fin: '23:00' }] };
  }));
  const [posicion, setPosicion] = useState(ubicacionInicial);
  const [centroMapa, setCentroMapa] = useState(ubicacionInicial ? [ubicacionInicial.lat, ubicacionInicial.lng] : [40.4168, -3.7038]);
  const [busqueda, setBusqueda] = useState(restaurante?.direccion ?? '');
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState(null);
  const [leyendoImagen, setLeyendoImagen] = useState(false);
  const seleccionAutomatica = useRef(esEdicion);
  const guardando = useRef(false);
  const errorRef = useRef(null);
  const [registrar, { loading: registrando }] = useMutation(REGISTRAR_NEGOCIO);
  const [actualizar, { loading: actualizando }] = useMutation(ACTUALIZAR_NEGOCIO);
  const loading = registrando || actualizando;
  const ocupado = loading || leyendoImagen;

  useEffect(() => {
    if (esEdicion || !navigator.geolocation) return;
    let activo = true;
    navigator.geolocation.getCurrentPosition(pos => {
      if (!activo) return;
      const { latitude: lat, longitude: lng } = pos.coords;
      setCentroMapa([lat, lng]);
    }, () => {});
    return () => { activo = false; };
  }, [esEdicion]);

  useEffect(() => {
    if (busqueda.trim().length < 4 || seleccionAutomatica.current) return;
    const controlador = new AbortController();
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const respuesta = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(busqueda), { signal: controlador.signal });
        if (!respuesta.ok) throw new Error('No se pudo buscar');
        const resultados = await respuesta.json();
        if (!controlador.signal.aborted) setSugerencias(resultados);
      } catch {
        if (!controlador.signal.aborted) setSugerencias([]);
      } finally { if (!controlador.signal.aborted) setBuscando(false); }
    }, 600);
    return () => { clearTimeout(timer); controlador.abort(); };
  }, [busqueda]);

  const mostrarError = descripcion => {
    setErrorFormulario({ tipo: 'error', titulo: 'Revisa la información del local', descripcion });
    requestAnimationFrame(() => { errorRef.current?.focus(); errorRef.current?.scrollIntoView({ block: 'center' }); });
  };
  const actualizarDia = (dia, actualizarDiaActual) => setHorariosRecogida(prev => prev.map((horario, i) => i === dia ? actualizarDiaActual(horario) : horario));
  const cambiar = (campo, valor) => { setErrorFormulario(null); setFormData(prev => ({ ...prev, [campo]: valor })); };
  const handleImageChange = e => {
    const entrada = e.target;
    const archivo = entrada.files[0];
    if (!archivo) return;
    setErrorFormulario(null);
    if (!archivo.type.startsWith('image/')) { mostrarError('Selecciona una imagen JPG, PNG, WEBP o GIF.'); entrada.value = ''; return; }
    setLeyendoImagen(true);
    const fallo = texto => { setLeyendoImagen(false); entrada.value = ''; mostrarError(texto); };
    const lector = new FileReader();
    lector.onerror = () => fallo('No hemos podido leer la imagen. Prueba con otra.');
    lector.onload = () => {
      const imagen = new Image();
      imagen.onerror = () => fallo('El archivo no se puede abrir como imagen. Selecciona otra foto.');
      imagen.onload = () => {
        if (imagen.width < 800) return fallo('La portada debe tener al menos 800 píxeles de ancho.');
        if (imagen.width / imagen.height < 1.3) return fallo('Elige una portada horizontal y panorámica para que tu local se vea bien.');
        cambiar('imagen_url', lector.result); setLeyendoImagen(false);
      };
      imagen.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  };
  const seleccionarSugerencia = lugar => {
    const lat = Number(lugar.lat), lng = Number(lugar.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    seleccionAutomatica.current = true;
    setPosicion({ lat, lng }); setCentroMapa([lat, lng]); setBusqueda(lugar.display_name);
    cambiar('direccion', lugar.display_name); setSugerencias([]); setBuscando(false);
  };
  const handleSubmit = async e => {
    e.preventDefault();
    if (guardando.current || ocupado) return;
    setErrorFormulario(null);
    if (!formData.nombre.trim()) return mostrarError('Escribe el nombre de tu local.');
    if (!formData.telefono.trim()) return mostrarError('Añade un teléfono de contacto.');
    if (!formData.tipo.length) return mostrarError('Selecciona al menos una categoría para tu local.');
    if (!formData.imagen_url) return mostrarError('Sube una imagen de portada para presentar tu negocio.');
    if (!posicion) return mostrarError('Selecciona una dirección de la lista o coloca el pin en el mapa.');
    const radioFinal = Number(radioSeleccion === 'otro' ? radioPersonalizado : radioSeleccion);
    if (!Number.isFinite(radioFinal) || radioFinal <= 0 || radioFinal > 500) return mostrarError('La distancia de reparto debe ser mayor que 0 y no superar 500 km.');
    guardando.current = true;
    try {
      const horarios = configurarHorarios ? validarHorariosRecogida(horariosRecogida.flatMap((horario, dia) => horario.activo ? horario.franjas.map(f => ({ dia, ...f })) : [])) : null;
      const tipoAnterior = String(restaurante?.tipo || '');
      const metadatos = tipoAnterior.includes('|') ? tipoAnterior.slice(tipoAnterior.indexOf('|')) : '';
      const variables = { ...formData, nombre: formData.nombre.trim(), telefono: formData.telefono.trim(), tipo: formData.tipo.join(', ') + metadatos, radio_cobertura_km: radioFinal, horarios_recogida: horarios, latitud: posicion.lat, longitud: posicion.lng };
      const resultado = esEdicion ? await actualizar({ variables: { ...variables, id_restaurante: restaurante.id_restaurante } }) : await registrar({ variables });
      const local = resultado.data?.[esEdicion ? 'actualizarNegocio' : 'registrarNegocio'];
      if (!local) throw new Error('No se ha podido confirmar el guardado. Vuelve a intentarlo.');
      onGuardado?.(local);
    } catch (err) { mostrarError(err.message); }
    finally { guardando.current = false; }
  };

  return <>
    <button type="button" className="vendedor-atras" disabled={ocupado} onClick={onCancelar}><IconoVendedor nombre="volver" />Volver a mis locales</button>
    <TituloVendedor titulo={esEdicion ? 'Editar local' : 'Presenta tu negocio'} contexto={esEdicion ? restaurante.nombre : 'Un nuevo comienzo'} descripcion={esEdicion ? 'Mantén al día la información que ven tus clientes.' : 'Dale un nombre, una buena portada y un lugar en el mapa.'} />
    <div ref={errorRef} tabIndex={-1} className="vendedor-form-mensaje"><MensajeAccion mensaje={errorFormulario} onCerrar={() => setErrorFormulario(null)} /></div>
    <form onSubmit={handleSubmit} noValidate>
      <fieldset disabled={ocupado}>
      <div className="vendedor-form-layout">
        <div className="vendedor-form-principal">
          <section className="vendedor-panel"><CabeceraPanel numero="01" titulo="La esencia de tu local" descripcion="Lo primero que tus clientes van a conocer." />
            <div className="vendedor-form-grid"><label className="vendedor-campo"><span>Nombre del local</span><input required placeholder="Ej: Pizzería Luigi" value={formData.nombre} onChange={e => cambiar('nombre', e.target.value)} /></label><label className="vendedor-campo"><span>Teléfono de contacto</span><input type="tel" required placeholder="Ej: +34 600 123 456" value={formData.telefono} onChange={e => cambiar('telefono', e.target.value)} /></label>
              <div className="vendedor-form-fila-completa"><span className="vendedor-label" id="categorias-local-titulo">Categorías de tu negocio</span><div className="vendedor-opciones" role="group" aria-labelledby="categorias-local-titulo">{[...new Set([...CATEGORIAS, ...formData.tipo])].map(tipo => <button type="button" key={tipo} className="vendedor-opcion" aria-pressed={formData.tipo.includes(tipo)} onClick={() => cambiar('tipo', formData.tipo.includes(tipo) ? formData.tipo.filter(t => t !== tipo) : [...formData.tipo, tipo])}>{['RESTAURANTE', 'SUPERMERCADO', 'FARMACIA'].includes(tipo) && <IconoVendedor nombre={tipo === 'FARMACIA' ? 'farmacia' : tipo === 'SUPERMERCADO' ? 'mercado' : 'plato'} tamano={17} />}{textoCategoriaLocal(tipo)}</button>)}</div><small className="vendedor-ayuda-campo">Puedes elegir varias categorías para ayudar a encontrar tu local.</small></div>
            </div>
          </section>
          <section className="vendedor-panel"><CabeceraPanel numero="02" titulo="Una portada que invite a entrar" descripcion="Muestra el ambiente y la personalidad de tu negocio." />
            <div className="vendedor-carga-imagen"><div className="vendedor-carga-imagen-cabecera"><IconoVendedor nombre="subir" tamano={30} /><div><strong>{formData.imagen_url ? 'Cambiar imagen de portada' : 'Subir imagen de portada'}</strong><p>Foto horizontal · mínimo 800 px de ancho.</p></div></div><input type="file" aria-label="Imagen de portada del local" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageChange} />{leyendoImagen && <span role="status">Preparando tu imagen...</span>}</div>
          </section>
          <section className="vendedor-panel"><CabeceraPanel numero="03" titulo="Encuéntranos aquí" descripcion="La ubicación exacta se utiliza para calcular tu zona de reparto." />
            <div className="vendedor-direccion"><label className="vendedor-campo"><span>Dirección del local</span><input placeholder="Ej: Gran Vía 12, Madrid..." autoComplete="street-address" value={busqueda} onChange={e => { seleccionAutomatica.current = false; setBusqueda(e.target.value); cambiar('direccion', e.target.value); setSugerencias([]); setPosicion(null); setBuscando(false); }} /></label>{buscando && <small className="vendedor-ayuda-campo" role="status">Buscando direcciones...</small>}
              {sugerencias.length > 0 && <ul className="vendedor-sugerencias" aria-label="Direcciones sugeridas">{sugerencias.map((lugar, i) => <li key={lugar.place_id || i}><button type="button" onClick={() => seleccionarSugerencia(lugar)}><IconoVendedor nombre="mapa" tamano={16} /><span>{lugar.display_name}</span></button></li>)}</ul>}
            </div>
            <div className="vendedor-mapa"><MapContainer center={centroMapa} zoom={14} style={{ height: '265px', width: '100%' }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' /><CapturadorUbicacion posicion={posicion} setPosicion={setPosicion} /><RecentrarMapa lat={centroMapa[0]} lng={centroMapa[1]} /></MapContainer><div className="vendedor-mapa-pie"><IconoVendedor nombre={posicion ? 'check' : 'mapa'} tamano={15} /><span>{posicion ? 'Ubicación seleccionada. Puedes ajustar el pin pulsando en el mapa.' : 'Selecciona una dirección sugerida o pulsa en el mapa para colocar el pin.'}</span></div></div>
          </section>
          <section className="vendedor-panel"><CabeceraPanel numero="04" titulo="Reparto y recogida" descripcion="Decide hasta dónde llegas y cuándo pueden recoger sus pedidos." />
            <label className="vendedor-campo"><span>Radio máximo de reparto</span><select aria-label="Radio máximo de reparto" value={radioSeleccion} onChange={e => setRadioSeleccion(e.target.value)}><option value="3">3 km · Zona cercana</option><option value="5">5 km · Ciudad</option><option value="10">10 km · Zona ampliada</option><option value="20">20 km · Municipio</option><option value="otro">Otra distancia</option></select></label>
            {radioSeleccion === 'otro' && <label className="vendedor-campo" style={{ marginTop: 14 }}><span>Distancia personalizada (km)</span><input type="number" min=".1" max="500" step=".1" required value={radioPersonalizado} placeholder="Ej: 7.5" onChange={e => setRadioPersonalizado(e.target.value)} /></label>}
            <div className="vendedor-panel-titulo" style={{ marginTop: 28 }}><span><IconoVendedor nombre="reloj" /></span><div><h2>Horarios de recogida</h2><p>Hora peninsular. Separa comida y cena con varias franjas.</p></div></div>
            {esEdicion && restaurante.horarios_recogida == null && <label className="vendedor-checkbox" style={{ marginBottom: 20 }}><input type="checkbox" checked={configurarHorarios} onChange={e => setConfigurarHorarios(e.target.checked)} />Configurar horarios de recogida</label>}
            {!configurarHorarios ? <p className="vendedor-ayuda-campo">Activa esta opción para indicar cuándo se pueden recoger pedidos.</p> : <div className="vendedor-horarios">{horariosRecogida.map((horario, dia) => <div key={dia} className="vendedor-horario-dia">
              <div className="vendedor-horario-dia-cabecera"><label className="vendedor-checkbox"><input type="checkbox" checked={horario.activo} onChange={e => actualizarDia(dia, h => ({ ...h, activo: e.target.checked }))} />{DIAS_RECOGIDA[dia]}</label>{!horario.activo && <span className="vendedor-horario-inactivo">Sin recogida</span>}</div>
              {horario.activo && <>{horario.franjas.map((franja, indice) => <div className="vendedor-horario-franja" key={indice}><label className="vendedor-campo"><span>Desde</span><input type="time" required aria-label={DIAS_RECOGIDA[dia] + ', inicio de franja ' + (indice + 1)} value={franja.inicio} onChange={e => actualizarDia(dia, h => ({ ...h, franjas: h.franjas.map((f, i) => i === indice ? { ...f, inicio: e.target.value } : f) }))} /></label><label className="vendedor-campo"><span>Hasta</span><input type="time" required aria-label={DIAS_RECOGIDA[dia] + ', fin de franja ' + (indice + 1)} value={franja.fin} onChange={e => actualizarDia(dia, h => ({ ...h, franjas: h.franjas.map((f, i) => i === indice ? { ...f, fin: e.target.value } : f) }))} /></label>{horario.franjas.length > 1 && <button type="button" className="vendedor-btn-icono" aria-label={'Eliminar franja ' + (indice + 1) + ' del ' + DIAS_RECOGIDA[dia]} onClick={() => actualizarDia(dia, h => ({ ...h, franjas: h.franjas.filter((_, i) => i !== indice) }))}><IconoVendedor nombre="papelera" tamano={16} /></button>}</div>)}<button type="button" className="vendedor-link" disabled={horario.franjas.length >= 4} onClick={() => actualizarDia(dia, h => ({ ...h, franjas: [...h.franjas, { inicio: '', fin: '' }] }))}><IconoVendedor nombre="plus" tamano={14} />Añadir franja</button></>}
            </div>)}</div>}
            <small className="vendedor-ayuda-campo">Si el cierre es anterior a la apertura, la franja termina al día siguiente.</small>
          </section>
          <div className="vendedor-form-acciones"><span>Todo listo para tus clientes.</span><button type="button" className="vendedor-btn vendedor-btn-secundario" onClick={onCancelar}>Cancelar</button><button type="submit" className="vendedor-btn vendedor-btn-primario" aria-busy={loading}>{loading ? <IconoEstado tipo="cargando" tamano={18} /> : <IconoVendedor nombre="guardar" tamano={18} />}{loading ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Registrar local'}</button></div>
        </div>
        <aside className="vendedor-preview" aria-label="Vista previa del local"><p className="vendedor-preview-titulo"><IconoVendedor nombre="imagen" tamano={16} />Así se presenta tu local</p><article className="vendedor-local-card"><div className="vendedor-local-portada">{formData.imagen_url ? <img src={formData.imagen_url} alt="Vista previa de la portada" /> : <div className="vendedor-local-sin-foto"><IconoVendedor nombre="local" tamano={48} /></div>}</div><div className="vendedor-local-body"><EtiquetasLocal tipo={formData.tipo.join(", ")} /><h2>{formData.nombre || 'El nombre de tu local'}</h2><div className="vendedor-preview-datos"><p><IconoVendedor nombre="mapa" tamano={16} /><span>{formData.direccion || 'Tu dirección, aquí'}</span></p><p><IconoVendedor nombre="telefono" tamano={16} /><span>{formData.telefono || 'Tu teléfono de contacto'}</span></p><p><IconoVendedor nombre="radio" tamano={16} /><span>{radioSeleccion === 'otro' ? radioPersonalizado || '—' : radioSeleccion} km de reparto</span></p></div></div></article><p className="vendedor-preview-nota">Una buena foto y los datos al día ayudan a que tus clientes te encuentren y elijan.</p></aside>
      </div>
      </fieldset>
    </form>
  </>;
}
