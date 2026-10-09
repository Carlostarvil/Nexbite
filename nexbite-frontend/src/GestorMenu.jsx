import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import { nombreCategoria } from './categoriasPlatos';
import EstadoDisponibilidad from './EstadoDisponibilidad';
import ImagenPlato from './ImagenPlato';
import MensajeAccion, { IconoEstado } from './MensajeAccion';
import { IconoVendedor, TituloVendedor, MetricasVendedor, VacioVendedor, CargandoVendedor, ErrorVendedor, DialogoVendedor } from './VendedorUI';
import { precioVendedor } from './vendedorUtils';

const CREAR_PLATO = gql`mutation CrearPlato($id_restaurante: ID!, $nombre: String!, $descripcion: String!, $precio: Float!, $categoria: [String]!, $imagen_url: String, $platos_existentes: [ID!]) {
  crearPlato(id_restaurante: $id_restaurante, nombre: $nombre, descripcion: $descripcion, precio: $precio, categoria: $categoria, imagen_url: $imagen_url, platos_existentes: $platos_existentes) { id_plato }
}`;
const ACTUALIZAR_PLATO = gql`mutation ActualizarPlato($id_plato: ID!, $id_restaurante: ID!, $nombre: String!, $descripcion: String!, $precio: Float!, $categoria: [String]!, $imagen_url: String, $platos_existentes: [ID!]) {
  actualizarPlato(id_plato: $id_plato, id_restaurante: $id_restaurante, nombre: $nombre, descripcion: $descripcion, precio: $precio, categoria: $categoria, imagen_url: $imagen_url, platos_existentes: $platos_existentes) { id_plato }
}`;
const ELIMINAR_PLATO = gql`mutation EliminarPlato($id: ID!) { eliminarPlato(id_plato: $id) }`;
const OBTENER_MENU = gql`query ObtenerMenu($id: ID!) { obtenerMenuRestaurante(id_restaurante: $id) { id_plato nombre descripcion precio categoria imagen_url disponible tiempo_disponible items_menu { id_plato nombre imagen_url } } }`;
const MARCAR_AGOTADO = gql`mutation MarcarPlatoAgotado($id_plato: ID!, $disponible: Boolean!, $tiempo: String) { marcarPlatoAgotado(id_plato: $id_plato, disponible: $disponible, tiempo: $tiempo) { id_plato disponible tiempo_disponible } }`;
const CATEGORIAS = ['ENTRANTE', 'COMPARTIR', 'PLATO', 'BEBIDA', 'POSTRE', 'OFERTA', 'MENU'];
const ICONOS = { ENTRANTE: 'plato', COMPARTIR: 'plato', PLATO: 'plato', BEBIDA: 'bebida', POSTRE: 'postre', OFERTA: 'etiqueta', MENU: 'menu' };
const datosVacios = () => ({ nombre: '', descripcion: '', precio: '', precioAnterior: '', categoria: ['ENTRANTE'], imagen_url: '' });
const parseCategorias = dato => (Array.isArray(dato) ? dato : [dato]).flatMap(c => String(c || '').replace(/[{}"[\]\\]/g, '').split(',')).map(c => c.trim().toUpperCase()).filter(Boolean);
function extraerTags(descripcion, categorias) {
  let limpia = descripcion || '';
  const anterior = limpia.match(/\|ANTES:\s*([\d.,]+)/i);
  if (anterior) limpia = limpia.replace(anterior[0], '').trim();
  const partes = limpia.split(/\s*\|TAGS:/i);
  return { descLimpia: partes[0].trim(), tagsTotales: [...new Set([...parseCategorias(categorias), ...parseCategorias(partes[1])])], precioAnterior: anterior ? Number(anterior[1].replace(',', '.')) : null };
}
function EtiquetasProducto({ categorias }) {
  return <div className="vendedor-tags">{categorias.map(cat => <span key={cat} className={'vendedor-tag' + (cat === 'OFERTA' ? ' vendedor-tag-oferta' : cat === 'MENU' ? ' vendedor-tag-menu' : '')}>{nombreCategoria(cat)}</span>)}</div>;
}
function TarjetaProducto({ plato, ocupado, onEditar, onPausar, onActivar, onEliminar }) {
  const { descLimpia, tagsTotales, precioAnterior } = extraerTags(plato.descripcion, plato.categoria);
  return <article className="vendedor-producto" aria-label={plato.nombre}>
    <div className="vendedor-producto-foto"><ImagenPlato plato={plato} /><button type="button" className="vendedor-btn-icono vendedor-producto-editar" aria-label={'Editar ' + plato.nombre} title="Editar producto" onClick={() => onEditar(plato)} disabled={ocupado}><IconoVendedor nombre="editar" tamano={17} /></button></div>
    <div className="vendedor-producto-body"><EtiquetasProducto categorias={tagsTotales} /><h2>{plato.nombre}</h2><p className="vendedor-producto-descripcion">{descLimpia}</p><div className="vendedor-producto-precio"><strong>{precioVendedor(plato.precio)}</strong>{precioAnterior > 0 && tagsTotales.includes('OFERTA') && <del>{precioVendedor(precioAnterior)}</del>}</div>
      {plato.disponible === false ? <EstadoDisponibilidad fecha={plato.tiempo_disponible} /> : <p className="vendedor-producto-estado"><span aria-hidden="true" />Disponible en tu carta</p>}
      <div className="vendedor-producto-acciones"><button type="button" className={'vendedor-btn ' + (plato.disponible === false ? 'vendedor-btn-oscuro' : 'vendedor-btn-secundario')} disabled={ocupado} onClick={() => plato.disponible === false ? onActivar(plato) : onPausar(plato)} aria-label={(plato.disponible === false ? 'Activar ' : 'Pausar ') + plato.nombre}>{ocupado ? <IconoEstado tipo="cargando" tamano={16} /> : <IconoVendedor nombre={plato.disponible === false ? 'play' : 'pausa'} tamano={16} />}{plato.disponible === false ? 'Volver a activar' : 'Pausar producto'}</button><button type="button" className="vendedor-btn-icono vendedor-btn-icono-peligro" disabled={ocupado} onClick={() => onEliminar(plato)} aria-label={'Eliminar ' + plato.nombre} title="Eliminar producto"><IconoVendedor nombre="papelera" tamano={17} /></button></div>
    </div>
  </article>;
}

export default function GestorMenu({ idRestaurante, nombreRestaurante }) {
  const [formData, setFormData] = useState(datosVacios);
  const [idEdicion, setIdEdicion] = useState(null);
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [platosSeleccionados, setPlatosSeleccionados] = useState([]);
  const [inputValueTag, setInputValueTag] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('TODOS');
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');
  const [mensaje, setMensaje] = useState(null);
  const [errorFormulario, setErrorFormulario] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [errorDialogo, setErrorDialogo] = useState(null);
  const [tiempoPausa, setTiempoPausa] = useState('1 hora');
  const [accionOcupada, setAccionOcupada] = useState(null);
  const [leyendoImagen, setLeyendoImagen] = useState(false);
  const fileInputRef = useRef(null);
  const errorRef = useRef(null);
  const guardandoRef = useRef(false);
  const accionRef = useRef(false);
  const { data, loading, error, refetch } = useQuery(OBTENER_MENU, { variables: { id: idRestaurante }, fetchPolicy: 'network-only', notifyOnNetworkStatusChange: true });
  const [crearPlato, { loading: creando }] = useMutation(CREAR_PLATO);
  const [actualizarPlato, { loading: actualizando }] = useMutation(ACTUALIZAR_PLATO);
  const [eliminarPlato] = useMutation(ELIMINAR_PLATO);
  const [marcarAgotado] = useMutation(MARCAR_AGOTADO);
  const guardando = creando || actualizando;
  const platos = data?.obtenerMenuRestaurante || [];
  const esMenu = formData.categoria.includes('MENU');
  const esOferta = formData.categoria.includes('OFERTA');
  const platosDelMenu = platosSeleccionados.map(id => platos.find(p => String(p.id_plato) === String(id))).filter(Boolean);
  const elegibles = platos.filter(p => String(p.id_plato) !== String(idEdicion) && !extraerTags(p.descripcion, p.categoria).tagsTotales.includes('MENU'));
  const vistaPrevia = { ...formData, items_menu: esMenu ? platosDelMenu : [] };
  const visibles = platos.filter(p => (filtro === 'TODOS' || (filtro === 'DISPONIBLES' ? p.disponible !== false : p.disponible === false)) && (categoriaFiltro === 'TODAS' || extraerTags(p.descripcion, p.categoria).tagsTotales.includes(categoriaFiltro)) && (p.nombre + ' ' + extraerTags(p.descripcion, p.categoria).descLimpia).toLocaleLowerCase('es-ES').includes(busqueda.toLocaleLowerCase('es-ES')));
  const disponibles = platos.filter(p => p.disponible !== false).length;

  const mostrarError = descripcion => {
    setErrorFormulario({ tipo: 'error', titulo: 'Revisa tu producto', descripcion });
    requestAnimationFrame(() => { errorRef.current?.focus(); errorRef.current?.scrollIntoView({ block: 'center' }); });
  };
  const cambiar = (campo, valor) => { setFormData(prev => ({ ...prev, [campo]: valor })); setErrorFormulario(null); };
  const limpiarFormulario = () => { setFormData(datosVacios()); setIdEdicion(null); setPlatosSeleccionados([]); setInputValueTag(''); setErrorFormulario(null); if (fileInputRef.current) fileInputRef.current.value = ''; };
  const abrirFormulario = plato => {
    limpiarFormulario(); setMensaje(null);
    if (plato) {
      const { descLimpia, tagsTotales, precioAnterior } = extraerTags(plato.descripcion, plato.categoria);
      setIdEdicion(plato.id_plato);
      setFormData({ nombre: plato.nombre, descripcion: descLimpia, precio: String(plato.precio), precioAnterior: precioAnterior ? String(precioAnterior) : '', categoria: tagsTotales, imagen_url: plato.imagen_url || '' });
      setPlatosSeleccionados((plato.items_menu || []).map(p => String(p.id_plato)));
    }
    setFormularioVisible(true); window.scrollTo(0, 0);
    requestAnimationFrame(() => document.querySelector('.vendedor-titulo')?.focus({ preventScroll: true }));
  };
  const cerrarFormulario = () => { if (guardando || leyendoImagen) return; setFormularioVisible(false); limpiarFormulario(); window.scrollTo(0, 0); };
  const refrescar = () => refetch().catch(() => setMensaje({ tipo: 'aviso', titulo: 'El cambio se ha guardado', descripcion: 'No hemos podido actualizar la carta. Pulsa «Volver a intentar» para ver los datos actuales.' }));
  const toggleCategoria = cat => {
    if (cat === 'MENU') { cambiar('categoria', esMenu ? [] : ['MENU']); setPlatosSeleccionados([]); return; }
    const actual = cat === 'OFERTA' && esMenu ? formData.categoria : formData.categoria.filter(c => c !== 'MENU');
    cambiar('categoria', actual.includes(cat) ? actual.filter(c => c !== cat) : [...actual, cat]);
  };
  const procesarEtiqueta = () => {
    const etiqueta = inputValueTag.trim().toUpperCase();
    if (etiqueta && !formData.categoria.includes(etiqueta)) cambiar('categoria', [...formData.categoria, etiqueta]);
    setInputValueTag('');
  };
  const seleccionarPlato = id => {
    const ids = platosSeleccionados.includes(String(id)) ? platosSeleccionados.filter(p => p !== String(id)) : [...platosSeleccionados, String(id)];
    const incluidos = ids.map(p => platos.find(item => String(item.id_plato) === p)).filter(Boolean);
    const suma = incluidos.reduce((total, p) => total + Number(p.precio || 0), 0);
    setPlatosSeleccionados(ids);
    setFormData(prev => ({ ...prev, descripcion: incluidos.length ? 'Incluye: ' + incluidos.map(p => p.nombre).join(', ') : '', precio: incluidos.length ? (suma * .85).toFixed(2) : '', precioAnterior: incluidos.length ? suma.toFixed(2) : '' }));
    setErrorFormulario(null);
  };
  const handleImageChange = e => {
    const entrada = e.target, archivo = entrada.files[0];
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) { entrada.value = ''; return mostrarError('Selecciona una imagen JPG, PNG, WEBP o GIF.'); }
    setLeyendoImagen(true);
    const fallo = texto => { setLeyendoImagen(false); entrada.value = ''; mostrarError(texto); };
    const lector = new FileReader();
    lector.onerror = () => fallo('No se pudo leer la imagen. Selecciona otra foto.');
    lector.onload = () => {
      const imagen = new Image();
      imagen.onerror = () => fallo('No se puede abrir este archivo como imagen.');
      imagen.onload = () => {
        if (imagen.width < 400 || imagen.height < 400) return fallo('La imagen debe tener al menos 400 × 400 píxeles para verse bien.');
        cambiar('imagen_url', lector.result); setLeyendoImagen(false);
      };
      imagen.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  };
  const handleSubmit = async e => {
    e.preventDefault();
    if (guardandoRef.current || leyendoImagen) return;
    setErrorFormulario(null);
    const categorias = [...new Set([...formData.categoria, ...(inputValueTag.trim() ? [inputValueTag.trim().toUpperCase()] : [])])];
    if (!formData.nombre.trim() || !formData.descripcion.trim()) return mostrarError('Completa el nombre y la descripción.');
    if (!categorias.length) return mostrarError('Selecciona al menos una categoría.');
    if (categorias.includes('MENU') && !platosSeleccionados.length) return mostrarError('Selecciona los productos que incluye el menú.');
    const precio = Number(formData.precio);
    if (formData.precio === '' || !Number.isFinite(precio) || precio < 0) return mostrarError('Añade un precio válido, igual o mayor que cero.');
    const anterior = Number(formData.precioAnterior);
    if (categorias.includes('OFERTA') && formData.precioAnterior && (!Number.isFinite(anterior) || anterior <= precio)) return mostrarError('El precio inicial de una oferta debe ser mayor que el precio final.');
    const base = categorias.filter(c => CATEGORIAS.includes(c)), extra = categorias.filter(c => !CATEGORIAS.includes(c));
    let descripcion = formData.descripcion.trim();
    if (categorias.includes('OFERTA') && anterior > 0) descripcion += ' |ANTES: ' + formData.precioAnterior;
    if (extra.length) descripcion += ' |TAGS:' + extra.join(',');
    const variables = { id_restaurante: idRestaurante, nombre: formData.nombre.trim(), descripcion, precio, categoria: base.length ? base : ['PLATO'], imagen_url: formData.imagen_url, platos_existentes: categorias.includes('MENU') ? platosSeleccionados : [] };
    guardandoRef.current = true;
    try {
      const resultado = idEdicion ? await actualizarPlato({ variables: { ...variables, id_plato: idEdicion } }) : await crearPlato({ variables });
      if (!resultado.data?.[idEdicion ? 'actualizarPlato' : 'crearPlato']?.id_plato) throw new Error('No se ha podido confirmar el guardado. Vuelve a intentarlo.');
      setMensaje({ tipo: 'exito', titulo: idEdicion ? 'Producto actualizado' : 'Tu producto ya está en la carta', descripcion: formData.nombre + ' se ha guardado correctamente.' });
      setFormularioVisible(false); limpiarFormulario(); window.scrollTo(0, 0); refrescar();
    } catch (err) { mostrarError(err.message); }
    finally { guardandoRef.current = false; }
  };
  const abrirDialogo = (tipo, plato) => { setDialogo({ tipo, plato }); setErrorDialogo(null); setTiempoPausa('1 hora'); };
  const cerrarDialogo = () => { if (accionRef.current) return; setDialogo(null); setErrorDialogo(null); };
  const cambiarDisponibilidad = async (plato, disponible) => {
    if (accionRef.current) return;
    accionRef.current = true; setAccionOcupada(plato.id_plato); setErrorDialogo(null);
    try {
      const resultado = await marcarAgotado({ variables: { id_plato: plato.id_plato, disponible, tiempo: disponible ? null : tiempoPausa } });
      if (!resultado.data?.marcarPlatoAgotado) throw new Error('No se pudo confirmar el cambio.');
      setDialogo(null);
      setMensaje({ tipo: 'exito', titulo: disponible ? 'Producto disponible de nuevo' : 'Disponibilidad actualizada', descripcion: disponible ? plato.nombre + ' vuelve a estar disponible.' : plato.nombre + ' se mostrará como no disponible a tus clientes.' });
      await refrescar();
    } catch (err) {
      const aviso = { tipo: 'error', titulo: 'No se pudo actualizar el producto', descripcion: err.message };
      if (disponible) setMensaje(aviso); else setErrorDialogo(aviso);
    } finally { accionRef.current = false; setAccionOcupada(null); }
  };
  const confirmarEliminar = async () => {
    if (accionRef.current) return;
    accionRef.current = true; setAccionOcupada(dialogo.plato.id_plato); setErrorDialogo(null);
    try {
      const resultado = await eliminarPlato({ variables: { id: dialogo.plato.id_plato } });
      if (!resultado.data?.eliminarPlato) throw new Error('No se pudo confirmar la eliminación.');
      setMensaje({ tipo: 'exito', titulo: 'Producto retirado de la carta', descripcion: dialogo.plato.nombre + ' se ha eliminado.' }); setDialogo(null); await refrescar();
    } catch (err) { setErrorDialogo({ tipo: 'error', titulo: 'No se pudo eliminar el producto', descripcion: err.message }); }
    finally { accionRef.current = false; setAccionOcupada(null); }
  };

  return <>
    {formularioVisible && <button type="button" className="vendedor-atras" disabled={guardando || leyendoImagen} onClick={cerrarFormulario}><IconoVendedor nombre="volver" />Volver a la carta</button>}
    <TituloVendedor titulo={formularioVisible ? idEdicion ? 'Editar producto' : 'Un nuevo favorito' : 'Menú y productos'} contexto={nombreRestaurante} descripcion={formularioVisible ? 'Haz que tus clientes lo elijan antes de probarlo.' : 'Una carta cuidada. Productos que entran por los ojos.'} acciones={!formularioVisible && <button type="button" className="vendedor-btn vendedor-btn-primario" onClick={() => abrirFormulario()}><IconoVendedor nombre="plus" />Añadir producto</button>} />
    {!formularioVisible && <MensajeAccion mensaje={mensaje} onCerrar={() => setMensaje(null)} />}
    {loading && !data ? <CargandoVendedor texto="Cargando tu carta..." /> : error ? <ErrorVendedor descripcion="No hemos podido cargar los productos del local. Comprueba la conexión y vuelve a intentarlo." onReintentar={() => refetch().catch(() => null)} /> : formularioVisible ? <>
      <div className="vendedor-form-mensaje" ref={errorRef} tabIndex={-1}><MensajeAccion mensaje={errorFormulario} onCerrar={() => setErrorFormulario(null)} /></div>
      <form onSubmit={handleSubmit} noValidate><fieldset disabled={guardando || leyendoImagen}><div className="vendedor-form-layout">
        <div className="vendedor-form-principal">
          <section className="vendedor-panel"><div className="vendedor-panel-titulo"><span><IconoVendedor nombre="plato" /></span><div><h2>Cuéntanos qué preparas</h2><p>Un nombre claro y una descripción que abra el apetito.</p></div></div><div className="vendedor-form-grid">
            <label className="vendedor-campo vendedor-form-fila-completa"><span>Nombre del plato o producto</span><input required placeholder="Nombre del plato" value={formData.nombre} onChange={e => cambiar('nombre', e.target.value)} /></label>
            <label className="vendedor-campo vendedor-form-fila-completa"><span>Descripción</span><textarea aria-label="Descripción" required placeholder="Descripción (Ingredientes, tamaño...)" value={formData.descripcion} onChange={e => cambiar('descripcion', e.target.value)} /></label>
            <label className="vendedor-campo"><span>Precio final (€)</span><input type="number" min="0" step=".01" required placeholder="Ej: 8.50" value={formData.precio} onChange={e => cambiar('precio', e.target.value)} /></label>
            {(esMenu || esOferta) && <label className="vendedor-campo"><span>Precio inicial</span><input type="number" min="0" step=".01" placeholder="Ej: 10.00" value={formData.precioAnterior} onChange={e => cambiar('precioAnterior', e.target.value)} /></label>}
          </div></section>
          <section className="vendedor-panel"><div className="vendedor-panel-titulo"><span><IconoVendedor nombre="etiqueta" /></span><div><h2>Encuentra su lugar</h2><p>Organiza la carta con categorías y etiquetas.</p></div></div><fieldset><legend className="vendedor-label">Categorías</legend><div className="vendedor-opciones">{CATEGORIAS.filter(cat => !esMenu || cat !== 'OFERTA').map(cat => <label key={cat} className="vendedor-opcion"><input type="checkbox" checked={formData.categoria.includes(cat)} onChange={() => toggleCategoria(cat)} /><IconoVendedor nombre={ICONOS[cat]} tamano={16} />{nombreCategoria(cat)}</label>)}</div></fieldset>
            <label htmlFor="vendedor-etiquetas-producto" className="vendedor-campo" style={{ marginTop: 24 }}><span>Etiquetas personalizadas</span></label><div className="vendedor-etiquetas-extra">{formData.categoria.filter(cat => !CATEGORIAS.includes(cat)).map(cat => <span key={cat}>{cat}<button type="button" onClick={() => cambiar('categoria', formData.categoria.filter(c => c !== cat))} aria-label={'Eliminar etiqueta ' + cat}><IconoVendedor nombre="cerrar" tamano={13} /></button></span>)}</div><input id="vendedor-etiquetas-producto" aria-label="Etiquetas personalizadas" placeholder="Escribe y pulsa Enter (ej. Vegano...)" value={inputValueTag} onChange={e => setInputValueTag(e.target.value)} onBlur={procesarEtiqueta} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); procesarEtiqueta(); } }} /><small className="vendedor-ayuda-campo">Añade detalles como vegano, sin gluten o especial de la casa.</small>
          </section>
          {esMenu && <section className="vendedor-panel"><div className="vendedor-panel-titulo"><span><IconoVendedor nombre="menu" /></span><div><h2>Un menú a tu medida</h2><p>Elige productos de tu carta. Sus fotos se añadirán automáticamente.</p></div></div><p className="vendedor-ayuda-campo">Al seleccionar productos, se calcula el precio con un 15 % de descuento. Puedes ajustarlo después.</p><div className="vendedor-menu-seleccion">{elegibles.length ? elegibles.map(p => <label key={p.id_plato}><input type="checkbox" aria-label={p.nombre} checked={platosSeleccionados.includes(String(p.id_plato))} onChange={() => seleccionarPlato(p.id_plato)} /><ImagenPlato plato={p} /><span>{p.nombre}<small>{p.disponible === false ? 'No disponible ahora' : 'Producto de tu carta'}</small></span><strong>{precioVendedor(p.precio)}</strong></label>) : <p className="vendedor-ayuda-campo">Crea primero productos individuales para poder combinarlos en un menú.</p>}</div>
            <section className="vendedor-oferta"><div><IconoVendedor nombre="etiqueta" tamano={23} /><h3>¿Lo destacamos como oferta?</h3></div><p>El descuento se calcula automáticamente. Tú decides si aparece también en «Ofertas especiales».</p><label><input type="checkbox" role="switch" aria-label="Añadir este menú a ofertas" aria-checked={esOferta} checked={esOferta} onChange={() => toggleCategoria('OFERTA')} /><span>Añadir este menú a ofertas</span></label><small role="status">{esOferta ? 'Se mostrará en MENÚ y en Ofertas especiales.' : 'Se publicará en MENÚ, sin marcarlo como oferta.'}</small></section>
          </section>}
          <section className="vendedor-panel"><div className="vendedor-panel-titulo"><span><IconoVendedor nombre="imagen" /></span><div><h2>Su mejor cara</h2><p>{esMenu ? 'Conserva las fotos de los productos o añade una portada propia.' : 'Una foto apetecible marca la diferencia.'}</p></div></div><div className="vendedor-carga-imagen"><div className="vendedor-carga-imagen-cabecera"><IconoVendedor nombre="subir" tamano={27} /><div><strong>{formData.imagen_url ? 'Cambiar foto' : 'Añadir una foto'}</strong><p>JPG, PNG, WEBP o GIF · mínimo 400 × 400 px.</p></div></div><input type="file" aria-label="Imagen del producto" accept="image/jpeg,image/png,image/webp,image/gif" ref={fileInputRef} onChange={handleImageChange} />{leyendoImagen && <span role="status">Preparando tu imagen...</span>}</div></section>
          <div className="vendedor-form-acciones"><span>{idEdicion ? 'Actualiza el producto cuando esté listo.' : 'Listo para formar parte de tu carta.'}</span><button type="button" className="vendedor-btn vendedor-btn-secundario" onClick={cerrarFormulario}>Cancelar</button><button type="submit" className="vendedor-btn vendedor-btn-primario" aria-busy={guardando}>{guardando ? <IconoEstado tipo="cargando" tamano={18} /> : <IconoVendedor nombre="guardar" tamano={18} />}{guardando ? 'Guardando...' : idEdicion ? 'Guardar cambios' : 'Guardar producto'}</button></div>
        </div>
        <aside className="vendedor-preview" aria-label="Vista previa del producto"><p className="vendedor-preview-titulo"><IconoVendedor nombre="imagen" tamano={16} />Así lo verán tus clientes</p><article className="vendedor-producto vendedor-preview-producto"><ImagenPlato plato={vistaPrevia} loading="eager" /><div className="vendedor-producto-body"><EtiquetasProducto categorias={formData.categoria} /><h2>{formData.nombre || 'Tu próximo favorito'}</h2><p>{formData.descripcion || 'La descripción de tu producto aparecerá aquí.'}</p><div className="vendedor-producto-precio"><strong>{precioVendedor(formData.precio)}</strong>{esOferta && Number(formData.precioAnterior) > 0 && <del>{precioVendedor(formData.precioAnterior)}</del>}</div></div></article><p className="vendedor-preview-nota">{esMenu ? 'Las fotografías de los productos incluidos se conservan también cuando tus clientes abren el menú.' : 'Puedes editar este producto siempre que quieras.'}</p></aside>
      </div></fieldset></form>
    </> : <>
      <MetricasVendedor items={[{ etiqueta: 'Productos en carta', valor: platos.length, icono: 'menu' }, { etiqueta: 'Disponibles', valor: disponibles, icono: 'check', tono: 'verde' }, { etiqueta: 'No disponibles', valor: platos.length - disponibles, icono: 'pausa', tono: 'ambar' }]} />
      {platos.length === 0 ? <VacioVendedor icono="plato" titulo="Aquí empieza una buena carta" descripcion="Añade tu primer producto con una foto, un precio y todo lo que lo hace especial." accion={<button type="button" className="vendedor-btn vendedor-btn-oscuro" onClick={() => abrirFormulario()}><IconoVendedor nombre="plus" />Crear mi primer producto</button>} /> : <>
        <div className="vendedor-toolbar"><div className="vendedor-busqueda"><IconoVendedor nombre="buscar" /><input aria-label="Buscar productos de mi carta" placeholder="Busca un plato o producto" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div><div className="vendedor-filtros" role="group" aria-label="Filtrar disponibilidad">{[['TODOS', 'Todos'], ['DISPONIBLES', 'Disponibles'], ['PAUSADOS', 'No disponibles']].map(([valor, titulo]) => <button type="button" key={valor} aria-pressed={valor === filtro} onClick={() => setFiltro(valor)}>{titulo}</button>)}</div><select aria-label="Filtrar categoría de productos" value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} style={{ width: 'auto', maxWidth: '100%' }}><option value="TODAS">Todas las categorías</option>{[...new Set(platos.flatMap(p => extraerTags(p.descripcion, p.categoria).tagsTotales))].map(cat => <option key={cat} value={cat}>{nombreCategoria(cat)}</option>)}</select></div>
        {visibles.length ? <div className="vendedor-menu-grid">{visibles.map(p => <TarjetaProducto key={p.id_plato} plato={p} ocupado={accionOcupada != null} onEditar={abrirFormulario} onPausar={plato => abrirDialogo('pausa', plato)} onActivar={plato => cambiarDisponibilidad(plato, true)} onEliminar={plato => abrirDialogo('eliminar', plato)} />)}</div> : <VacioVendedor icono="buscar" titulo="No hay productos con estos filtros" descripcion="Prueba con otra categoría o busca por su nombre." accion={<button type="button" className="vendedor-btn vendedor-btn-secundario" onClick={() => { setBusqueda(''); setFiltro('TODOS'); setCategoriaFiltro('TODAS'); }}>Mostrar toda la carta</button>} />}
      </>}
    </>}
    {dialogo && <DialogoVendedor titulo={dialogo.tipo === 'pausa' ? 'Una pausa para este producto' : '¿Retirar este producto?'} descripcion={dialogo.tipo === 'pausa' ? dialogo.plato.nombre + ' aparecerá como no disponible durante el tiempo que elijas.' : 'Vas a eliminar «' + dialogo.plato.nombre + '» de tu carta. Esta acción no se puede deshacer.'} icono={dialogo.tipo === 'pausa' ? 'pausa' : 'papelera'} ocupado={accionOcupada != null} onCerrar={cerrarDialogo} mensaje={errorDialogo} acciones={<><button type="button" className="vendedor-btn vendedor-btn-secundario" onClick={cerrarDialogo} disabled={accionOcupada != null}>Volver</button><button type="button" className={'vendedor-btn ' + (dialogo.tipo === 'pausa' ? 'vendedor-btn-primario' : 'vendedor-btn-peligro')} onClick={() => dialogo.tipo === 'pausa' ? cambiarDisponibilidad(dialogo.plato, false) : confirmarEliminar()} disabled={accionOcupada != null}>{accionOcupada != null && <IconoEstado tipo="cargando" tamano={18} />}{accionOcupada != null ? 'Guardando...' : dialogo.tipo === 'pausa' ? 'Pausar producto' : 'Eliminar producto'}</button></>}>{dialogo.tipo === 'pausa' && <label className="vendedor-campo"><span>¿Durante cuánto tiempo?</span><select aria-label="¿Durante cuánto tiempo?" value={tiempoPausa} disabled={accionOcupada != null} onChange={e => setTiempoPausa(e.target.value)}><option value="30 minutos">30 minutos</option><option value="1 hora">1 hora</option><option value="2 horas">2 horas</option><option value="Indefinido">Hasta que lo active de nuevo</option></select></label>}</DialogoVendedor>}
  </>;
}
