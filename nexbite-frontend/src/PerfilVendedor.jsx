import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import MensajeAccion, { IconoEstado } from './MensajeAccion';
import { TituloVendedor, IconoVendedor, CargandoVendedor, ErrorVendedor } from './VendedorUI';

const OBTENER_PERFIL = gql`query ObtenerPerfilVendedor($id_usuario: ID!) { obtenerPerfilUsuario(id_usuario: $id_usuario) { id_usuario nombre email telefono direccion } }`;
const ACTUALIZAR_PERFIL = gql`mutation ActualizarPerfilVendedor($id_usuario: ID!, $telefono: String, $direccion: String) { actualizarPerfilUsuario(id_usuario: $id_usuario, telefono: $telefono, direccion: $direccion) { id_usuario telefono direccion } }`;

function DatosPerfilVendedor({ perfil }) {
  const [telefono, setTelefono] = useState(perfil.telefono || '');
  const [direccion, setDireccion] = useState(perfil.direccion || '');
  const [mensaje, setMensaje] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [buscar, setBuscar] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const guardandoRef = useRef(false);
  const [actualizar, { loading }] = useMutation(ACTUALIZAR_PERFIL);

  useEffect(() => {
    if (mensaje?.tipo !== 'exito') return;
    const timer = setTimeout(() => setMensaje(null), 5000);
    return () => clearTimeout(timer);
  }, [mensaje]);
  useEffect(() => {
    if (!buscar || direccion.trim().length < 4) return;
    const controlador = new AbortController();
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const respuesta = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(direccion), { signal: controlador.signal });
        if (!respuesta.ok) throw new Error('Búsqueda no disponible');
        const datos = await respuesta.json();
        if (!controlador.signal.aborted) setSugerencias(datos);
      } catch { if (!controlador.signal.aborted) setSugerencias([]); }
      finally { if (!controlador.signal.aborted) setBuscando(false); }
    }, 600);
    return () => { clearTimeout(timer); controlador.abort(); };
  }, [direccion, buscar]);

  const guardar = async e => {
    e.preventDefault();
    if (guardandoRef.current) return;
    guardandoRef.current = true; setMensaje(null); setSugerencias([]);
    try {
      const resultado = await actualizar({ variables: { id_usuario: perfil.id_usuario, telefono: telefono.trim(), direccion: direccion.trim() } });
      if (!resultado.data?.actualizarPerfilUsuario) throw new Error('Sin confirmación');
      setMensaje({ tipo: 'exito', titulo: '¡Cambios guardados!', descripcion: 'Tus datos de contacto ya están actualizados.' });
    } catch { setMensaje({ tipo: 'error', titulo: 'No se pudieron guardar los cambios', descripcion: 'Comprueba la conexión y vuelve a intentarlo. Los datos que has escrito siguen aquí.' }); }
    finally { guardandoRef.current = false; }
  };

  return <section className="vendedor-panel">
    <div className="vendedor-perfil-identidad"><span className="vendedor-avatar">{perfil.nombre?.charAt(0).toUpperCase() || <IconoVendedor nombre="perfil" tamano={30} />}</span><div><h2>{perfil.nombre}</h2><p>{perfil.email}</p></div></div>
    <form onSubmit={guardar}><fieldset disabled={loading} className="vendedor-perfil-campos">
      <label className="vendedor-campo"><span>Correo electrónico</span><input type="email" aria-label="Correo electrónico" value={perfil.email || ''} readOnly /><small className="vendedor-ayuda-campo">Es el correo asociado a tu cuenta.</small></label>
      <label className="vendedor-campo"><span>Teléfono de contacto</span><input type="tel" autoComplete="tel" value={telefono} onChange={e => { setTelefono(e.target.value); setMensaje(null); }} placeholder="Tu número de teléfono" /></label>
      <div className="vendedor-direccion"><label className="vendedor-campo"><span>Dirección de contacto</span><input autoComplete="street-address" value={direccion} onChange={e => { setDireccion(e.target.value); setBuscar(true); setSugerencias([]); setBuscando(false); setMensaje(null); }} placeholder="Añade una dirección" /></label>{buscando && <small className="vendedor-ayuda-campo" role="status">Buscando direcciones...</small>}{sugerencias.length > 0 && <ul className="vendedor-sugerencias" aria-label="Direcciones de contacto sugeridas">{sugerencias.map((lugar, i) => <li key={lugar.place_id || i}><button type="button" onClick={() => { setDireccion(lugar.display_name); setBuscar(false); setBuscando(false); setSugerencias([]); }}><IconoVendedor nombre="mapa" tamano={16} /><span>{lugar.display_name}</span></button></li>)}</ul>}</div>
      <button type="submit" className="vendedor-btn vendedor-btn-azul" aria-busy={loading}>{loading || mensaje?.tipo === 'exito' ? <IconoEstado tipo={loading ? 'cargando' : 'exito'} tamano={20} /> : <IconoVendedor nombre="guardar" />}{loading ? 'Guardando...' : mensaje?.tipo === 'exito' ? 'Cambios guardados' : 'Guardar cambios'}</button>
    </fieldset></form><div style={{ marginTop: mensaje ? 22 : 0 }}><MensajeAccion mensaje={mensaje} onCerrar={() => setMensaje(null)} /></div>
  </section>;
}

export default function PerfilVendedor({ idUsuario, onVerLocales }) {
  const { data, loading, error, refetch } = useQuery(OBTENER_PERFIL, { variables: { id_usuario: idUsuario }, skip: !idUsuario, fetchPolicy: 'network-only' });
  const perfil = data?.obtenerPerfilUsuario;
  return <>
    <TituloVendedor titulo="Mi perfil" contexto="Tu cuenta NexBite" descripcion="Tus datos de contacto, siempre al día." />
    {loading ? <CargandoVendedor texto="Cargando tu perfil..." /> : error || !perfil ? <ErrorVendedor descripcion="No hemos podido recuperar tu perfil. Vuelve a intentarlo." onReintentar={() => refetch().catch(() => null)} /> : <div className="vendedor-perfil-layout"><DatosPerfilVendedor key={perfil.id_usuario} perfil={perfil} /><aside className="vendedor-panel vendedor-perfil-nota"><span><IconoVendedor nombre="escudo" tamano={28} /></span><h2>Todo empieza con una buena conexión.</h2><p>Mantén tu teléfono y dirección de contacto actualizados para que tu cuenta tenga la información correcta.</p><hr /><p>La dirección, las fotos y los horarios de cada negocio se editan desde «Mis locales».</p><button type="button" className="vendedor-btn" onClick={onVerLocales}>Ir a mis locales<IconoVendedor nombre="flecha" tamano={16} /></button></aside></div>}
  </>;
}
