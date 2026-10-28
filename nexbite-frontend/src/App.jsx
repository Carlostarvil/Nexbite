// ============================================================================
// LA REGLA DE ORO DE LOS IMPORTS Y EXPORTS EN JAVASCRIPT
// ============================================================================

/* 
  LA ANALOGÍA DEL RESTAURANTE:
  - export default (Plato Principal): Solo puede haber UNO por archivo. Se pide SIN llaves.
  - export normal (La Carta de Extras): Puede haber decenas. Se piden CON llaves.
*/

// ----------------------------------------------------------------------------
// 1. EL ARCHIVO DE ORIGEN (La Cocina: 'modulo.js')
// ----------------------------------------------------------------------------

// EXPORTACIONES NOMBRADAS (Los Extras)
// El cocinero usa 'export' a secas. Como NO llevan la palabra 'default', 
// estas herramientas se van a la lista secundaria.s

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@apollo/client/react/index.js';
import { gql } from '@apollo/client/core/index.js';
import Auth from './Auth'; 
import Header from './Header'; 
import Footer from './Footer';
import MapView from './MapView'; 
import RegistroRestaurante from './RegistroRestaurante';
import PerfilRestaurante from './PerfilRestaurante';
import Carrito from './Carrito';
import MisFavoritos from './MisFavoritos';
import MisLocales from './MisLocales'; 
import GestorMenu from './GestorMenu'; 
import GestorPedidos from './GestorPedidos'; 
import EspacioVendedor from './EspacioVendedor';
import PerfilVendedor from './PerfilVendedor';
import ErrorBoundary from './ErrorBoundary'; 
import DetallePlato from './DetallePlato'; 
import PerfilUsuario from './PerfilUsuario';
import CarruselPlatos from './CarruselPlatos';
import CategoriasInicio from './CategoriasInicio';
import TarjetaLocalInicio from './TarjetaLocalInicio';
import TarjetaProductoInicio from './TarjetaProductoInicio';
import SelectorRecomendaciones from './SelectorRecomendaciones';
import TituloSeccion, { ControlesCarrusel } from './TituloSeccion';
import AvisoCarrito from './AvisoCarrito';
import ConfirmacionPedido from './ConfirmacionPedido';
import { EstadoCarritoContext } from './estadoCarrito';
import SelectorUbicacion from './SelectorUbicacion';
import { leerUbicacionEntrega, guardarUbicacionEntrega } from './ubicacionEntrega';
import './Tipografia.css';
import AvisoCookies from './AvisoCookies'; 
import ChatSoporteIA from './ChatSoporteIA';

// ============================================================================
// FRONTEND (APLICACIÓN MÓVIL/WEB): PREPARANDO LA PETICIÓN AL SERVIDOR
// ============================================================================

// 1. LA CONSTANTE EN MAYÚSCULAS:
// Por convención (regla no escrita de los programadores), usamos mayúsculas 
// para indicar que esta es una plantilla fija de consulta. Es decir, la "comanda" 
// base no va a cambiar mientras el usuario usa la app.
// 2. EL TRADUCTOR ('gql'):
  // Esta es una función externa (generalmente importada de Apollo Client). 
  // Su trabajo es coger el texto que escribas a continuación y traducirlo 
  // a un formato estructurado (llamado AST) que tu servidor backend entienda.
  // Sin esto, el servidor rechazaría el mensaje por no saber leerlo.
const OBTENER_DATOS_INICIO = gql`
  query ObtenerDatosInicio($id_usuario: ID!, $latitud: Float!, $longitud: Float!, $solo_con_entrega: Boolean!) {
    obtenerMejoresRestaurantes(latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_restaurante, nombre, tipo, imagen_url, aceptando_pedidos, tiempo_reactivacion, calificacion }
    obtenerFavoritos(id_usuario: $id_usuario, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_restaurante, nombre, tipo, imagen_url, aceptando_pedidos, tiempo_reactivacion, calificacion }
    obtenerPlatosDestacados(latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_plato, id_restaurante, nombre, descripcion, precio, imagen_url, nombre_restaurante, categoria, disponible, tiempo_disponible, items_menu { id_plato nombre imagen_url } }
    obtenerUltimosPedidos(id_usuario: $id_usuario) {
      id_pedido, id_restaurante, id_plato, nombre_plato, precio_plato
      estado, nombre_restaurante, imagen_restaurante, plato_disponible, restaurante_abierto
      fecha_pedido, descripcion_plato, imagen_plato
    }
    obtenerPlatosFavoritos(id_usuario: $id_usuario, latitud: $latitud, longitud: $longitud, solo_con_entrega: $solo_con_entrega) { id_plato }
  }
`;

const obtenerDatosDesdeToken = (token) => {
  try {
    // ============================================================================
// ESTRUCTURA DEL JWT Y EXTRACCIÓN DEL PAYLOAD
// ============================================================================

// Físicamente, un JSON Web Token (JWT) es un String concatenado por puntos 
// que delimitan sus tres partes constituyentes: `Header.Payload.Signature`.
//
// 1. Método `String.prototype.split()`: Actúa como un tokenizador, dividiendo 
//    la cadena original utilizando el delimitador `.` para generar un Array 
//    de 3 posiciones (índices 0, 1 y 2).
//
// 2. Extracción del Índice [1]: El segundo segmento (índice 1) corresponde 
//    estrictamente al 'Payload' (las "Claims" o datos del usuario). 
//
// 3. Naturaleza del Payload: Este segmento está codificado en Base64Url, 
//    no encriptado. Permite al cliente (Frontend) decodificar el estado del 
//    usuario (Identity) de manera síncrona y offline, reduciendo las llamadas 
//    de red al Backend.
    const payload = token.split('.')[1];
    // 1. atob() -> EL TRADUCTOR BASE64
  // 'atob' (ASCII to Binary) es una función nativa del navegador. Coge el 
  // texto incomprensible del payload y lo traduce a texto normal legibe por humanos.
  
  // 2. JSON.parse() -> EL ORGANIZADOR
  // Aunque 'atob' traduzca el texto, para JavaScript sigue siendo una simple 
  // frase de texto plana. 'JSON.parse' coge esa frase y la convierte 
  // oficialmente en un Objeto de JavaScript, permitiéndonos acceder a sus 
  // piezas internas.
  
  // 3. .id_usuario -> EL SELECTOR FINAL
  // Una vez convertido en objeto, ponemos el punto y el nombre de la variable 
  // para extraer únicamente el identificador del usuario.
  // Aquí ocurre exactamente el mismo proceso de traducción, pero esta 
  // vez para extraer únicamente el rol del usuario (admin, cliente, etc).
    return { id_usuario: JSON.parse(atob(payload)).id_usuario, rol: JSON.parse(atob(payload)).rol };

    // ============================================================================
// OPTIONAL CATCH BINDING (ES2019 / ES10)
// ============================================================================

// 1. Sintaxis Histórica: Previo a ECMAScript 2019, el bloque `catch` requería 
//    obligatoriamente el enlazado (binding) de un parámetro para instanciar 
//    el objeto de error (ej. `catch (err)`), incluso si dicho objeto nunca 
//    iba a ser evaluado en el bloque lógico posterior.
//
// 2. Modificación del Estándar: La propuesta "Optional Catch Binding" modificó 
//    la gramática de JavaScript permitiendo omitir los paréntesis y el identificador 
//    completamente: `try { ... } catch { ... }`.
//
// 3. Casos de Uso: Esta omisión es la convención recomendada cuando la lógica 
//    de recuperación (Fallback) es genérica y no depende de la naturaleza o 
//    el mensaje de la excepción lanzada, optimizando la legibilidad del código.
  } catch (e) { return null; }
};

const parseCategorias = (catData) => {
  if (!catData) return [];
  try {
    if (typeof catData === 'string') return catData.replace(/[{}"[\]\\]/g, '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (Array.isArray(catData)) return catData.flatMap(c => typeof c === 'string' ? c.replace(/[{}"[\]\\]/g, '').split(',').map(s => s.trim().toUpperCase()) : String(c).toUpperCase()).filter(Boolean);
  } catch(e) {}
  return [];
};

const extraerTags = (descripcion, categoriasBackend) => {
  let descLimpia = descripcion || '';
  let tagsExtra = [];
  let precioAnterior = null;

  const matchAntes = descLimpia.match(/\|ANTES:\s*([\d.,]+)/i);
  if (matchAntes) {
    precioAnterior = parseFloat(matchAntes[1].replace(',', '.'));
    descLimpia = descLimpia.replace(matchAntes[0], '').trim();
  }

  if (descLimpia.includes(' |TAGS:')) {
    const partes = descLimpia.split(' |TAGS:');
    descLimpia = partes[0];
    tagsExtra = partes[1].split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  } else if (descLimpia.includes('|TAGS:')) {
    const partes = descLimpia.split('|TAGS:');
    descLimpia = partes[0].trim();
    tagsExtra = partes[1].split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  }

  return { descLimpia, tagsTotales: [...parseCategorias(categoriasBackend), ...tagsExtra], precioAnterior };
};

function App() {

  

/* 
  EL CONCEPTO PRINCIPAL:
  Esta línea no está "creando" un array. Está "abriendo" un paquete (un array) 
  que React te acaba de devolver, rompiéndolo en el aire y poniéndole nombre 
  a las dos piezas que vienen dentro. Es pura pereza sintáctica (un atajo).
*/

// LA LÍNEA MODERNA (ES6 - Actualidad)
const [isLoggedIn, setIsLoggedIn] = useState(false);

/*
  DESGLOSE PASO A PASO DE LO QUE HACE LA MÁQUINA:

  1. useState(false): 
     Le pides a React que reserve memoria para un estado inicial (false).
     React te devuelve un array cerrado que SIEMPRE tiene 2 cosas:
     [ el_dato_actual, la_herramienta_para_cambiarlo ]

  2. Los corchetes [ ] a la izquierda del igual:
     Se llaman "Array Destructuring". Rompen el array que devolvió React.

  3. isLoggedIn (Posición 0):
     - TIPO DE DATO: Booleano (porque le pasamos 'false' al inicio).
     - QUÉ ES: Es tu variable de lectura. El estado actual.
     - REGLA: Es inmutable. NUNCA puedes hacer `isLoggedIn = true`.

  4. setIsLoggedIn (Posición 1):
     - TIPO DE DATO: Función (Setter).
     - QUÉ ES: Es el "control remoto". La ÚNICA forma permitida de cambiar el estado.
     - MAGIA: Al ejecutar `setIsLoggedIn(true)`, React cambia el valor interno y 
       automáticamente recarga (renderiza) la pantalla con el nuevo dato.
*/


// ============================================================================
// COMPARATIVA: CÓMO SE HACÍA ANTIGUAMENTE (ES5 - Antes de 2015)
// ============================================================================

/* 
  Antes no existía el atajo de los corchetes. Para hacer exactamente lo mismo, 
  estabas obligado a guardar el array completo en una variable basura y sacar 
  las piezas manualmente por su número de índice.
*/

// ============================================================================
// CÓMO SE HACÍA ANTIGUAMENTE (ES5) - Todo comentado para que no se ejecute
// ============================================================================

// 1. Recibir y guardar el paquete completo (el Array) en la memoria:
// var estadoDeReact = useState(false);

// 2. Extraer la posición 0 manualmente (El Booleano):
// var isLoggedInViejo = estadoDeReact[0];

// 3. Extraer la posición 1 manualmente (La Función):
// var setIsLoggedInViejo = estadoDeReact[1];
  // ============================================================================
// RESUMEN: EL HOOK USESTATE Y LA DESESTRUCTURACIÓN DE ARRAYS
// ============================================================================
  const [userId, setUserId] = useState(null);
  const [userRol, setUserRol] = useState(null);
  const [ubicacionEntrega, setUbicacionEntrega] = useState(() => {
    const datos = obtenerDatosDesdeToken(localStorage.getItem('nexbite_token') || '');
    return leerUbicacionEntrega(datos?.id_usuario);
  });
  const [mostrarSelectorUbicacion, setMostrarSelectorUbicacion] = useState(false);
  const [modoEntrega, setModoEntrega] = useState('DOMICILIO');
  
  const [restauranteActivo, setRestauranteActivo] = useState(null);
  const [platoActivo, setPlatoActivo] = useState(null); 
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [irAPedidosPerfil, setIrAPedidosPerfil] = useState(false);
  
  const [carrito, setCarrito] = useState([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [confirmacionPedido, setConfirmacionPedido] = useState(null);
  const [avisoCarrito, setAvisoCarrito] = useState(null);
  const [destinoCarrito, setDestinoCarrito] = useState({ irAPago: false, idRestaurante: null });
  const numeroAviso = useRef(0);
  const cerrarAvisoCarrito = useCallback(() => setAvisoCarrito(null), []);
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false); 

  const [vistaVendedor, setVistaVendedor] = useState('MIS_LOCALES'); 
  const [localSeleccionado, setLocalSeleccionado] = useState(null); 
  const [mensajeVendedor, setMensajeVendedor] = useState(null);
  
  const [categoriaFiltroInicio, setCategoriaFiltroInicio] = useState(null);
  
  const [pestañaElegidoParaTi, setPestañaElegidoParaTi] = useState('LOCALES');

  const repetimosRef = useRef(null);

  const agregarAlCarrito = (plato) => {
    // PROPÓSITO: Asegurar que el plato tenga un restaurante asignado. 
    // Toma el ID que viene en el plato, o usa el 'restauranteActivo' por defecto.
    const idRestauranteDelPlato = plato.id_restaurante || restauranteActivo;
    
    // PROPÓSITO: Actualizar el estado del carrito de forma segura, 
    // tomando una "foto" del carrito actual (prevCarrito).
    setCarrito(prevCarrito => {
      
      // PROPÓSITO: Buscar la posición (0, 1, 2...) de este plato en el carrito actual.
      // Compara los IDs convirtiéndolos a texto (String) para evitar errores.
      // Si no lo encuentra en toda la lista, devolverá -1.
      const index = prevCarrito.findIndex(p => String(p.id_plato) === String(plato.id_plato));
      
      // PROPÓSITO: Tomar decisiones basadas en si el plato se encontró o no.
      // Literalmente dice: "Si el número de posición NO ES -1" (es decir, el plato YA EXISTE).
      if (index !== -1) {
        // [...] copia la lista, pero los objetos de dentro siguen siendo los mismos.
        // Copiamos también el producto con {...} antes de cambiar su cantidad.
        const nuevoCarrito = [...prevCarrito];
        nuevoCarrito[index] = {
          ...nuevoCarrito[index],
          cantidad: (nuevoCarrito[index].cantidad || 1) + 1
        };
        return nuevoCarrito;
      } else {
        return [...prevCarrito, { ...plato, id_restaurante: idRestauranteDelPlato, cantidad: 1 }];
      }
    });
    // PROPÓSITO GENERAL: Aumentar en 1 un contador interno sin provocar 
// que la pantalla (el componente de React) se vuelva a dibujar.

// 1. numeroAviso: Es la referencia (creada con useRef) cuyo propósito es guardar un dato que perdure.
// 2. .current: Es la propiedad obligatoria de useRef. Su propósito es acceder al valor actual guardado.
// 3. += 1: Es la operación matemática. Su propósito es sumarle 1 al valor existente.
    numeroAviso.current += 1;

    // PROPÓSITO GENERAL: Guardar un nuevo objeto en el estado de React para mostrar 
// una notificación (aviso) en pantalla, asegurando que tenga los datos correctos y un ID único.
setAvisoCarrito({ 
  // PROPÓSITO: Operador de propagación. Extrae y copia automáticamente todas las 
  // propiedades originales del 'plato' (nombre, precio, etc.) dentro de este nuevo objeto.
  ...plato, 
  
  // PROPÓSITO: Asignar el restaurante validado. Si el objeto 'plato' original 
  // ya tenía una propiedad llamada 'id_restaurante', esta línea la sobrescribe 
  // con el valor correcto de la variable 'idRestauranteDelPlato'.
  id_restaurante: idRestauranteDelPlato, 
  
  // PROPÓSITO: Asignar un identificador único a esta notificación en particular 
  // usando el número de la referencia (useRef). Esto es vital para que React 
  // sepa exactamente qué alerta mostrar o borrar si hay varios avisos al mismo tiempo.
  id: numeroAviso.current 
});
};
// PROPÓSITO GENERAL: Guardar la notificación en el estado de React creando un objeto nuevo, 
// pero escribiendo manualmente cada propiedad en lugar de usar el atajo de los tres puntos (...plato).
//setAvisoCarrito({
  // PROPÓSITO: Extraer y asignar manualmente cada dato que viene en el objeto 'plato'.
  // Si el día de mañana agregas una foto o descripción al plato, tendrías que 
  // venir a esta línea y agregar "imagen: plato.imagen", etc.
  //id_plato: plato.id_plato,
  //nombre: plato.nombre,
  //precio: plato.precio,
  // ... (aquí irían todas las demás propiedades que tenga tu plato)
  
  // PROPÓSITO: Asignar el restaurante correcto usando la variable donde preveniste errores.
  // Como lo escribes manualmente, esto reemplaza la necesidad de sobrescribir el dato.
  //id_restaurante: idRestauranteDelPlato,
  
  // PROPÓSITO: Darle un identificador único (matrícula) a esta notificación específica
  // usando el contador que creaste con useRef, para que React no confunda las alertas.
  //id: numeroAviso.current
//});
  

  // PROPÓSITO GENERAL: Crear una función para restar platos y guardarla en memoria 
// de forma permanente para que React no tenga que volver a crearla en cada recarga.
const restarDelCarrito = useCallback(
  
  // PRIMER PARÁMETRO DE useCallback: Es la función que realmente hace el trabajo.
  // PROPÓSITO: Recibir el ID del plato y ejecutar la lógica para restarlo del carrito.
  (idPlato) => {
    setCarrito(anterior => anterior.flatMap(plato => {
      if (String(plato.id_plato) !== String(idPlato)) return [plato];
      const cantidad = plato.cantidad || 1;
      return cantidad > 1 ? [{ ...plato, cantidad: cantidad - 1 }] : [];
    }));
  }, 
  
  // SEGUNDO PARÁMETRO DE useCallback: El arreglo de dependencias [].
  // PROPÓSITO: Decirle a React cuándo debe actualizar esta función. 
  // Al estar vacío [], le dice: "Nunca la cambies, memorízala tal como está para siempre".
  []
);

  // PROPÓSITO GENERAL: Función que actúa como "director de orquesta". 
// Prepara la pantalla para mostrar el carrito, guardando a dónde quiere ir el usuario 
// y cerrando cualquier otro menú que esté estorbando en la interfaz.
const abrirCarrito = (
  // PARÁMETROS POR DEFECTO (No son una función, son los datos que recibe):
  // PROPÓSITO: Si llamas a abrirCarrito() sin enviarle nada, no marcará error; 
  // usará 'false' y 'null' por seguridad. Si le envías datos, usará los que le des.
  irAPago = false, 
  idRestaurante = null
) => {
  
  // PROPÓSITO: Guardar en la memoria las instrucciones de navegación del carrito.
  // Las llaves {} crean un OBJETO. Como la etiqueta y la variable se llaman EXACTAMENTE igual,
  // se usa este atajo de JavaScript. Es el equivalente automático a escribir:
  // setDestinoCarrito({ irAPago: irAPago, idRestaurante: idRestaurante });
  setDestinoCarrito({ irAPago, idRestaurante });
  
  // PROPÓSITO: La acción principal. Cambia el estado a 'true' para que 
  // el componente del carrito se dibuje y sea visible en la pantalla.
  setMostrarCarrito(true);
  
  // PROPÓSITO: Manejo de menús excluyentes. Si la ventana de Favoritos 
  // o el Perfil del usuario estaban abiertos, los apaga (false) para que no 
  // se encimen y la pantalla no se vuelva un caos de ventanas superpuestas.
  setMostrarFavoritos(false);
  setMostrarPerfil(false);
  
  // PROPÓSITO: Limpiar selecciones previas. Si el usuario estaba viendo el detalle 
  // de un restaurante o de un plato específico, esto los deselecciona (null) 
  // para cerrar esos modales/ventanas.
  setRestauranteActivo(null);
  setPlatoActivo(null);
  
  // PROPÓSITO: Limpieza visual. Si había un cartelito flotante temporal diciendo 
  // "Agregado al carrito", ejecuta esta función para desaparecerlo de inmediato.
  cerrarAvisoCarrito();
  
  // PROPÓSITO: Mejorar la experiencia del usuario (UX) moviendo el navegador (window).
  // Le da la orden de mover la barra de desplazamiento a las coordenadas X: 0, Y: 0.
  // Esto sube la pantalla de golpe hasta la parte más alta de la página web. 
  // Así, si el usuario estaba viendo cosas hasta abajo, no tiene que subir manualmente para ver el carrito.
  window.scrollTo(0, 0);
};

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('resetToken')) {
      localStorage.removeItem('nexbite_token');
      localStorage.removeItem('user');
      setIsLoggedIn(false);
      return; 
    }
    const token = localStorage.getItem('nexbite_token');
    // PROPÓSITO GENERAL: Verificar de forma rápida si la variable 'token' existe 
// y contiene algún dato válido (como el texto de tu sesión), usando 
// una evaluación automática del lenguaje conocida como "Truthy".


    
    // ---------------------------------------------------------
    // 1. LA CONDICIÓN IMPLÍCITA (El propósito de escribirlo así)
    // Aunque a simple vista parezca que falta una condición matemática o lógica, 
    // la condición SÍ existe, pero está implícita. Al escribir solo "token", 
    // el propósito es decirle a JavaScript que evalúe si el valor es real.
    // Si tiene texto (ej. "eyJhG..."), es "Truthy" (verdadero) y entra a este bloque.
    // Si está vacío, es "Falsy" (falso) y salta este bloque.

    // ---------------------------------------------------------
    // 2. LO QUE TE AHORRA (La versión larga)
    // El propósito de este atajo es ahorrarte escribir manualmente todas 
    // las formas en que el dato podría estar vacío. 
    // Internamente, JavaScript ejecuta el equivalente exacto a esto:
    // if (token !== null && token !== undefined && token !== "") { ... }

    // ---------------------------------------------------------
    // 3. LOS ERRORES QUE EVITA (Por qué no usar = o ===)
    // - NO se escribe "if (token = true)" porque un solo '=' tiene el propósito 
    //   de ASIGNAR. Eso borraría tu texto original y guardaría un 'true', 
    //   destruyendo la seguridad del sistema y dejándolo entrar siempre.
    //
    // - NO se escribe "if (token === true)" porque el '===' tiene el propósito 
    //   de COMPARAR ESTRICTAMENTE. Como tu token es un texto y no la palabra 
    //   booleana 'true', la condición siempre daría falso y nunca entraría aquí.


    if (token) {
      const datos = obtenerDatosDesdeToken(token);
      if (datos) { setIsLoggedIn(true); setUserId(datos.id_usuario); setUserRol(datos.rol); }
    }
  }, []);

  // PROPÓSITO GENERAL: Ejecutar una consulta a la base de datos (useQuery) y 
// "abrir el paquete" (el objeto) que nos devuelve para extraer directamente 
// 3 variables sueltas e independientes listas para usar (Desestructuración).
const { 

  // VARIABLE 1: loading (Sin renombrar)
  // PROPÓSITO: Extraer el estado de carga. Como en este momento es la única o 
  // principal consulta, no necesitamos los dos puntos (:). Conservamos su nombre 
  // original por comodidad, ya que no chocará con otras variables. 
  // Valdrá 'true' mientras el servidor siga buscando la información.
  loading, 

  // VARIABLE 2: error (Sin renombrar)
  // PROPÓSITO: Extraer si hubo algún fallo. Igual que con loading, dejamos su 
  // nombre original porque es universal y suficiente para esta única consulta.
  // (OJO: Si hicieras otra consulta debajo de esta, estarías OBLIGADO a usar los 
  // dos puntos para renombrarlo, ej. error: errorInicio, o el programa explotaría).
  error, 

  // VARIABLE 3: datosInicio (Con renombramiento)
  // PROPÓSITO DE LOS DOS PUNTOS (:): Renombrar una propiedad para evitar confusión.
  // La propiedad original que entrega la base de datos se llama 'data', un nombre 
  // terriblemente genérico. Le estamos diciendo a JavaScript: "Extrae lo que hay 
  // dentro de 'data', pero en mi código bautízalo como 'datosInicio'".
  data: datosInicio 

} = useQuery(OBTENER_DATOS_INICIO, {
  
  // PROPÓSITO DE VARIABLES: Son los "ingredientes" o filtros que le mandas 
  // al servidor para que sepa exactamente qué información devolverte.
  variables: { 
    id_usuario: userId, 
    latitud: ubicacionEntrega?.lat, 
    longitud: ubicacionEntrega?.lng, 
    solo_con_entrega: modoEntrega === 'DOMICILIO' 
  },
  
  // PROPÓSITO DE SKIP (Saltar): Es un escudo de seguridad. Le dice a React: 
  // "Ni siquiera intentes hacer esta búsqueda si el usuario no ha iniciado sesión, 
  // no tiene ID, es un vendedor, o aún no conocemos su ubicación".
  skip: !isLoggedIn || !userId || userRol === 'VENDEDOR' || !ubicacionEntrega,
  
  // PROPÓSITO DE FETCH POLICY: 'network-only' (solo-red) obliga al sistema a 
  // conectarse a internet siempre para traer datos frescos, prohibiéndole usar 
  // datos viejos que hayan quedado guardados en la memoria caché del celular o navegador.
  fetchPolicy: 'network-only' 
});


  const data = loading ? undefined : datosInicio;

  const handleCerrarSesion = () => {
    localStorage.removeItem('nexbite_token');
    localStorage.removeItem('user');
    // PROPÓSITO GENERAL: Redirigir al usuario inmediatamente a la página 
// principal (inicio), pero forzando una RECARGA COMPLETA del navegador.
// A diferencia de la navegación suave de React (como useNavigate), esto destruye 
// toda la memoria temporal (estados, variables, carritos a medio llenar), 
// por lo que es ideal para funciones como "Cerrar Sesión".

// 1. window: Representa la ventana completa de tu navegador web.
// 2. .location.href: Es la barra de direcciones. Al ponerle un "=", 
//    le ordenas al navegador que borre la URL actual y escriba la nueva.
// 3. '/': Significa "La Raíz" o página principal (Home) de tu sitio web.

    window.location.href = '/'; 
  };

  const handleInicio = () => {
    setRestauranteActivo(null); setPlatoActivo(null); setMostrarCarrito(false);
    setMostrarFavoritos(false); setMostrarPerfil(false); setVistaVendedor('MIS_LOCALES'); 
    setCategoriaFiltroInicio(null); 
  };

  const abrirPerfil = (irAPedidos = false) => {
    setIrAPedidosPerfil(irAPedidos);
    setMostrarPerfil(true);
    setMostrarCarrito(false);
    setMostrarFavoritos(false);
    setRestauranteActivo(null);
    setPlatoActivo(null);
    cerrarAvisoCarrito();
    if (!irAPedidos) window.scrollTo(0, 0);
  };

  const navegarDesdeFooter = destino => {
    if (destino === 'carrito') return abrirCarrito();
    if (destino === 'ubicacion') {
      if (ubicacionEntrega) setMostrarSelectorUbicacion(true);
      else { 
  // PROPÓSITO: Ejecutar la función que prepara o limpia la pantalla de inicio.
  handleInicio(); 
  
  // PROPÓSITO GENERAL: Buscar la caja donde se escribe la dirección y poner 
  // el cursor adentro automáticamente para facilitarle la vida al usuario.
  document.getElementById('direccion-entrega')?.focus(); 

  // DESGLOSE EXACTO DE LA LÍNEA ANTERIOR:
  // 1. document.getElementById('direccion-entrega'): 
  //    Su propósito es buscar en toda la página HTML el elemento (la caja de texto) 
  //    que tenga exactamente ese ID.
  //
  // 2. ?. (Optional Chaining o Encadenamiento Opcional): 
  //    Es un escudo de seguridad. Su propósito es decir: "SI encuentras la caja, 
  //    entonces haz lo que sigue. Pero si la caja no existe en la pantalla en 
  //    este momento, detente aquí y NO rompas el programa".
  //
  // 3. .focus(): 
  //    Su propósito es darle el "foco" a ese elemento. Activa la caja de texto 
  //    y pone el cursor a parpadear adentro, listo para que el usuario teclee.
}
      return;
    }
    handleInicio();
    cerrarAvisoCarrito();
    if (destino === 'perfil' || destino === 'pedidos') return abrirPerfil(destino === 'pedidos');
    if (destino === 'favoritos') setMostrarFavoritos(true);
    if (destino === 'registrar' && userRol === 'VENDEDOR') setVistaVendedor('REGISTRAR');
    window.scrollTo(0, 0);
  };

  // PROPÓSITO GENERAL: Función que se activa cuando el usuario le da clic 
// a un botón de "Volver a pedir" o "Recomprar" en su historial de compras.
const handleRecomprarRapido = (

  // 1. ¿QUÉ SON LOS PARÁMETROS (e, pedido)?
  // 'e' (Abreviatura de Evento): Es un objeto que el navegador te regala automáticamente 
  // cuando alguien hace clic. Contiene toda la información de ese clic (dónde fue, con qué botón, etc.).
  // 'pedido': Es el objeto que contiene toda la información de la base de datos sobre la orden anterior.
  e, pedido

) => {
  
  // 2. ¿QUÉ ES Y QUÉ HACE e.stopPropagation()?
  // PROPÓSITO: Evitar que el clic "traspase" hacia los elementos del fondo (Burbujeo).
  // Imagina que tu botón de "Recomprar" está adentro de un cuadro (tarjeta) más grande. 
  // Si haces clic en el cuadro grande, se abren los detalles del pedido.
  // Si haces clic en el botón de "Recomprar", el navegador por defecto también le avisa 
  // al cuadro grande que hubo un clic, y se abrirían los detalles por accidente.
  // stopPropagation() le dice al navegador: "El clic muere aquí en el botón, NO avises a nadie más".
  e.stopPropagation();
  
  
  // 3. ¿QUÉ SON ESTAS LLAVES { } ADENTRO DE LA FUNCIÓN?
  // ¡Acertaste! Estás fabricando un objeto nuevo "al vuelo" (en ese mismo instante).
  // PROPÓSITO: Traducción o "Mapeo" de datos. 
  // El historial de pedidos guardó el precio bajo el nombre 'precio_plato'.
  // PERO, tu función del carrito espera que ese dato se llame simplemente 'precio'.
  // Al crear este objeto nuevo, estás sacando los datos del historial y poniéndoles 
  // las etiquetas exactas que tu carrito exige para funcionar sin errores.
  agregarAlCarrito({ 
    id_plato: pedido.id_plato, 
    id_restaurante: pedido.id_restaurante, 
    nombre: pedido.nombre_plato, 
    precio: pedido.precio_plato, 
    imagen_url: pedido.imagen_plato 
  });
  
};

  const abrirDetalleDesdePedido = (pedido) => {
    setMostrarPerfil(false);
    setRestauranteActivo(null);
    setPlatoActivo({
      id_plato: pedido.id_plato, id_restaurante: pedido.id_restaurante,
      nombre: pedido.nombre_plato, precio: pedido.precio_plato,
      descripcion: pedido.descripcion_plato, imagen_url: pedido.imagen_plato
    });
  };

  const scrollRepetimos = (desplazamiento) => {
    // PROPÓSITO GENERAL: Desplazar (scrollear) suavemente un carrusel o lista horizontal 
// de elementos, pero solo si ese carrusel realmente existe en la pantalla en este momento.

if (repetimosRef.current) {
  
  // 1. ¿QUÉ CONDICIÓN SE ESTÁ CUMPLIENDO AQUÍ?
  // PROPÓSITO DEL IF: Evitar que el programa explote. 
  // 'repetimosRef' es un "gancho" (useRef) de React que apunta a una caja HTML 
  // (probablemente un contenedor de restaurantes o platos). 
  // Cuando la página apenas está cargando, ese gancho está vacío (null / Falsy). 
  // La condición simplemente evalúa: "¿El elemento HTML ya se dibujó en la pantalla y existe?".
  // Si la respuesta es SÍ (Truthy), entra y ejecuta la animación.
  
  repetimosRef.current.scrollBy({ 
    
    // 2. ¿QUÉ ES scrollBy?
    // Es una orden directa del navegador. Su propósito es mover la barra de desplazamiento 
    // de ESE elemento en específico "X" cantidad de píxeles desde donde está ahorita.
    // (A diferencia de scrollTo que te lleva a un punto fijo, scrollBy te suma o resta distancia).
    
    // PROPÓSITO DE 'left': Indica hacia dónde te mueves. 
    // Mueve el contenido horizontalmente (izquierda/derecha) usando 
    // la cantidad de píxeles que tenga guardada tu variable 'desplazamiento'.
    left: desplazamiento, 
    
    // PROPÓSITO DE 'behavior: smooth': Experiencia de usuario (UX).
    // Si no pones esto, el cambio es instantáneo y agresivo, como un parpadeo.
    // 'smooth' le dice al navegador que haga una animación suave, deslizando 
    // el contenido como si lo empujaras con el dedo.
    behavior: 'smooth' 
    
  });
}
  };

  if (!isLoggedIn) {
    return (
      <div style={{ fontFamily: 'system-ui', margin: 0, padding: 0, minHeight: '100vh', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
        
        <div className="header-contenedor">
          <Header isLoggedIn={false} onInicio={() => window.scrollTo(0,0)} />
        </div>
        
        <main className="nexbite-acceso-contenido" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div style={{ width: '100%', maxWidth: '450px' }}>
            <Auth onLogin={() => {
              const token = localStorage.getItem('nexbite_token');
              const datos = obtenerDatosDesdeToken(token);
              setUbicacionEntrega(leerUbicacionEntrega(datos?.id_usuario));
              setUserId(datos?.id_usuario); setUserRol(datos?.rol); setIsLoggedIn(true);
            }} />
          </div>
        </main>
        
        <Footer onNavegar={() => {
          window.scrollTo(0, 0);
          document.querySelector('input')?.focus({ preventScroll: true });
        }} />
        
        <AvisoCookies />
      </div>
    );
  }

  // PROPÓSITO GENERAL: Recorrer toda la lista de platos en el carrito, sumar 
// la cantidad de cada uno y devolver un único número con el total de artículos.

const totalArticulos = carrito.reduce(
  
  // 1. ¿QUÉ ES (acc, p)?
  // Son los dos parámetros obligatorios que necesita reduce para trabajar.
  // 
  // - 'acc' (Acumulador): Es la memoria de la calculadora. Guarda el total acumulado 
  //   hasta el momento. En la primera vuelta, vale lo que pusiste al final (0).
  // - 'p' (Plato / Producto): Representa el elemento actual que estás revisando 
  //   en esta vuelta del ciclo (ej. la Pizza, luego la Hamburguesa, etc.).
  (acc, p) => 
    
    // PROPÓSITO DE LA SUMA: Lo que devuelvas aquí se guardará en 'acc' para la siguiente vuelta.
    // Tomas el total que llevas (acc) y le sumas la cantidad de este plato (p.cantidad).
    // El "|| 1" es un seguro de vida: si por algún error el plato no tiene guardada 
    // una cantidad, asume que al menos hay 1.
    acc + (p.cantidad || 1), 
  
  // 2. ¿QUÉ ES ESTE CERO (0) AL FINAL?
  // PROPÓSITO: Es el valor inicial del Acumulador (acc). 
  // Le dices a la calculadora: "Antes de empezar a contar los platos, 
  // asegúrate de que la pantalla empiece en cero".
  0

);
  const platoDelAviso = avisoCarrito && carrito.find(plato => String(plato.id_plato) === String(avisoCarrito.id_plato));

  const favoritosLocales = data?.obtenerPlatosFavoritos?.map(fav => String(fav.id_plato)) || [];
  const historialBackend = data?.obtenerUltimosPedidos || [];
  const restaurantesFavoritos = data?.obtenerFavoritos?.map(fav => String(fav.id_restaurante)) || [];

  const generarRecomendacionesGlobales = () => {
    if (!data?.obtenerPlatosDestacados) return [];
    const puntuacionPlatos = {};
    const gustosEtiquetas = {};
    const carritoActual = Array.isArray(carrito) ? carrito : [];
    const elementosInteraccion = [...historialBackend, ...carritoActual];

    elementosInteraccion.forEach(item => {
      const cantidadComprada = item.cantidad || 1;
      const platoDb = data.obtenerPlatosDestacados.find(p => String(p.id_plato) === String(item.id_plato)) || item;
      if (platoDb && (platoDb.categoria || platoDb.descripcion)) {
        const { tagsTotales } = extraerTags(platoDb.descripcion || platoDb.descripcion_plato, platoDb.categoria);
        tagsTotales.forEach(tag => { gustosEtiquetas[tag] = (gustosEtiquetas[tag] || 0) + cantidadComprada; });
      }
    });

    data.obtenerPlatosDestacados.forEach(plato => {
      if (!puntuacionPlatos[plato.id_plato]) puntuacionPlatos[plato.id_plato] = 0;
      if (favoritosLocales.includes(String(plato.id_plato))) puntuacionPlatos[plato.id_plato] += 5; 
      const { tagsTotales } = extraerTags(plato.descripcion, plato.categoria);
      tagsTotales.forEach(tag => {
        if (gustosEtiquetas[tag]) puntuacionPlatos[plato.id_plato] += (gustosEtiquetas[tag] * 2);
      });
    });

    return [...data.obtenerPlatosDestacados]
      .filter(plato => puntuacionPlatos[plato.id_plato] > 0)
      .sort((a, b) => puntuacionPlatos[b.id_plato] - puntuacionPlatos[a.id_plato])
      .slice(0, 8); 
  };

  const generarRestaurantesRecomendados = () => {
    if (!data?.obtenerMejoresRestaurantes) return [];
    const puntuacionRestaurantes = {};
    
    data.obtenerMejoresRestaurantes.forEach(rest => {
      puntuacionRestaurantes[rest.id_restaurante] = rest.calificacion ? rest.calificacion * 2 : 0;
      if (restaurantesFavoritos.includes(String(rest.id_restaurante))) {
        puntuacionRestaurantes[rest.id_restaurante] += 10;
      }
    });

    historialBackend.forEach(pedido => {
      if (puntuacionRestaurantes[pedido.id_restaurante] !== undefined) {
        puntuacionRestaurantes[pedido.id_restaurante] += 5;
      }
    });

    return [...data.obtenerMejoresRestaurantes]
      .filter(rest => puntuacionRestaurantes[rest.id_restaurante] > 5)
      .sort((a, b) => puntuacionRestaurantes[b.id_restaurante] - puntuacionRestaurantes[a.id_restaurante])
      .slice(0, 4); 
  };

  const platosRecomendados = generarRecomendacionesGlobales();
  const restaurantesRecomendados = generarRestaurantesRecomendados();

  const restaurantesFiltrados = data?.obtenerMejoresRestaurantes?.filter(rest => {
    if (!categoriaFiltroInicio) return true;
    return rest.tipo?.toLowerCase().includes(categoriaFiltroInicio.toLowerCase());
  }) || [];

  const asignarEstadoRestaurante = (listaPlatos) => {
    if (!listaPlatos) return [];
    const restaurantes = data?.obtenerMejoresRestaurantes || [];
    return listaPlatos.map(plato => {
      const rest = restaurantes.find(r => String(r.id_restaurante) === String(plato.id_restaurante));
      return {
        ...plato,
        restaurante_abierto: rest ? rest.aceptando_pedidos : true,
        tiempo_reactivacion_restaurante: rest ? rest.tiempo_reactivacion : null
      };
    });
  };

  const platosEnOferta = data?.obtenerPlatosDestacados?.filter(plato => {
    const { tagsTotales } = extraerTags(plato.descripcion, plato.categoria);
    return tagsTotales.includes('OFERTA');
  }) || [];

  return (
    // ============================================================================
// ANATOMÍA COMPLETA DEL CONTEXT PROVIDER (El Router Wi-Fi de React)
// PROPÓSITO GENERAL: Encender una "antena transmisora" para enviar las variables 
// del carrito a cualquier componente hijo de la app (el frontend), saltándose 
// el molesto proceso de pasarlas de mano en mano piso por piso (Prop Drilling).
// ============================================================================
// 1. EstadoCarritoContext (El Router Wi-Fi / El Objeto Base)
  // - QUÉ ES: Es un objeto oficial de React creado en otro archivo (estadoCarrito.js) 
  //   y que trajiste a App.js usando un 'import'.
  // - El valor inicial de createContext sirve de alternativa si no hay Provider.
  //   En JavaScript no impone un tipo estricto: el Provider aporta el objeto real.
  
  // 2. .Provider (La Antena Transmisora)
  // - QUÉ ES: El punto (.) saca un dato que vive adentro del objeto EstadoCarritoContext.
  // - PROPÓSITO: Ese dato que sacamos resulta ser un Componente (etiqueta < >) de React. 
  //   Actúa como la antena. Todo el HTML que envuelvas dentro de esta etiqueta 
  //   quedará "bañado" por su señal.
  // - EL SECRETO: De fábrica, este proyector/antena viene completamente vacío.
  
  // 3. value= (La ranura del enchufe)
  // - QUÉ ES: Es un parámetro (Prop) inventado y exigido por los creadores de React.
  // - PROPÓSITO: Es la "ranura" oficial por donde le inyectas tu información a la antena. 
  //   No es una regla general de JavaScript, es la regla estricta de React para 
  //   que el Provider sepa qué tiene que transmitir.
  
  // 4. Las dobles llaves {{ }} (El Empaquetado)
  // - LLAVES EXTERNAS { }: Le dicen a React: "Pausa el HTML, lo que sigue es código JavaScript".
  // - LLAVES INTERNAS { }: Crean un Objeto nuevo (una "caja").
  // - PROPÓSITO: Como la ranura 'value' es muy pequeña y solo acepta recibir UNA 
  //   sola cosa a la vez, estás obligado a meter tus dos variables dentro de un 
  //   solo paquete (objeto) para poder enviarlas juntas.
  
  // 5. carrito, restarDelCarrito (El Contenido / La Película)
  // - QUÉ SON: Son los datos reales. Estas variables las creaste tú más arriba 
  //   en este mismo archivo (con useState y funciones). 
  // - PROPÓSITO: Al ponerlas aquí, las estás metiendo en el camión de reparto. 
  //   Gracias a esto, cualquier componente oculto (como un botón de borrar) solo 
  //   tendrá que usar la antena receptora ('useContext') para atrapar estos datos 
  //   directamente desde el aire.

// Aquí adentro va todo tu frontend (Header, Main, Footer, etc)...
    <EstadoCarritoContext.Provider value={{ carrito, restarDelCarrito }}>



      {/* El carrito queda disponible para los componentes descendientes. */}





      
    <ErrorBoundary>
      <div style={{ fontFamily: 'system-ui', margin: 0, padding: 0, minHeight: '100vh', backgroundColor: userRol === 'VENDEDOR' ? '#f7f9f5' : '#ffffff', position: 'relative' }}>
        
        {/* El atributo inert impide interactuar con el header mientras está abierto
            el selector de ubicación o la confirmación del pedido. */}

<div className="header-contenedor" inert={mostrarSelectorUbicacion || Boolean(confirmacionPedido)}>

  {/* 
    1. div (La Caja Base)
    QUÉ ES: La etiqueta HTML más básica. Crea un bloque o rectángulo invisible 
    para agrupar las cosas de tu menú superior.
  */}

  {/* 
    2. className="header-contenedor" (El Maquillaje)
    QUÉ ES: Es el enlace a tu archivo CSS para darle colores y forma.
    EL DETALLE: En HTML normal se escribe 'class', pero como en JavaScript 
    esa es una palabra reservada, React inventó 'className' para evitar choques.
  */}

  {/* 
    3. inert= (El Cristal Blindado / El 'if' visual)
    QUÉ ES: Un atributo moderno de HTML. 
    PROPÓSITO: Conceptualmente actúa como un 'if'. SI le inyectas un 'true', 
    activa un escudo fantasma: bloquea clics, bloquea la navegación con teclado 
    y lectores de pantalla. SI le pasas 'false', todo funciona normal.
  */}

  {/* 
    4. Las llaves { ... } (El Modo JavaScript)
    PROPÓSITO: Le dicen a React: "Pausa el HTML, voy a hacer una ecuación 
    matemática/lógica aquí adentro para decidir si enciendo el cristal o no".
  */}

  {/* 
    5. mostrarSelectorUbicacion (La Condición A / El Atajo)
    QUÉ ES: Tu variable de estado (true/false) que dice si el mapa está abierto.
    EL ATAJO: Al poner solo su nombre, JavaScript evalúa automáticamente si es verdadero.
  */}

  {/* 
    6. || (La compuerta "O" / OR)
    PROPÓSITO: Une las condiciones. Le dice al sistema: "Enciende el escudo 
    SI la Condición A es verdadera... O SI la Condición B es verdadera".
  */}

  {/* 
    7. Boolean(confirmacionPedido) (La Condición B / El Traductor)
    EL PROBLEMA: 'confirmacionPedido' guarda un Objeto gigante, no un true/false.
    'Boolean()' convierte el valor a true o false: null da false; un objeto,
    incluso vacío ({}), da true. Aquí null significa que no hay confirmación.
  */}
  {/* 
  ============================================================================
  EL COMPONENTE HEADER (El Volante del Coche)
  QUÉ ES: Al empezar con Mayúscula (<Header>), React sabe que esto NO es una 
  etiqueta HTML normal (como <div>), sino una pieza de Lego fabricada por ti o tu 
  equipo en otro archivo (Header.js). 
  EL PROPÓSITO: El Header tiene los botones visuales, pero es "tonto". App.js (el cerebro) 
  le inyecta funciones (cables) y variables (datos) a través de "Props" (enchufes) 
  para darle vida.
  ============================================================================
*/}
        {/* 
  ============================================================================
  EL COMPONENTE HEADER (El Volante del Coche)
  QUÉ ES: Al empezar con Mayúscula (<Header>), React sabe que esto NO es una 
  etiqueta HTML normal (como <div>), sino una pieza de Lego fabricada por ti o tu 
  equipo en otro archivo (Header.js). 
  EL PROPÓSITO: El Header tiene los botones visuales, pero es "tonto". App.js (el cerebro) 
  le inyecta funciones (cables) y variables (datos) a través de "Props" (enchufes) 
  para darle vida.
  ============================================================================
*/}
<Header 
  // ========================================================================
  // 1. LOS CABLES DE FUNCIÓN DIRECTA
  // onInicio: Enchufe inventado en Header.js.
  // handleInicio: Función real en App.js que limpia y reinicia la pantalla.
  // ========================================================================
  onInicio={handleInicio} 
  
  // Si tocan salir, ejecuta la función que borra el token de seguridad
  onLogout={handleCerrarSesion} 

  // ========================================================================
  // 2. LOS CABLES DE DATOS (Variables)
  // Envía el número de platos para que el Header dibuje el círculo rojo.
  // ========================================================================
  cantidadCarrito={totalArticulos} 

  // ========================================================================
  // 3. LAS FUNCIONES "ENVUELTAS" (Funciones Flecha en línea)
  // Crea instrucciones directamente aquí en lugar de hacerlas arriba en App.js
  // ========================================================================
  onAbrirCarrito={() => abrirCarrito()}
  
  // Apaga todas las pantallas y enciende solo la de Favoritos
  onAbrirFavoritos={() => { 
    setMostrarFavoritos(true); 
    setMostrarCarrito(false); 
    setRestauranteActivo(null); 
    setPlatoActivo(null); 
    setMostrarPerfil(false); 
  }}

  // ========================================================================
  // 4. FUNCIONES QUE RECIBEN DATOS DESDE EL HIJO (El camino inverso)
  // El Header envía el 'id' del restaurante o el objeto 'plato'.
  // App.js lo atrapa, actualiza el estado y sube la pantalla al tope.
  // ========================================================================
  onSelectRestaurante={id => { 
    handleInicio(); 
    setRestauranteActivo(id); 
    cerrarAvisoCarrito(); 
    window.scrollTo(0, 0); 
  }}
  
  onSelectPlato={plato => { 
    handleInicio(); 
    setRestauranteActivo(plato.id_restaurante); 
    setPlatoActivo(plato); 
    cerrarAvisoCarrito(); 
    window.scrollTo(0, 0); 
  }}
  
  onAbrirPerfil={() => abrirPerfil()}

  // ========================================================================
  // 5. EL EVALUADOR DE PANTALLAS (Operador Ternario Anidado)
  // Evalúa en cadena qué está viendo el usuario para inyectar la palabra exacta.
  // ========================================================================
  vistaActiva={
    mostrarPerfil ? 'perfil' : 
    mostrarCarrito ? 'carrito' : 
    mostrarFavoritos ? 'favoritos' : 
    'inicio'
  }

  // Variables de estado puras pasadas como texto/booleanos
  userRol={userRol}
  ubicacionEntrega={ubicacionEntrega}
  modoEntrega={modoEntrega}

  // ========================================================================
  // 6. MEZCLA DE REACT CON JAVASCRIPT CLÁSICO (DOM)
  // - SI ya hay ubicación: abre el modal del mapa.
  // - SI NO hay: usa JS puro (document.getElementById) para forzar el teclado 
  //   a escribir en la caja 'direccion-entrega'.
  // ========================================================================
  onCambiarUbicacion={() => {
    if (ubicacionEntrega) setMostrarSelectorUbicacion(true);
    else { 
      handleInicio(); 
      document.getElementById('direccion-entrega')?.focus(); 
    }
  }}
  
  // Atrapa el texto de si el usuario eligió "Delivery" o "Pick up"
  onCambiarModoEntrega={modo => { 
    setModoEntrega(modo); 
    handleInicio(); 
  }}
/>
        </div>

  <main 
  // ========================================================================
  // EL TRAJE DE FÁBRICA (Estilos Estáticos)
  // Aquí trae todo el diseño general desde el archivo CSS (colores, fuentes).
  // ========================================================================
  className="nexbite-contenido" 
  
  inert={mostrarSelectorUbicacion || Boolean(confirmacionPedido)} 
  
  // ========================================================================
  // LOS AJUSTES A MEDIDA (Estilos Dinámicos)
  // Como el CSS externo no puede leer la variable 'userRol', usamos 'style' 
  // para inyectar reglas matemáticas directamente. 
  // Si alguna de estas reglas (como maxWidth) choca con lo que dice 
  // 'nexbite-contenido', el estilo en línea normalmente gana; !important puede alterar esa prioridad.
  // ========================================================================
  style={{ 
    padding: 'clamp(1rem, 4vw, 2rem)', 
    maxWidth: userRol === 'VENDEDOR' ? '1440px' : '1200px', 
    margin: '0 auto' 
  }}>
          
          {userRol === 'VENDEDOR' ? (
            <EspacioVendedor vista={mostrarPerfil ? 'PERFIL' : vistaVendedor} local={localSeleccionado} 
            // ========================================================================
  // onNavegar (El Enchufe Personalizado)
  // QUÉ ES: Es una 'Prop' inventada por quien creó el EspacioVendedor. 
  // Empieza con la partícula 'on' por pura convención de programadores para 
  // indicar que es un evento (significa "Al Navegar").
  // PROPÓSITO: Es la ranura exacta por donde App.js conecta su función de 
  // cambio de pantallas para que el vendedor pueda usarla desde adentro.
  // ========================================================================
  // 
  onNavegar={vista => {
              if (vista === 'PERFIL') abrirPerfil();
              else { setMostrarPerfil(false); setVistaVendedor(vista); }
            }}>
              {mostrarPerfil ? <PerfilVendedor idUsuario={userId} onVerLocales={() => { setMostrarPerfil(false); setVistaVendedor('MIS_LOCALES'); }} />
              : vistaVendedor === 'REGISTRAR' ? 
              
              
              <RegistroRestaurante 
              // ========================================================================
  // LA MÁQUINA DE FORMULARIOS Y SUS CABLES (Props de Eventos)
  // EL CONCEPTO: <RegistroRestaurante> es una máquina fabricada en otro archivo. 
  // Los botones reales de "Cancelar" y "Guardar" viven escondidos adentro de ella. 
  // EL FLUJO: Como App.js (el padre) no puede tocar esos botones, usa estos 
  // "cables" (onCancelar y onGuardado) que la máquina trae de fábrica.
  // La información viaja de ADENTRO hacia AFUERA (del Hijo al Padre).
  // ========================================================================

  // ========================================================================
  // 1. EL CABLE DE "ME ARREPENTÍ" (onCancelar)
  // PROPÓSITO: Cuando el vendedor pisa el botón de cancelar dentro de la máquina, 
  // esta jala este cable. App.js recibe la señal y usa su mando a distancia 
  // (setVistaVendedor) para devolver al usuario a la pantalla de 'MIS_LOCALES'.
  // ========================================================================
  // 
  onCancelar={() => setVistaVendedor('MIS_LOCALES')} 
  // ========================================================================
  // 2. EL CABLE DE "MISIÓN CUMPLIDA" (onGuardado)
  // PROPÓSITO: Cuando la máquina termina de guardar el restaurante en la base 
  // de datos, jala este cable para avisar que terminó y lanza los datos hacia afuera.
  // ========================================================================
  onGuardado={
    // A. LA CESTA ATRAPADORA ('local =>')
    // Esta variable 'local' es un parámetro inventado. Funciona como una cesta 
    // que atrapa en el aire el paquete de datos del restaurante que acaba de 
    // salir de la máquina.
    local => {
      // B. EL USO DE LOS DATOS (El Pop-up)
      // App.js usa el mando a distancia (setMensajeVendedor) para crear una 
      // notificación. Extrae el nombre exacto desde la cesta (local.nombre) 
      // para que el mensaje sea personalizado.
                setMensajeVendedor({ tipo: 'exito', titulo: '¡Tu local ya está en NexBite!', descripcion: local.nombre + ' está listo. Añade tus productos desde «Menú».' });
                // C. LA REDIRECCIÓN
      // Usa el mando de pantallas (setVistaVendedor) para sacar al usuario 
      // del formulario y llevarlo a su lista de locales.
                setVistaVendedor('MIS_LOCALES');
              }} />
              : vistaVendedor === 'GESTOR_MENU' && localSeleccionado ? <GestorMenu key={localSeleccionado.id_restaurante} idRestaurante={localSeleccionado.id_restaurante} nombreRestaurante={localSeleccionado.nombre} />
              : vistaVendedor === 'GESTOR_PEDIDOS' && localSeleccionado ? <GestorPedidos key={localSeleccionado.id_restaurante} idRestaurante={localSeleccionado.id_restaurante} nombreRestaurante={localSeleccionado.nombre} estadoPausa={localSeleccionado.aceptando_pedidos} onEstadoLocal={cambios => setLocalSeleccionado(local => ({ ...local, ...cambios }))} />
              : <MisLocales mensajeInicial={mensajeVendedor} onCerrarMensaje={() => setMensajeVendedor(null)} onCrearNuevo={() => setVistaVendedor('REGISTRAR')} onGestionarMenu={local => { setLocalSeleccionado(local); setVistaVendedor('GESTOR_MENU'); }} onGestionarPedidos={local => { setLocalSeleccionado(local); setVistaVendedor('GESTOR_PEDIDOS'); }} onLocalActualizado={local => setLocalSeleccionado(anterior => anterior?.id_restaurante === local.id_restaurante ? local : anterior)} />}
            </EspacioVendedor>
          ) : mostrarPerfil ? (
            <PerfilUsuario irAPedidos={irAPedidosPerfil} onVolver={() => setMostrarPerfil(false)} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={abrirDetalleDesdePedido} />
          
          ) : (
            
            !ubicacionEntrega ? (
              <SelectorUbicacion onConfirmar={ubicacion => { guardarUbicacionEntrega(userId, ubicacion); setUbicacionEntrega(ubicacion); }} />
            ) : mostrarCarrito ? (
              <Carrito key={destinoCarrito.irAPago ? 'pago-' + destinoCarrito.idRestaurante : 'carrito'} carrito={carrito} setCarrito={setCarrito} onVolver={() => setMostrarCarrito(false)} vaciarCarrito={() => setCarrito([])} idUsuario={userId} ubicacionEntrega={ubicacionEntrega} onCambiarUbicacion={() => setMostrarSelectorUbicacion(true)} tipoEntregaInicial={modoEntrega} idRestauranteInicial={destinoCarrito.idRestaurante} irAPago={destinoCarrito.irAPago} onPedidoConfirmado={pedido => { cerrarAvisoCarrito(); setConfirmacionPedido(pedido); }} />
            ) : mostrarFavoritos ? (
              <MisFavoritos 
              // ========================================================================
  // EL CABLE DE IDENTIFICACIÓN (idUsuario)
  // PROPÓSITO: Pasarle el carnet de identidad a la máquina de favoritos 
  // para que sepa los gustos de quién tiene que buscar.
  // ========================================================================
  
  // 1. EL ENCHUFE ('idUsuario=')
  // Es el nombre que inventó el creador de la máquina <MisFavoritos>. 
  // Le puso así para decir: "Si quieres que funcione, conéctame por aquí 
  // el ID del usuario".
  
  // 2. LA VARIABLE / EL DNI ('{userId}')
  // Es la variable real que vive en App.js. Guarda el código único del 
  // usuario que hizo el login. 
  //
  // ¿POR QUÉ ES VITAL ESTO?
  // La máquina <MisFavoritos> por dentro tiene un código que va a hablar 
  // con tu base de datos y le va a decir: "Oye base de datos, dame los 
  // platos favoritos del usuario número [userId]". 
  // Si no le inyectas este dato desde App.js, la máquina se queda ciega y 
  // no sabría a quién buscarle los favoritos.
  // 
  idUsuario={userId} ubicacionEntrega={ubicacionEntrega} modoEntrega={modoEntrega} onVolver={() => setMostrarFavoritos(false)} onSelectRestaurante={(id) => { setRestauranteActivo(id); setMostrarFavoritos(false); }} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={setPlatoActivo} />
            
            ) : restauranteActivo ? (
              <PerfilRestaurante idRestaurante={restauranteActivo} idUsuario={userId} onVolver={() => setRestauranteActivo(null)} onAgregarAlCarrito={agregarAlCarrito} onSelectPlato={setPlatoActivo} carrito={carrito} />
            ) : (
              <>
                <TituloSeccion 
                // ========================================================================
  // LA MÁQUINA DE TÍTULOS (Reutilización de diseño)
  // EL CONCEPTO: En lugar de escribir el HTML a mano con clases CSS kilométricas 
  // en cada pantalla, usamos esta "impresora". Le pasamos los textos por los 
  // cables y ella se encarga de pintarlos siempre con el diseño oficial de NexBite,
  // ahorrando mucho tiempo y evitando errores de diseño.
  // ========================================================================

  // ========================================================================
  // 1. LOS CABLES DE TEXTO PURO (Strings)
  // Como le estamos pasando palabras (texto estático), usamos las comillas 
  // dobles "" normales del HTML.
  // ========================================================================
                titulo="¿Qué te apetece hoy?" descripcion="Encuentra tu próximo favorito entre los locales de tu zona." 
                // ========================================================================
  // 2. EL CABLE NUMÉRICO (nivel)
  // PROPÓSITO: Decide la jerarquía del HTML por dentro (ej: {1} dibuja un <h1> 
  // gigante, {2} dibuja un <h2> más pequeño).
  // ¿POR QUÉ TIENE LLAVES { }?: Si usas comillas "", React cree que es texto 
  // (la palabra "1"). Las llaves pausan el texto para avisarle de que le 
  // estamos inyectando un valor matemático real.
  // ========================================================================
                nivel={1} 
                // ========================================================================
  // 3. EL INTERRUPTOR MÁGICO (Booleano simplificado)
  // QUÉ ES: La palabra 'destacado' puesta sola es un atajo elegante de React.
  // LA REGLA: Es exactamente lo mismo que escribir destacado={true}. Si no le 
  // asignas nada, React asume que quieres "encenderlo". 
  // PROPÓSITO: Le dice a la máquina que este título debe llevar colores 
  // vibrantes o algún diseño especial para llamar la atención del usuario.
  // ========================================================================
                destacado />

                <style>{`.ocultar-scrollbar::-webkit-scrollbar { display: none; } .ocultar-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                <CategoriasInicio seleccionada={categoriaFiltroInicio} onSeleccionar={setCategoriaFiltroInicio} />

                {platosEnOferta.length > 0 && !categoriaFiltroInicio && (
                  <div className="inicio-ofertas">
                    <CarruselPlatos tarjetasInicio titulo="Ofertas Especiales" descripcion="Aprovecha estos descuentos y chollos increíbles." cabeceraInicio mostrarIcono={false} platos={asignarEstadoRestaurante(platosEnOferta)} onSelectPlato={setPlatoActivo} onAgregarAlCarrito={agregarAlCarrito} />
                  </div>
                )}

                {!categoriaFiltroInicio && (restaurantesRecomendados.length > 0 || platosRecomendados.length > 0) && (
                  <section className="elegido-para-ti" aria-label="Para ti">
                    <TituloSeccion titulo="Para ti" descripcion="Recomendaciones personalizadas según tu actividad." />
                    <SelectorRecomendaciones seleccionada={pestañaElegidoParaTi} onSeleccionar={setPestañaElegidoParaTi} />

                    <div role="tabpanel" id="recomendaciones-panel-locales" aria-labelledby="recomendaciones-tab-locales" hidden={pestañaElegidoParaTi !== 'LOCALES'} tabIndex={0}>
                      {restaurantesRecomendados.length > 0 ? (
                      <div className="elegido-para-ti-locales tarjetas-inicio-grid">
                        {restaurantesRecomendados.map(restaurante => <TarjetaLocalInicio
                          key={'rec-rest-' + restaurante.id_restaurante} local={restaurante}
                          onSeleccionar={setRestauranteActivo}
                          tieneOferta={platosEnOferta.some(p => String(p.id_restaurante) === String(restaurante.id_restaurante))} />)}
                      </div>
                      ) : (
                        <p className="elegido-para-ti-vacio" role="status"><strong>Aún no tenemos locales para recomendarte.</strong>Añade locales a favoritos o prueba alguno de tu zona.</p>
                      )}
                    </div>

                    <div role="tabpanel" id="recomendaciones-panel-productos" aria-labelledby="recomendaciones-tab-productos" hidden={pestañaElegidoParaTi !== 'PRODUCTOS'} tabIndex={0}>
                      {pestañaElegidoParaTi === 'PRODUCTOS' && (platosRecomendados.length > 0 ? (
                        <CarruselPlatos tarjetasInicio titulo="" descripcion="" cabeceraInicio={false} mostrarIcono={false} platos={asignarEstadoRestaurante(platosRecomendados)} onSelectPlato={setPlatoActivo} onAgregarAlCarrito={agregarAlCarrito} />
                      ) : (
                        <p className="elegido-para-ti-vacio" role="status"><strong>Aún no tenemos productos para recomendarte.</strong>Añade productos a favoritos para descubrir recomendaciones.</p>
                      ))}
                    </div>

                  </section>
                )}

                {!categoriaFiltroInicio && (
                  <div style={{ marginTop: '2rem' }}>
                    <CarruselPlatos tarjetasInicio titulo="Top Ventas" descripcion="Descubre los platos destacados de tu zona." cabeceraInicio mostrarIcono={false} platos={asignarEstadoRestaurante(data?.obtenerPlatosDestacados)} onSelectPlato={setPlatoActivo} onAgregarAlCarrito={agregarAlCarrito} />
                  </div>
                )}

                {data?.obtenerUltimosPedidos && data.obtenerUltimosPedidos.length > 0 && !categoriaFiltroInicio && (
                  <div style={{ marginTop: '1rem', marginBottom: '3rem', position: 'relative' }}>
                    <TituloSeccion titulo="¿Repetimos?" descripcion={historialBackend.length === 1 ? 'Tu último pedido.' : `Tus últimos ${historialBackend.length} pedidos.`} acciones={<ControlesCarrusel titulo="¿Repetimos?" onAnterior={() => scrollRepetimos(-300)} onSiguiente={() => scrollRepetimos(300)} />} />
                    
                    <div ref={repetimosRef} className="ocultar-scrollbar carrusel-tarjetas-inicio">
                      {data.obtenerUltimosPedidos.map(pedido => {
                        const puedeRecomprar = pedido.restaurante_abierto && pedido.plato_disponible;
                        const productoActual = data.obtenerPlatosDestacados?.find(p => String(p.id_plato) === String(pedido.id_plato));
                        const plato = { ...productoActual, id_plato: pedido.id_plato, id_restaurante: pedido.id_restaurante,
                          nombre: pedido.nombre_plato || 'Plato retirado', precio: pedido.precio_plato, descripcion: pedido.descripcion_plato,
                          nombre_restaurante: pedido.nombre_restaurante, imagen_url: pedido.imagen_plato };
                        return <TarjetaProductoInicio key={'reciente-' + pedido.id_pedido} plato={plato} repetir
                          onSeleccionar={() => abrirDetalleDesdePedido(pedido)} onAgregar={(_, event) => handleRecomprarRapido(event, pedido)}
                          tieneOferta={platosEnOferta.some(p => String(p.id_plato) === String(pedido.id_plato))}
                          noDisponible={!puedeRecomprar} localCerrado={pedido.restaurante_abierto === false} />;
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '8px' }}>
                      <button type="button" className="titulo-seccion-enlace" onClick={() => abrirPerfil(true)}>
                        Ver todos mis pedidos
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: categoriaFiltroInicio ? '0' : '2rem' }}>
                  {categoriaFiltroInicio && (
                    <button 
                      onClick={() => setCategoriaFiltroInicio(null)} 
                      style={{ 
                        padding: '10px 16px', background: '#f5f5f5', border: 'none', borderRadius: '8px', 
                        cursor: 'pointer', marginBottom: '1rem', fontWeight: 'bold', display: 'inline-flex', 
                        alignItems: 'center', gap: '8px', color: '#333', transition: 'background 0.2s' 
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#eaeaea'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    >
                      &larr; Volver a todas las categorías
                    </button>
                  )}
                  <TituloSeccion titulo={categoriaFiltroInicio ? `Locales de ${categoriaFiltroInicio}` : 'Los Mejores Locales'} descripcion="Locales disponibles para tu ubicación." />
                </div>
                
                {!loading && !error && restaurantesFiltrados.length === 0 ? (
                  <div style={{ 
                    padding: '4rem 2rem', textAlign: 'center', background: '#fcfcfc', 
                    borderRadius: '16px', border: '1px dashed #ccc', display: 'flex', 
                    flexDirection: 'column', alignItems: 'center', gap: '15px' 
                  }}>
                    <div style={{ background: '#fff5f2', padding: '20px', borderRadius: '50%', color: '#ff4500' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <path d="M11 8v2"></path>
                        <path d="M11 14h.01"></path>
                      </svg>
                    </div>
                    <h3 style={{ margin: '0', fontSize: '1.5rem', color: '#333' }}>¡Vaya! No hemos encontrado locales</h3>
                    <p style={{ margin: '0', fontSize: '1.1rem', color: '#666', maxWidth: '400px', lineHeight: '1.5' }}>
                      {categoriaFiltroInicio 
                        ? `En este momento no hay restaurantes de la categoría "${categoriaFiltroInicio}" que entreguen en tu ubicación.` 
                        : modoEntrega === 'DOMICILIO' 
                          ? 'Todavía no hay locales que entreguen en esta dirección.' 
                          : 'Todavía no hay locales para recoger a menos de 50 km.'}
                    </p>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {categoriaFiltroInicio && (
                        <button 
                          onClick={() => setCategoriaFiltroInicio(null)} 
                          style={{ 
                            padding: '12px 24px', background: '#333', color: '#fff', border: 'none', 
                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', 
                            transition: 'background 0.2s' 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#000'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#333'}
                        >
                          Ver todos los locales
                        </button>
                      )}
                      <button 
                        onClick={() => setMostrarSelectorUbicacion(true)} 
                        style={{ 
                          padding: '12px 24px', background: '#fff', color: '#ff4500', border: '1px solid #ff4500', 
                          borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', 
                          transition: 'all 0.2s' 
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fff5f2'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                      >
                        Cambiar ubicación
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="tarjetas-inicio-grid">
                    {restaurantesFiltrados.map(restaurante => <TarjetaLocalInicio key={restaurante.id_restaurante}
                      local={restaurante} onSeleccionar={setRestauranteActivo}
                      tieneOferta={platosEnOferta.some(p => String(p.id_restaurante) === String(restaurante.id_restaurante))} />)}
                  </div>
                )}

                {!categoriaFiltroInicio && (
                  <>
                    <div style={{ marginTop: '3rem' }}>
                      <TituloSeccion titulo="Descubre qué hay cerca de ti" descripcion="Explora el mapa y encuentra los locales de tu zona." />
                    </div>
                    <MapView key={`${ubicacionEntrega.lat}-${ubicacionEntrega.lng}-${modoEntrega}`} ubicacion={ubicacionEntrega} soloConEntrega={modoEntrega === 'DOMICILIO'} onSelectRestaurante={setRestauranteActivo} />
                  </>
                )}

                {loading && <p style={{ marginTop: '2rem' }}>Cargando datos de la plataforma...</p>}
                {error && <p style={{ marginTop: '2rem', color: 'red' }}>Error: {error.message}</p>}
                
              </>
            )
          )}
        </main>

        <Footer userRol={userRol} onNavegar={navegarDesdeFooter}
          bloqueado={mostrarSelectorUbicacion || Boolean(confirmacionPedido) || Boolean(platoActivo)} />

        {mostrarSelectorUbicacion && userRol !== 'VENDEDOR' && <div className="ubicacion-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-ubicacion">
          <SelectorUbicacion ubicacion={ubicacionEntrega} onCancelar={() => setMostrarSelectorUbicacion(false)} onConfirmar={ubicacion => {
            guardarUbicacionEntrega(userId, ubicacion);
            setUbicacionEntrega(ubicacion);
            setMostrarSelectorUbicacion(false);
            if (!mostrarCarrito) handleInicio();
          }} />
        </div>}

        {platoActivo && (
          <DetallePlato 
            plato={platoActivo} 
            onVolver={() => setPlatoActivo(null)} 
            onAgregarAlCarrito={agregarAlCarrito} 
            onIrARestaurante={(idRestaurante) => {
              setRestauranteActivo(idRestaurante);
              setPlatoActivo(null); 
              setMostrarPerfil(false); 
              setMostrarFavoritos(false); 
              setMostrarCarrito(false);
              window.scrollTo(0, 0); 
            }}
          />
        )}
        {platoDelAviso && <div inert={mostrarSelectorUbicacion || Boolean(confirmacionPedido)}>
          <AvisoCarrito aviso={{ ...platoDelAviso, ...avisoCarrito }} cantidad={platoDelAviso.cantidad || 1}
            onCerrar={cerrarAvisoCarrito} onVerCarrito={() => abrirCarrito()}
            onPagar={() => abrirCarrito(true, platoDelAviso.id_restaurante)} />
        </div>}
        
        {confirmacionPedido && <ConfirmacionPedido pedido={confirmacionPedido} onCerrar={() => setConfirmacionPedido(null)} onVerPedidos={() => { setConfirmacionPedido(null); handleInicio(); setMostrarPerfil(true); window.scrollTo(0, 0); }} />}
        
        <AvisoCookies />
        {userRol !== 'VENDEDOR' && <ChatSoporteIA />}
        
      </div>
    </ErrorBoundary>
    </EstadoCarritoContext.Provider>
  );
}

export default App;
