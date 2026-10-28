// ============================================================================
// GESTIÓN DE SECRETOS (VARIABLES DE ENTORNO) CON DOTENV
// ============================================================================

// La instrucción `import 'dotenv/config';` es el punto de entrada para 
// la gestión de secretos en aplicaciones Node.js modernas.
//
// 1. Inyección Automática: Esta importación lee un archivo oculto llamado 
//    .env en la raíz del proyecto y mapea sus pares clave-valor (Key=Value) 
//    dentro del objeto global de Node.js: `process.env`.
//
// 2. Twelve-Factor App: Cumple con el estándar de la industria de separar 
//    estrictamente el código (que se versiona en Git) de la configuración 
//    (que varía entre entornos: Desarrollo, Staging, Producción).
//
// 3. Prevención de Fugas (Leaks): Evita el "Hardcoding" de credenciales 
//    (API Keys, Passwords de DB, Tokens de JWT), garantizando que si el 
//    repositorio de código es expuesto, los secretos permanezcan a salvo.
import 'dotenv/config';
// ============================================================================
// LAS 3 FUENTES DE IMPORTACIÓN EN NODE.JS
// ============================================================================

// GRUPO 1: HERRAMIENTAS COMPRADAS EN LA TIENDA (Librerías externas NPM)
// Fíjate que no tienen puntos al principio. Node.js sabe que debe buscarlas 
// en la carpeta gigantesca llamada "node_modules" que se descargó de internet.
import bcrypt from 'bcrypt';            // Encripta contraseñas (las convierte en texto incomprensible).
import jwt from 'jsonwebtoken';         // Crea pases VIP digitales para mantener la sesión del usuario iniciada.
import nodemailer from 'nodemailer';    // El cartero. Sirve para enviar emails (ej. recibo de compra).
import { OAuth2Client } from 'google-auth-library'; // Permite poner el botón de "Inicia sesión con Google".
import Stripe from 'stripe';            // El datáfono digital para cobrar tarjetas.

// GRUPO 2: HERRAMIENTAS DE FÁBRICA (Módulos nativos de Node.js)
// Tampoco tienen puntos. Vienen instaladas de serie cuando instalas Node.js.
import { EventEmitter, on } from 'events'; // Permite que diferentes partes de tu código "hablen" entre sí en vivo.
import crypto from 'crypto';               // Herramienta matemática para generar códigos aleatorios súper seguros.

// GRUPO 3: TUS PROPIOS ARCHIVOS (El código que tú o tu equipo habéis escrito)
// LA REGLA DE ORO: Si empieza por un punto, es un archivo tuyo.
// El servidor usa tu posición actual como mapa del tesoro.
import pool from '../config/db.js';              
// El "../" significa: "Sal de la carpeta donde estamos ahora mismo, busca otra que se llame 'config' y abre 'db.js'".

import { procesarMensaje } from './nlp/chatbot.js'; 
// El "./" significa: "Quédate en esta misma carpeta, entra en 'nlp' y tráeme la función del chatbot".
import { crearActualizadorNegocio } from './actualizarNegocio.js';
import { validarHorariosRecogida } from '../shared/horariosRecogida.js';
import { crearConsultasZona } from './consultasZona.js';
import { crearBuscadorDirecciones } from './direcciones.js';
import { crearOperacionesPago } from './pagos.js';
import { crearResolversImagenesMenu, crearPlatoConItems } from './imagenesMenu.js';
import { crearEditorPlato } from './editarPlato.js';
import { protegerResolvers, exigirCuentaPropia, exigirLocalPropio } from './permisos.js';
import { crearServicioCompras } from './compras.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const operacionesPago = crearOperacionesPago(pool, stripe);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "843824368024-1tkoj6d49643fmj3puiab75roa60ig10.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const eventEmitter = new EventEmitter();
const PEDIDO_CREADO = 'PEDIDO_CREADO';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


const compras = crearServicioCompras(pool, stripe, {
  notificar: async (compra, pedidos, conexion) => {
    const usuario = (await conexion.query('SELECT email, nombre FROM Usuarios WHERE id_usuario = $1', [compra.id_usuario])).rows[0];
    for (const pedido of pedidos) eventEmitter.emit(PEDIDO_CREADO, { nuevoPedido: pedido });
    if (usuario?.email) await transporter.sendMail({
      from: `"NexBite" <${process.env.EMAIL_USER}>`, to: usuario.email,
      subject: compra.estado === 'RESERVADA' ? 'Reserva confirmada en NexBite' : 'Pedido confirmado en NexBite',
      text: `Hola ${usuario.nombre}, hemos guardado tu pedido completo en ${compra.resumen.nombre_restaurante}. Total: ${(compra.total_centimos / 100).toFixed(2)} €.${compra.solicitud.fecha_programada ? ' La reserva mantiene la fecha elegida. Con tarjeta, el importe se autoriza ahora y se cobra cuando se active el pedido.' : ''}`,
    });
  },
});

export const procesarComprasPendientes = () => compras.procesarPendientes();

const calcularExpiracion = (tiempoStr) => {
  if (!tiempoStr || tiempoStr === 'Indefinido') return null;

  const opcionesPredefinidas = ['30 minutos', '1 hora', '2 horas', '1 día', '2 días', '1 semana'];

  if (!opcionesPredefinidas.includes(tiempoStr)) {
    const fechaPersonalizada = new Date(tiempoStr);
    if (!isNaN(fechaPersonalizada.getTime())) {
      return fechaPersonalizada;
    }
  }

  const ahora = new Date();
  if (tiempoStr === '30 minutos') ahora.setMinutes(ahora.getMinutes() + 30);
  else if (tiempoStr === '1 hora') ahora.setHours(ahora.getHours() + 1);
  else if (tiempoStr === '2 horas') ahora.setHours(ahora.getHours() + 2);
  else if (tiempoStr === '1 día') ahora.setDate(ahora.getDate() + 1);
  else if (tiempoStr === '2 días') ahora.setDate(ahora.getDate() + 2);
  else if (tiempoStr === '1 semana') ahora.setDate(ahora.getDate() + 7);

  return ahora;
};

const resolversBase = {
  Plato: crearResolversImagenesMenu(pool),
  Pedido: {
    imagen_plato: async pedido => pedido.imagen_plato || (pedido.id_plato ? (await pool.query('SELECT p.imagen_url FROM Menu_Platos mp JOIN Platos p ON p.id_plato = mp.id_plato_incluido JOIN Platos m ON m.id_plato = mp.id_menu WHERE mp.id_menu = $1 AND p.id_restaurante = m.id_restaurante AND p.imagen_url IS NOT NULL ORDER BY p.id_plato LIMIT 1', [pedido.id_plato])).rows[0]?.imagen_url || null : null),
  },
  // ============================================================================
// EL OPERADOR SPREAD (...): VOLCANDO EL CONTENIDO (EL EJEMPLO DE LA CARTA)
// ============================================================================

// El objeto 'Query' es la Carta Principal del restaurante (tu servidor).
// Aquí es donde el cliente (el frontend) mira para ver qué acciones puede pedir.
Query: {
  
  // 1. EL PROBLEMA SI NO USAMOS (...)
  // Si escribiéramos esto sin los tres puntos, estaríamos metiendo la carpeta 
  // entera del pastelero dentro de la carta. GraphQL (el camarero) se haría 
  // un lío porque encontraría "carpetas dentro de carpetas" en lugar de 
  // una lista clara de acciones.
  
  // 2. LA SOLUCIÓN: LA ORDEN DE "VACIADO" (...)
  // Los tres puntos le dicen a JavaScript: "Abre el archivo de operacionesPago, 
  // saca todas sus funciones sueltas y escríbelas directamente aquí, 
  // en la lista principal".
  ...operacionesPago.Query,
  
  // Hacemos exactamente lo mismo con el archivo de compras (la lista del barman).
  // Sacamos todas sus funciones y las volcamos en esta misma lista, justo debajo.
  ...compras.Query,
  
  // 3. EL RESULTADO FINAL INVISIBLE
  // Gracias a los ..., el servidor GraphQL no ve archivos separados. 
  // Ve una lista única, plana y perfecta con TODAS las funciones listas para 
  // usarse. Esto te permite tener tu código súper ordenado en 20 archivos 
  // distintos, pero que el servidor los lea todos como si fuera uno solo.
    ...crearConsultasZona(pool),
    ...crearBuscadorDirecciones(),
    obtenerTags: async () => (await pool.query('SELECT * FROM Preferencias_Tags')).rows,
    obtenerRecomendaciones: async (_, { id_usuario, limit = 20, offset = 0 }) => (await pool.query(`SELECT p.id_plato, p.nombre, p.descripcion, p.precio, r.nombre AS restaurante, COUNT(pt.id_tag) AS coincidencias FROM Platos p JOIN Restaurantes r ON p.id_restaurante = r.id_restaurante JOIN Plato_Tags pt ON p.id_plato = pt.id_plato JOIN Usuario_Preferencias up ON pt.id_tag = up.id_tag WHERE up.id_usuario = $1 GROUP BY p.id_plato, p.nombre, p.descripcion, p.precio, r.nombre ORDER BY coincidencias DESC LIMIT $2 OFFSET $3;`, [id_usuario, limit, offset])).rows,
    
    chatearConBot: async (_, args, contexto) => {
      try {
        const textoUsuario = args.mensaje || args.texto || "";
        console.log("📩 LLEGÓ PETICIÓN A RESOLVERS.JS:", textoUsuario);
        const respuesta = await procesarMensaje(textoUsuario, contexto, pool, compras);
        return respuesta;
      } catch (error) {
        console.error("Error en el chatbot:", error);
        return "Lo siento, ha ocurrido un error interno en el soporte.";
      }
    },

    obtenerMiRestaurante: async (_, __, contexto) => {
      if (!contexto.usuario || contexto.usuario.rol !== 'VENDEDOR') return null;
      return (await pool.query('SELECT * FROM Restaurantes WHERE id_usuario_dueño = $1', [contexto.usuario.id_usuario])).rows[0] || null;
    },

    obtenerMisRestaurantes: async (_, __, contexto) => {
      if (!contexto.usuario || contexto.usuario.rol !== 'VENDEDOR') return [];
      const res = await pool.query('SELECT * FROM Restaurantes WHERE id_usuario_dueño = $1 ORDER BY id_restaurante DESC', [contexto.usuario.id_usuario]);
      const ahora = new Date();
      for (let rest of res.rows) {
        if (rest.aceptando_pedidos === false && rest.tiempo_reactivacion) {
          if (ahora >= new Date(rest.tiempo_reactivacion)) {
            await pool.query('UPDATE Restaurantes SET aceptando_pedidos = true, tiempo_reactivacion = NULL WHERE id_restaurante = $1', [rest.id_restaurante]);
            rest.aceptando_pedidos = true;
          }
        }
      }
      return res.rows;
    },

    obtenerRestaurantePorId: async (_, { id_restaurante }) => {
      const res = await pool.query('SELECT * FROM Restaurantes WHERE id_restaurante = $1', [id_restaurante]);
      if (res.rows.length === 0) return null;
      let rest = res.rows[0];
      if (rest.aceptando_pedidos === false && rest.tiempo_reactivacion) {
        if (new Date() >= new Date(rest.tiempo_reactivacion)) {
          await pool.query('UPDATE Restaurantes SET aceptando_pedidos = true, tiempo_reactivacion = NULL WHERE id_restaurante = $1', [rest.id_restaurante]);
          rest.aceptando_pedidos = true;
          rest.tiempo_reactivacion = null;
        }
      }
      return rest;
    },



    //////////////////////////////////////////












    
    // ============================================================================
// RESOLVER RAÍZ: LA PUERTA DE ENTRADA AL MENÚ DEL RESTAURANTE
// ============================================================================

// 'obtenerMenuRestaurante' es el nombre de la función que el cliente (la app) 
// llama cuando quiere ver la carta.
obtenerMenuRestaurante: async (
  
  // --------------------------------------------------------------------------
  // POSICIÓN 1: EL PADRE (LA MANO IZQUIERDA DEL MENSAJERO)
  // --------------------------------------------------------------------------
  // Por reglas del motor de GraphQL, esta posición siempre recibe el resultado 
  // de la búsqueda anterior. 
  // Como esta es la consulta inicial (el cliente acaba de abrir la app y no hay 
  // pasos previos), esta caja nos llega completamente vacía.
  // 
  // ¿Por qué ponemos el guion bajo '_'? 
  // Actúa como un "cono de tráfico". Le dice a JavaScript: "Sé que me obligas 
  // a recibir un dato aquí, pero como es inútil, lo marco con un guion bajo 
  // para tirarlo a la basura e impedir que la Posición 2 se ruede hacia la izquierda".
  _, 
  
  // --------------------------------------------------------------------------
  // POSICIÓN 2: LOS ARGUMENTOS (LA MANO DERECHA DEL MENSAJERO)
  // --------------------------------------------------------------------------
  // Esta posición recibe el paquete con lo que el usuario ha tecleado en su móvil 
  // (un Objeto que podría traer muchas variables mezcladas).
  // 
  // ¿Por qué usamos llaves { }? (Object Destructuring)
  // En lugar de meter todo el paquete entero a la cocina, usamos las llaves 
  // para abrir la caja directamente en la puerta de entrada. Extraemos 
  // quirúrgicamente solo el número que nos interesa ('id_restaurante') y el 
  // resto de variables (si las hubiera) se destruyen para proteger el servidor.
  { id_restaurante }

) => {
  // 'async' avisa a Node.js: "A partir de esta flecha (=>), voy a tener que 
  // ir a la base de datos (la cocina). No me esperes bloqueado, atiende a otros 
  // clientes mientras yo busco los datos, porque voy a tardar unos milisegundos".
  
  // ... aquí iría el código SQL para buscar los platos (el await)
      const res = await pool.query('SELECT * FROM Platos WHERE id_restaurante = $1', [id_restaurante]);
      const ahora = new Date();
      for (let plato of res.rows) {
        if (plato.disponible === false && plato.tiempo_disponible) {
          if (ahora >= new Date(plato.tiempo_disponible)) {
            await pool.query('UPDATE Platos SET disponible = true, tiempo_disponible = NULL WHERE id_plato = $1', [plato.id_plato]);
            plato.disponible = true;
            plato.tiempo_disponible = null;
          }
        }
      }
      return res.rows;
    },

    obtenerMasVendidos: async (_, { id_restaurante }) => (await pool.query(`SELECT pl.*, COUNT(pe.id_pedido) as ventas FROM Platos pl JOIN Pedidos pe ON pl.id_plato = pe.id_plato WHERE pl.id_restaurante = $1 GROUP BY pl.id_plato ORDER BY ventas DESC LIMIT 5;`, [id_restaurante])).rows,

    obtenerPlatosPorCategoria: async (_, { categoria }) => (await pool.query(`SELECT p.* FROM Platos p JOIN Plato_Tags pt ON p.id_plato = pt.id_plato JOIN Preferencias_Tags t ON pt.id_tag = t.id_tag WHERE $1 = ANY(p.categoria);`, [categoria])).rows,

    obtenerRestaurantesSimilares: async (_, { id_restaurante }) => (await pool.query(`SELECT r2.* FROM Restaurantes r1 JOIN Restaurantes r2 ON r1.tipo = r2.tipo AND r1.id_restaurante != r2.id_restaurante WHERE r1.id_restaurante = $1 LIMIT 5;`, [id_restaurante])).rows,

    obtenerPedidosVendedor: async (_, { id_restaurante }) => (await pool.query(`SELECT pe.*, c.estado AS estado_pago, c.motivo AS mensaje_pago, COALESCE(pe.nombre_producto, pl.nombre) AS nombre_plato, pl.imagen_url AS imagen_plato FROM Pedidos pe LEFT JOIN Platos pl ON pe.id_plato = pl.id_plato LEFT JOIN Compras c ON c.id_compra = pe.id_compra WHERE pe.id_restaurante = $1 ORDER BY pe.id_pedido DESC`, [id_restaurante])).rows,


    // ============================================================================
// FUNCIÓN SQL COALESCE (MANEJO DE VALORES NULOS / FALLBACKS)
// ============================================================================

// COALESCE(arg1, arg2, ..., argN) es una función estándar de SQL que evalúa 
// sus argumentos en orden y devuelve el primer valor que NO sea NULL.
//
// Propósito arquitectónico:
// Se utiliza como un mecanismo de "Fallback" (respaldo) o valor por defecto. 
// En bases de datos relacionales, es común tener campos condicionales (ej. un 
// alias personalizado que sobrescribe el nombre por defecto). 
// COALESCE previene que la consulta retorne NULL a la aplicación (lo que 
// podría causar errores de Frontend), asegurando que siempre se entregue 
// un dato válido basado en una jerarquía de prioridades.
    obtenerPedidosCliente: async (_, { id_usuario }) => {
      const res = await pool.query(`
        SELECT pe.id_pedido, pe.id_restaurante, pe.id_plato, pe.estado, pe.metodo_pago, pe.direccion_envio, pe.fecha_programada, pe.fecha_pedido, pe.id_compra, c.estado AS estado_pago, c.motivo AS mensaje_pago,
               COALESCE(pe.nombre_producto, pl.nombre) AS nombre_plato, COALESCE(pe.precio_centimos / 100.0, pl.precio) AS precio_plato, pl.disponible AS plato_disponible, pl.descripcion AS descripcion_plato, pl.imagen_url AS imagen_plato,
               r.nombre AS nombre_restaurante, r.imagen_url AS imagen_restaurante, r.aceptando_pedidos AS restaurante_abierto
        FROM Pedidos pe
        LEFT JOIN Platos pl ON pe.id_plato = pl.id_plato
        LEFT JOIN Restaurantes r ON pe.id_restaurante = r.id_restaurante
        LEFT JOIN Compras c ON c.id_compra = pe.id_compra
        WHERE pe.id_usuario = $1
        ORDER BY pe.id_pedido DESC
      `, [id_usuario]);
      return res.rows;
    },

    obtenerPerfilUsuario: async (_, { id_usuario }) => {
      const res = await pool.query('SELECT * FROM Usuarios WHERE id_usuario = $1', [id_usuario]);
      return res.rows[0];
    },

    obtenerResenasRestaurante: async (
  
  // 1. LA FIRMA DE GRAPHQL (POSICIONES ESTRICTAS)
  // El '_' (Posición 1): Ocupa el espacio del 'parent' vacío. Actúa como un cono de 
  // tráfico para que la Posición 2 no se ruede hacia la izquierda.
  // El '{ id_restaurante }' (Posición 2): Usa "Destructuring" para abrir la caja 
  // de argumentos del cliente en la misma puerta, extrayendo solo el ID y 
  // descartando posibles datos basura o maliciosos.
  _, { id_restaurante }

) => {
  
  // 2. EL PLAN A: EL INTENTO (BLOQUE TRY)
  // 'async' permite usar 'await'. El servidor intenta ejecutar esto, pausando 
  // la función (sin bloquear a otros usuarios) hasta que la base de datos responda.
  try {
    const result = await pool.query(
      
      // 3. LA CONSULTA SQL (JOIN Y PARÁMETROS DE SEGURIDAD)
      // Se usa un JOIN normal para fusionar la tabla 'resenas' con 'Usuarios', 
      // de modo que la app pueda mostrar el nombre del cliente que dejó el comentario.
      `SELECT r.id_resena, u.nombre AS nombre_usuario, r.puntuacion, r.comentario, r.fecha 
       FROM resenas r 
       JOIN Usuarios u ON r.id_usuario = u.id_usuario 
       WHERE r.id_restaurante = $1 
       ORDER BY r.id_resena DESC`, // DESC: Las reseñas más nuevas salen primero.
      
      // 4. LOS CORCHETES DE MUNICIÓN (PARÁMETROS SQL)
      // Cargamos el 'id_restaurante' en estos corchetes para inyectarlo de forma 
      // segura en el hueco '$1'. Esto evita las Inyecciones SQL (hackeos).
      [id_restaurante]
    );
    
    // 5. DEVOLVER UNA COLECCIÓN (MÚLTIPLES FILAS)
    // Como un restaurante tiene MUCHAS reseñas (Relación 1:N), devolvemos 
    // la caja entera (result.rows). No usamos [0] porque eso borraría 
    // todas las reseñas excepto la primera.
    return result.rows;
    
  } 
  
  // 6. EL PLAN B: EL SALVAVIDAS (BLOQUE CATCH)
  // Si el servidor de base de datos se cae, o la consulta SQL falla, 
  // Node.js aborta el 'try' y salta directamente aquí para no colapsar.
  catch (error) {
    // Registramos el error de forma interna para que el programador lo lea.
    console.error("Error obteniendo reseñas:", error);
    
    // 7. DEVOLVER EL FALLBACK (GRACEFUL DEGRADATION)
    // LOS CORCHETES VACÍOS: Devolvemos un Array en blanco. La app del móvil 
    // esperaba una lista de reseñas; al darle una lista vacía, el móvil simplemente 
    // mostrará "No hay reseñas", evitando que la pantalla explote o se cuelgue.
    return [];
  }
}
  },

  // Los resolvers de campos calculan valores derivados, como la media de reseñas del local.
  // ============================================================================
// RESOLVER DE TIPO (FIELD RESOLVER): CALCULANDO DATOS EN VIVO
// ============================================================================

// Cuando GraphQL encuentra un objeto de tipo 'Restaurante', lee estas instrucciones
// para saber cómo rellenar sus campos especiales.
Restaurante: {
  
  // 1. EL USO REAL DE LA POSICIÓN 1 (EL TESTIGO DEL RELEVO)
  // ¿Recuerdas que antes poníamos un '_' porque no había paso previo?
  // Aquí SÍ hay paso previo. GraphQL ya buscó el restaurante en la base de datos 
  // y nos pasa todos sus datos en la caja de la izquierda: el 'parent' (el padre).
  calificacion: async (parent) => {
    try {
      
      // 2. EL CÁLCULO EN LA BASE DE DATOS (AVG)
      // Extraemos el ID del restaurante de esa caja padre (parent.id_restaurante).
      // AVG(puntuacion): Es una orden para PostgreSQL. Le decimos: "No me traigas 
      // todas las reseñas, coge todas las puntuaciones, súmalas, divídelas y 
      // devuélveme solo la media matemática".
      const res = await pool.query(
        'SELECT AVG(puntuacion) as media FROM resenas WHERE id_restaurante = $1', 
        [parent.id_restaurante]
      );
      
      // 3. EL OPERADOR TERNARIO (EL PLAN B EN UNA SOLA LÍNEA)
      // ¿Qué pasa si el restaurante es nuevo y no tiene NINGUNA reseña? 
      // La base de datos nos devolvería un NULL en la media.
      // Esta línea hace una pregunta (marcada por el '?'):
      // ¿Existe la media? 
      //   -> SI ES SÍ (antes de los dos puntos): conviértela a número decimal (parseFloat).
      //   -> SI ES NO (después de los dos puntos): devuelve un triste 0.0.
      return res.rows[0].media ? parseFloat(res.rows[0].media) : 0.0;
      
    } catch (error) {
      // 4. EL SALVAVIDAS (GRACEFUL DEGRADATION)
      // Si la base de datos explota, la app no se cuelga. El restaurante 
      // simplemente aparecerá con un 0.0 de nota en la pantalla.
      return 0.0;
    }
  }
},
  
  RestauranteConDistancia: {
    calificacion: async (parent) => {
      try {
        const res = await pool.query('SELECT AVG(puntuacion) as media FROM resenas WHERE id_restaurante = $1', [parent.id_restaurante]);
        return res.rows[0].media ? parseFloat(res.rows[0].media) : 0.0;
      } catch (error) {
        return 0.0;
      }
    }
  },
  
  // ============================================================================
// MUTATION: ACTUALIZANDO DATOS (FLUJO COMPLETO DE IDA Y VUELTA)
// ============================================================================

Mutation: {
  
  // 'actualizarPerfilUsuario' es la función llamada desde el móvil.
  // Al estar dentro de 'Mutation' (y no de Query), le indica al sistema 
  // que vamos a escribir o modificar datos, no solo a leerlos.
  actualizarPerfilUsuario: async (
    
    // 1. POSICIÓN 1 (EL PADRE): El guion bajo '_'
    // Ocupa el primer hueco obligatorio de GraphQL. Como esto es una operación 
    // principal (no hay paso previo), el dato 'parent' llega vacío. Usamos '_' 
    // como "cono de tráfico" para descartarlo y mantener las posiciones en orden.
    _, 
    
    // 2. POSICIÓN 2 (LOS ARGUMENTOS): Destructuring '{ ... }'
    // En lugar de meter toda la caja de datos enviada por el cliente, usamos 
    // las llaves para extraer en la misma puerta exactamente los tres datos 
    // que necesitamos. Si un atacante envía variables extra ocultas, se destruyen.
    { id_usuario, telefono, direccion }
    
  ) => {
    
    // 3. ASINCRONÍA ('async' y 'await')
    // Le decimos al servidor que espere la respuesta de la base de datos sin 
    // quedarse bloqueado. El restaurante sigue atendiendo a otros mientras tanto.
    const res = await pool.query(
      
      // 4. LA CONSULTA SQL Y EL VIAJE DE VUELTA (RETURNING *)
      // Hacemos el UPDATE. Como normalmente PostgreSQL solo responde "Ok, modificado", 
      // le añadimos 'RETURNING *'. Esto obliga a la base de datos a generar 
      // el "Viaje de Vuelta": nos devuelve la ficha completa del usuario 
      // (con todos sus campos, antiguos y nuevos) tal y como ha quedado.
      'UPDATE Usuarios SET telefono = $1, direccion = $2 WHERE id_usuario = $3 RETURNING *',
      
      // 5. EL VIAJE DE IDA (PARÁMETROS DE SEGURIDAD)
      // [telefono, direccion, id_usuario]
      // Esto NO es el resultado final. Es la munición que inyectamos en los 
      // huecos $1, $2 y $3. Al separarlo del texto SQL, evitamos Inyecciones SQL.
      [telefono, direccion, id_usuario]
    );
    
    // 6. EL DESEMPAQUETADO FINAL (res.rows[0])
    // PostgreSQL SIEMPRE devuelve los resultados dentro de una caja (Array: res.rows).
    // Como hemos actualizado a un solo cliente (buscado por su ID único), la caja 
    // trae exactamente una sola ficha dentro.
    // Usamos el índice [0] para abrir la caja, aislar el objeto limpio del perfil 
    // y enviárselo al móvil para que la pantalla se actualice al instante.
    return res.rows[0];
  
},

    // ============================================================================
// FLUJO COMPLETO: RECUPERACIÓN DE CONTRASEÑA (MUTATION)
// ============================================================================

solicitarRecuperacionPassword: async (
  
  // 1. LA PUERTA DE ENTRADA (GRAPHQL)
  // '_' -> Descartamos el paso anterior (parent).
  // '{ identificador }' -> Extraemos directamente lo que el usuario escribió 
  // en la app (puede ser su nombre o su correo).
  _, { identificador }

) => {
  
  // 2. PASO INTERMEDIO 1: BUSCAR AL USUARIO (Lectura)
  // ILIKE: Es el recepcionista tolerante. A diferencia del '=', ILIKE ignora 
  // las mayúsculas. Da igual si el usuario escribe "CARLOS@email.com" o "carlos@email.com".
  // Usamos 'const res =' porque necesitamos leer lo que devuelve la caja.
  // NO hay 'return' aquí porque la función no ha terminado.
  const res = await pool.query(
    'SELECT id_usuario, nombre, email FROM Usuarios WHERE email ILIKE $1 OR nombre ILIKE $1', 
    [identificador]
  );

  // 3. LA COMPROBACIÓN DE LA CAJA
  // Si la caja tiene más de 0 papeles dentro, significa que el usuario sí existe.
  if (res.rows.length > 0) {
    
    // Abrimos la caja y sacamos el primer y único papel (la ficha del usuario).
    const usuario = res.rows[0];
    
    // Fabricamos la llave temporal (token) y le damos 1 hora de vida.
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 3600000);

    // 4. PASO INTERMEDIO 2: GUARDAR LA LLAVE (Escritura esperada con await)
    // Actualizamos la base de datos con el token temporal.
    // NO usamos 'const res =' ni 'RETURNING *' porque no necesitamos leer 
    // cómo quedó la fila, solo necesitamos que PostgreSQL anote el dato.
    await pool.query(
      'UPDATE Usuarios SET reset_token = $1, reset_token_expira = $2 WHERE id_usuario = $3', 
      [token, expira, usuario.id_usuario]
    );

    // Preparamos el enlace mágico que el usuario pinchará en su correo.
    const resetLink = `http://localhost:5173/?resetToken=${token}`;

    console.log(`\n🔍 Recuperación solicitada para: ${identificador}`);
    console.log(`📧 Intentando enviar correo a: ${usuario.email}...`);

    // 5. EL PLAN DE EMERGENCIA PARA EL CORREO (try / catch)
    // Enviar correos depende de un servidor externo (ej. Gmail, SendGrid).
    // Si ese servidor externo está caído, el código fallará. Al envolverlo 
    // en un try/catch, evitamos que nuestro servidor se bloquee.
    try {
      await transporter.sendMail({
        from: `"Soporte NexBite" <${process.env.EMAIL_USER}>`,
        to: usuario.email,
        subject: '🔒 Restablecer contraseña - NexBite',
        // El enlace real debe incluirse en el correo; un texto de ejemplo impediría recuperarla.
        html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ff4500;">Hola ${usuario.nombre},</h2>
                <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en NexBite.</p>
                <p>Este enlace es de un solo uso y <b>caducará en 1 hora</b> por motivos de seguridad.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="background-color: #0066cc; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Restablecer Mi Contraseña</a>
                </div>
                <p style="font-size: 12px; color: #666;">Si no has solicitado este cambio, puedes ignorar este correo de forma segura. Tu cuenta sigue protegida.</p>
              </div>
            `
      });
      console.log("✅ ¡Correo enviado con éxito!");
    } catch (error) {
      console.error("❌ ERROR AL ENVIAR CORREO:", error.message);
    }
    
  } else {
    // Si la caja (res.rows) venía vacía, el usuario no existe.
    // Solo lo registramos en nuestra terminal interna por seguridad.
    console.log(`⚠️ ALERTA: Alguien intentó recuperar la cuenta '${identificador}' pero no existe en la base de datos.`);
  }

  // 6. LA PUERTA DE SALIDA (EL RETURN DEFINITIVO Y DE SEGURIDAD)
  // Fíjate que devolvemos ESTE mismo mensaje TANTO SI el usuario existía COMO SI NO.
  // ¿Por qué? Si le dijéramos "El usuario no existe", un hacker podría probar 
  // miles de correos para descubrir quién está registrado en la app.
  return "Si el usuario o correo existe en nuestra base de datos, te hemos enviado un enlace para restablecer la contraseña.";
},

    // ============================================================================
// SEGURIDAD CRIPTOGRÁFICA: BCRYPT Y CONTRASEÑAS
// ============================================================================

restablecerPassword: async (_, { token, nueva_password }) => {
  
  // 1. VERIFICAR LA LLAVE (El SELECT)
  // Comprobamos si el token existe Y si todavía es válido (NOW() es la hora actual).
  const res = await pool.query(
    'SELECT id_usuario, password_hash FROM Usuarios WHERE reset_token = $1 AND reset_token_expira > NOW()', 
    [token]
  );

  // Si la caja viene vacía, la llave es falsa o ha caducado. 
  // 'throw new Error' expulsa al usuario inmediatamente y corta la función.
  if (res.rows.length === 0) {
    throw new Error('⛔ El enlace de recuperación es inválido o ha caducado. Por favor, solicita uno nuevo.');
  }

  // Extraemos la ficha del usuario.
  const usuario = res.rows[0];
  
  // 2. LA PRUEBA DEL SABOR (COMPARE)
  // bcryp.compare() no descifra la contraseña vieja. Lo que hace es "batir" 
  // la 'nueva_password' y comprobar si el resultado coincide exactamente con 
  // el puré viejo ('usuario.password_hash').
  const esMismaPassword = await bcrypt.compare(nueva_password, usuario.password_hash);

  // Si los dos purés son iguales, le decimos que no puede reciclar la contraseña.
  if (esMismaPassword) {
    throw new Error('⚠️ La nueva contraseña no puede ser igual a la actual. Por favor, elige una diferente.');
  }

  // 3. GENERAR LA SAL (SALT)
  // Fabricamos un texto aleatorio (Sal). El '10' significa 2^10 iteraciones. 
  // Esto hace que la encriptación tarde unos milisegundos extra, lo suficiente 
  // para que un hacker tarde años en probar combinaciones por fuerza bruta.
  const salt = await bcrypt.genSalt(10);
  
  // 4. ENCENDER LA BATIDORA (HASH)
  // Mezclamos la 'nueva_password' limpia con la 'salt' aleatoria.
  // El resultado es el 'nuevo_hash' (ej: $2b$10$wI8a5G... irreconocible).
  const nuevo_hash = await bcrypt.hash(nueva_password, salt);

  // 5. GUARDAR Y LIMPIAR (El UPDATE final)
  // Guardamos el nuevo hash en la base de datos.
  // IMPORTANTE: Ponemos 'reset_token = NULL' para destruir la llave temporal. 
  // Si no hiciéramos esto, un hacker podría usar el mismo enlace del correo 
  // una y otra vez hasta que caduque la hora.
  await pool.query(
    'UPDATE Usuarios SET password_hash = $1, reset_token = NULL, reset_token_expira = NULL WHERE id_usuario = $2', 
    [nuevo_hash, usuario.id_usuario]
  );

  // 6. LA PUERTA DE SALIDA
  return "✅ Tu contraseña ha sido actualizada con éxito. Ya puedes iniciar sesión.";
},

    ...operacionesPago.Mutation,
    ...compras.Mutation,

    solicitarAviso: async (_, { id_usuario, tipo, id_referencia }) => {
      const check = await pool.query('SELECT * FROM Alertas_Disponibilidad WHERE id_usuario = $1 AND tipo = $2 AND id_referencia = $3 AND email_enviado = FALSE', [id_usuario, tipo, id_referencia]);

      if (check.rows.length === 0) {
        await pool.query('INSERT INTO Alertas_Disponibilidad (id_usuario, tipo, id_referencia) VALUES ($1, $2, $3)', [id_usuario, tipo, id_referencia]);
      }

      return "Te avisaremos por correo cuando vuelva a estar disponible 📩";
    },

    registrarUsuario: async (_, { nombre, email, password, rol = 'CLIENTE' }) => {
      if (!['CLIENTE', 'VENDEDOR'].includes(rol)) throw new Error('Selecciona un tipo de cuenta válido.');
      const emailExistente = await pool.query('SELECT id_usuario FROM Usuarios WHERE email = $1', [email]);

      if (emailExistente.rows.length > 0) {
        throw new Error('El correo ya está siendo usado por otra persona.');
      }

      const nombreExistente = await pool.query('SELECT id_usuario FROM Usuarios WHERE nombre = $1', [nombre]);

      if (nombreExistente.rows.length > 0) {
        throw new Error('Este nombre de usuario ya está en uso. Por favor, elige otro.');
      }

      // ============================================================================
// SEGURIDAD CRIPTOGRÁFICA: GENERACIÓN DEL HASH DE CONTRASEÑA
// ============================================================================

// 1. PREPARANDO LAS ESPECIAS SECRETAS (EL SALT)
// bcrypt: Es la librería externa que hemos descargado (nuestra batidora industrial).
// genSalt(10): Genera el "Salt", que NO es un simple número, sino una cadena 
// aleatoria de letras y símbolos. El número '10' es el "Cost Factor": obliga a 
// la máquina a dar miles de vueltas para que el cálculo sea intencionadamente 
// lento y frustre los ataques de los hackers.
// 'await': Como es un proceso lento, pausamos esta función para no bloquear el servidor.
const salt = await bcrypt.genSalt(10);

// 2. CREANDO EL PURÉ IRREVERSIBLE (EL HASH)
// .hash(): Es el método (botón de encendido) integrado en la librería externa.
// Toma exactamente dos valores: la 'password' original (texto legible) y 
// el 'salt' (las especias).
// IMPORTANTE: Esto NO es "encriptar" (que se puede revertir), esto es "hashear" 
// (un viaje de destrucción de solo ida). El resultado es un código indescifrable 
// que guardaremos en la base de datos para proteger al usuario.
const password_hash = await bcrypt.hash(password, salt);
      const res = await pool.query(
        'INSERT INTO Usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id_usuario, nombre, email, rol, puntos_acumulados',
        [nombre, email, password_hash, rol]
      );

      // ============================================================================
// JWT (JSON WEB TOKEN): FABRICANDO EL PASE VIP DEL USUARIO
// ============================================================================

// jwt.sign() es la máquina que fabrica las pulseras. Toma 3 argumentos clave.
const token = jwt.sign(
  
  // 1. EL PAYLOAD (Los datos públicos)
  // ¿Por qué usamos res.rows[0]? Porque venimos de hacer un SELECT en la base 
  // de datos. De esa ficha única extraemos su 'id' y su 'rol'.
  // Propósito: Cuando el usuario vuelva mañana a pedir un plato, el servidor 
  // solo tendrá que leer esta pulsera para saber quién es y si tiene permisos 
  // (sin tener que ir a buscarlo a la base de datos otra vez).
  { id_usuario: res.rows[0].id_usuario, rol: res.rows[0].rol },
  
  // 2. LA FIRMA SECRETA (El sello holográfico anti-falsificaciones)
  // 'process.env' es una caja fuerte del servidor donde se guardan las contraseñas 
  // del sistema. 'JWT_SECRET' es un texto larguísimo que solo el servidor conoce.
  // Propósito: El servidor mezcla matemáticamente los datos del usuario con este 
  // secreto. Si un hacker intenta modificar su pulsera para ponerse "rol: admin", 
  // el sello matemático se romperá y el servidor sabrá que es falsa.
  process.env.JWT_SECRET,
  
  // 3. LA CADUCIDAD (El tiempo de vida)
  // { expiresIn: '7d' } significa que en 7 días la pulsera dejará de funcionar.
  // Propósito: Si al usuario le roban el móvil, el hacker no tendrá acceso 
  // infinito a la cuenta. En 7 días el token caduca y el sistema exigirá 
  // meter el email y la contraseña de nuevo.
  { expiresIn: '7d' }
);

// El resultado (const token) es un texto larguísimo (ej: "eyJhbGciOiJIUzI1..."), 
// que es lo que le enviarás al móvil para que lo guarde en su memoria interna.

      transporter.sendMail({
        from: `"NexBite" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '¡Bienvenido!',
        html: `<h2>¡Hola, ${nombre}!</h2>`
      }).catch(e => console.log(e));

      return { ...res.rows[0], token };
    },

    iniciarSesion: async (_, { email, password }) => {
      const res = await pool.query('SELECT * FROM Usuarios WHERE email = $1', [email]);

      if (!res.rows[0] || !(await bcrypt.compare(password, res.rows[0].password_hash))) {
        throw new Error('Credenciales incorrectas');
      }

      return {
        ...res.rows[0],
        token: jwt.sign(
          { id_usuario: res.rows[0].id_usuario, rol: res.rows[0].rol },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        )
      };
    },

    iniciarSesionGoogle: async (_, { token_google, rol = 'CLIENTE' }) => {
      if (!['CLIENTE', 'VENDEDOR'].includes(rol)) throw new Error('Selecciona un tipo de cuenta válido.');
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: token_google,
          audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, name } = payload;

        const res = await pool.query('SELECT * FROM Usuarios WHERE email = $1', [email]);
        let usuario = res.rows[0];

        if (!usuario) {
          const dummyPassword = await bcrypt.hash(Math.random().toString(36).slice(-12), 10);
          const insertRes = await pool.query(
            'INSERT INTO Usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id_usuario, nombre, email, rol, puntos_acumulados',
            [name, email, dummyPassword, rol]
          );

          usuario = insertRes.rows[0];

          transporter.sendMail({
            from: `"NexBite" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '¡Bienvenido a NexBite!',
            html: `<h2>¡Hola, ${name}!</h2><p>Gracias por registrarte usando tu cuenta de Google.</p>`
          }).catch(e => console.log(e));
        }

        const token = jwt.sign(
          { id_usuario: usuario.id_usuario, rol: usuario.rol },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        return { ...usuario, token };
      } catch (error) {
        throw new Error('No se pudo autenticar con Google. Token inválido.');
      }
    },

    guardarPreferencias: async (_, { id_usuario, tags }) => {
      const conexion = await pool.connect();
      try {
        await conexion.query('BEGIN');
        await conexion.query('DELETE FROM Usuario_Preferencias WHERE id_usuario = $1', [id_usuario]);
        if (tags.length) await conexion.query('INSERT INTO Usuario_Preferencias (id_usuario, id_tag) SELECT $1, unnest($2::int[])', [id_usuario, [...new Set(tags)]]);
        await conexion.query('COMMIT');
        return 'Preferencias guardadas.';
      } catch (error) { await conexion.query('ROLLBACK'); throw error; }
      finally { conexion.release(); }
    },

    crearPedido: async (_, { id_usuario }, contexto) => {
      exigirCuentaPropia(contexto, id_usuario);
      throw new Error('Actualiza la página: el pedido completo se confirma desde el carrito.');
    },

    registrarNegocio: async (_, {
      nombre,
      tipo,
      latitud,
      longitud,
      imagen_url,
      radio_cobertura_km,
      telefono,
      direccion,
      horarios_recogida
    }, contexto) => {
      if (!contexto.usuario) throw new Error('Inicia sesión para registrar un negocio.');
      const horarios = horarios_recogida == null ? null : validarHorariosRecogida(horarios_recogida);
      const radioFinal = radio_cobertura_km || 10.0;

      const res = await pool.query(
        'INSERT INTO Restaurantes (nombre, tipo, latitud, longitud, id_usuario_dueño, imagen_url, radio_cobertura_km, telefono, direccion, horarios_recogida) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) RETURNING *',
        [nombre, tipo, latitud, longitud, contexto.usuario.id_usuario, imagen_url, radioFinal, telefono, direccion, horarios === null ? null : JSON.stringify(horarios)]
      );

      await pool.query(
        'UPDATE Usuarios SET rol = $1 WHERE id_usuario = $2',
        ['VENDEDOR', contexto.usuario.id_usuario]
      );

      return res.rows[0];
    },

    actualizarNegocio: crearActualizadorNegocio(pool),

    crearPlato: crearPlatoConItems(pool),
    actualizarPlato: crearEditorPlato(pool),

    alternarFavorito: async (_, { id_restaurante }, ctx) => {
      const existe = await pool.query(
        'SELECT * FROM Favoritos WHERE id_usuario = $1 AND id_restaurante = $2',
        [ctx.usuario.id_usuario, id_restaurante]
      );

      if (existe.rows.length > 0) {
        await pool.query(
          'DELETE FROM Favoritos WHERE id_usuario = $1 AND id_restaurante = $2',
          [ctx.usuario.id_usuario, id_restaurante]
        );
        return "❌ Eliminado.";
      } else {
        await pool.query(
          'INSERT INTO Favoritos (id_usuario, id_restaurante) VALUES ($1, $2)',
          [ctx.usuario.id_usuario, id_restaurante]
        );
        return "❤ Añadido.";
      }
    },

    alternarFavoritoPlato: async (_, { id_plato }, ctx) => {
      if (!ctx.usuario) {
        throw new Error('Debes iniciar sesión para añadir favoritos.');
      }

      const existe = await pool.query(
        'SELECT * FROM Platos_Favoritos WHERE id_usuario = $1 AND id_plato = $2',
        [ctx.usuario.id_usuario, id_plato]
      );

      if (existe.rows.length > 0) {
        await pool.query(
          'DELETE FROM Platos_Favoritos WHERE id_usuario = $1 AND id_plato = $2',
          [ctx.usuario.id_usuario, id_plato]
        );
        return "❌ Plato eliminado de favoritos.";
      } else {
        await pool.query(
          'INSERT INTO Platos_Favoritos (id_usuario, id_plato) VALUES ($1, $2)',
          [ctx.usuario.id_usuario, id_plato]
        );
        return "❤ Plato añadido a favoritos.";
      }
    },

    cambiarEstadoRestaurante: async (_, { id_restaurante, aceptando, tiempo }, contexto) => {
      if (!contexto.usuario || contexto.usuario.rol !== 'VENDEDOR') {
        throw new Error('Acceso denegado');
      }

      const tiempoFinal = aceptando ? null : calcularExpiracion(tiempo);

      const res = await pool.query(
        'UPDATE Restaurantes SET aceptando_pedidos = $1, tiempo_reactivacion = $2 WHERE id_restaurante = $3 RETURNING *',
        [aceptando, tiempoFinal, id_restaurante]
      );

      if (aceptando) {
        const alertas = await pool.query(
          `SELECT a.id_alerta, u.email, u.nombre
           FROM Alertas_Disponibilidad a
           JOIN Usuarios u ON a.id_usuario = u.id_usuario
           WHERE a.tipo = 'RESTAURANTE'
             AND a.id_referencia = $1
             AND a.email_enviado = FALSE`,
          [id_restaurante]
        );

        for (const alerta of alertas.rows) {
          transporter.sendMail({
            from: `"NexBite Delivery" <${process.env.EMAIL_USER}>`,
            to: alerta.email,
            subject: '🟢 ¡Tu restaurante favorito acaba de abrir!',
            text: `Hola ${alerta.nombre}, el restaurante ${res.rows[0].nombre} ya está abierto y aceptando pedidos de nuevo. ¡Haz tu pedido ya!`
          }).catch(console.error);

          await pool.query(
            'UPDATE Alertas_Disponibilidad SET email_enviado = TRUE WHERE id_alerta = $1',
            [alerta.id_alerta]
          );
        }

      }

      return res.rows[0];
    },

    marcarPlatoAgotado: async (_, { id_plato, disponible, tiempo }, contexto) => {
      if (!contexto.usuario || contexto.usuario.rol !== 'VENDEDOR') {
        throw new Error('Acceso denegado');
      }

      const res = await pool.query(
        'UPDATE Platos SET disponible = $1, tiempo_disponible = $2 WHERE id_plato = $3 RETURNING *',
        [disponible, calcularExpiracion(tiempo), id_plato]
      );

      if (disponible) {
        const alertas = await pool.query(
          `SELECT a.id_alerta, u.email, u.nombre
           FROM Alertas_Disponibilidad a
           JOIN Usuarios u ON a.id_usuario = u.id_usuario
           WHERE a.tipo = 'PLATO'
             AND a.id_referencia = $1
             AND a.email_enviado = FALSE`,
          [id_plato]
        );

        for (const alerta of alertas.rows) {
          transporter.sendMail({
            from: `"NexBite Delivery" <${process.env.EMAIL_USER}>`,
            to: alerta.email,
            subject: '🍲 ¡El plato que querías ya está disponible!',
            text: `Hola ${alerta.nombre}, buenas noticias: "${res.rows[0].nombre}" ya se puede pedir de nuevo. ¡No te quedes sin él!`
          }).catch(console.error);

          await pool.query(
            'UPDATE Alertas_Disponibilidad SET email_enviado = TRUE WHERE id_alerta = $1',
            [alerta.id_alerta]
          );
        }
      }

      return res.rows[0];
    },

    actualizarEstadoPedido: async (_, {
      id_pedido,
      nuevo_estado,
      motivo_rechazo,
      mensaje_personalizado
    }, contexto) => {
      const conexion = contexto.conexionConsulta;
      const res = await conexion.query(
        "UPDATE Pedidos SET estado = $1 WHERE id_pedido = $2 AND estado NOT IN ('ENTREGADO','CANCELADO','RECHAZADO') RETURNING *",
        [nuevo_estado, id_pedido]
      );

      const pedido = res.rows[0];
      if (!pedido) throw new Error('El pedido ha cambiado. Actualiza la lista.');
      const userRes = await conexion.query(
        'SELECT email, nombre FROM Usuarios WHERE id_usuario = $1',
        [pedido.id_usuario]
      );

      if (userRes.rows.length > 0) {
        const usuario = userRes.rows[0];
        let mensajeCuerpo = '';
        let asuntoCorreo = `🍔 Actualización de tu pedido NexBite (#${id_pedido})`;

        if (nuevo_estado === 'PREPARANDO' || nuevo_estado === 'EN COCINA') {
          mensajeCuerpo = `¡Hola ${usuario.nombre}! 🎉\n\nTu pedido ya se está preparando en la cocina. 🍳`;
        } else if (nuevo_estado === 'ENVIADO' || nuevo_estado === 'EN CAMINO') {
          mensajeCuerpo = `¡Hola ${usuario.nombre}! 🛵\n\n¡Tu pedido va en camino!`;
        } else if (nuevo_estado === 'ENTREGADO') {
          mensajeCuerpo = `¡Hola ${usuario.nombre}! ✅\n\nTu pedido ha sido entregado. ¡Que lo disfrutes!`;
        } else if (nuevo_estado === 'CANCELADO' || nuevo_estado === 'RECHAZADO') {
          mensajeCuerpo = `Hola ${usuario.nombre},\n\nTu pedido ha sido cancelado. ❌\n\n`;

          if (motivo_rechazo) {
            mensajeCuerpo += `📌 Motivo: ${motivo_rechazo}\n`;
          }

          if (mensaje_personalizado) {
            mensajeCuerpo += `💬 Mensaje: "${mensaje_personalizado}"\n`;
          }
        }

        transporter.sendMail({
          from: `"NexBite Delivery" <${process.env.EMAIL_USER}>`,
          to: usuario.email,
          subject: asuntoCorreo,
          text: mensajeCuerpo
        }).catch((error) => {
          console.error('Error correo:', error);
        });
      }

      return pedido;
    },

    eliminarRestaurante: async (_, { id_restaurante }) => {
      await pool.query(
        'DELETE FROM Restaurantes WHERE id_restaurante = $1',
        [id_restaurante]
      );
      return "Eliminado";
    },


    eliminarPlato: async (_, { id_plato }) => {
      await pool.query(
        'DELETE FROM Platos WHERE id_plato = $1',
        [id_plato]
      );
      return "Eliminado";
    },

    eliminarPedido: async (_, { id_pedido }) => {
      await pool.query(
        'DELETE FROM Pedidos WHERE id_pedido = $1',
        [id_pedido]
      );
      return "Pedido eliminado permanentemente";
    },
    
    crearResena: async (_, { id_restaurante, id_usuario, puntuacion, comentario }) => {
      try {
        const fecha = Date.now().toString();
        
        const result = await pool.query(
          `INSERT INTO resenas (id_restaurante, id_usuario, puntuacion, comentario, fecha) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [id_restaurante, id_usuario, puntuacion, comentario, fecha]
        );
        
        const userResult = await pool.query('SELECT nombre FROM Usuarios WHERE id_usuario = $1', [id_usuario]);
        const nombre_usuario = userResult.rows[0]?.nombre || 'Usuario';

        return { ...result.rows[0], nombre_usuario };
      } catch (error) {
        console.error("Error creando reseña:", error);
        throw new Error('No se pudo guardar la reseña');
      }
    }
  },

  // ============================================================================
// CASOS DE USO REALES DE SUBSCRIPTIONS EN FOOD-DELIVERY (SIN GPS)
// ============================================================================

// Aunque las GraphQL Subscriptions (WebSockets) son vitales para telemetría 
// continua (como tracking GPS), en arquitecturas de gestión de restaurantes 
// resuelven la "Sincronización de Estado Orientada a Eventos" (Event-Driven State):
//
// 1. Dashboard de Recepción (POS/Kitchen Display): Permite el empuje (Push) 
//    de nuevos registros (ej. `PedidoCreado`) directamente a la interfaz del 
//    restaurante en tiempo real, eliminando la necesidad de hacer "Long Polling" 
//    o refrescos manuales que saturarían la base de datos.
//
// 2. Transiciones de Máquina de Estados (State Machine transistions): 
//    Notifica al cliente instantáneamente sobre mutaciones en la columna `estado` 
//    (ej. PENDIENTE -> PREPARANDO -> LISTO_PARA_RECOGER) para actualizar la UI 
//    de seguimiento de forma reactiva.
//
// 3. Filtrado por Tópico (Topic Filtering): El parámetro `id_restaurante` 
//    actúa como un identificador de canal (Channel ID) en el patrón Pub/Sub, 
//    garantizando que los eventos se multiplexan y se emiten de forma aislada 
//    solo a los clientes autorizados de ese local.
  Subscription: {
    nuevoPedido: {
      subscribe: async function* (_, { id_restaurante }, contexto) {
        await exigirLocalPropio(pool, contexto, id_restaurante);
        for await (const [evento] of on(eventEmitter, PEDIDO_CREADO)) {
          if (String(evento.nuevoPedido.id_restaurante) === String(id_restaurante)) yield evento;
        }
      }
    }
  }
};

export const resolvers = protegerResolvers(pool, resolversBase, compras);
