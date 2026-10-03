import 'dotenv/config';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { EventEmitter, on } from 'events';
import pool from '../config/db.js';
import { procesarMensaje } from '../nlp/chatbot.js';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import Stripe from 'stripe';
import crypto from 'crypto';
import { crearActualizadorNegocio } from './actualizarNegocio.js';
import { validarHorariosRecogida, validarFechaRecogida } from '../shared/horariosRecogida.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

function calcularDistancia(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export const resolvers = {
  Query: {
    obtenerTags: async () => (await pool.query('SELECT * FROM Preferencias_Tags')).rows,
    obtenerRecomendaciones: async (_, { id_usuario, limit = 20, offset = 0 }) => (await pool.query(`SELECT p.id_plato, p.nombre, p.descripcion, p.precio, r.nombre AS restaurante, COUNT(pt.id_tag) AS coincidencias FROM Platos p JOIN Restaurantes r ON p.id_restaurante = r.id_restaurante JOIN Plato_Tags pt ON p.id_plato = pt.id_plato JOIN Usuario_Preferencias up ON pt.id_tag = up.id_tag WHERE up.id_usuario = $1 GROUP BY p.id_plato, p.nombre, p.descripcion, p.precio, r.nombre ORDER BY coincidencias DESC LIMIT $2 OFFSET $3;`, [id_usuario, limit, offset])).rows,
    chatearConBot: async (_, { mensaje }) => await procesarMensaje(mensaje),
    obtenerFavoritos: async (_, { id_usuario }) => (await pool.query('SELECT r.* FROM Restaurantes r JOIN Favoritos f ON r.id_restaurante = f.id_restaurante WHERE f.id_usuario = $1;', [id_usuario])).rows,

    obtenerPlatosFavoritos: async (_, { id_usuario }) => {
      const res = await pool.query(`
        SELECT p.* FROM Platos p
        JOIN Platos_Favoritos pf ON p.id_plato = pf.id_plato
        WHERE pf.id_usuario = $1;
      `, [id_usuario]);
      return res.rows;
    },

    obtenerRestaurantesCercanos: async (_, { latitud, longitud, radio_km = 5.0 }) => (await pool.query(`SELECT id_restaurante, nombre, tipo, latitud, longitud, radio_cobertura_km, (6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians($1)) * cos(radians(latitud)) * cos(radians(longitud) - radians($2)) + sin(radians($1)) * sin(radians(latitud)))))) AS distancia_km FROM Restaurantes WHERE latitud IS NOT NULL AND longitud IS NOT NULL AND (6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians($1)) * cos(radians(latitud)) * cos(radians(longitud) - radians($2)) + sin(radians($1)) * sin(radians(latitud)))))) <= $3 ORDER BY distancia_km ASC;`, [latitud, longitud, radio_km])).rows,

    buscarRestaurantes: async (_, { termino }) => {
      if (!termino || termino.trim() === '') return [];
      return (await pool.query('SELECT * FROM Restaurantes WHERE nombre ILIKE $1 OR tipo ILIKE $1 LIMIT 6', [`%${termino}%`])).rows;
    },

    buscarPlatos: async (_, { termino }) => {
      if (!termino || termino.trim() === '') return [];
      return (await pool.query('SELECT * FROM Platos WHERE nombre ILIKE $1 OR descripcion ILIKE $1 LIMIT 6', [`%${termino}%`])).rows;
    },

    obtenerPlatosDestacados: async () => {
      // Devuelve 8 platos aleatorios que estén disponibles para dar variedad en el inicio
      const res = await pool.query(`
        SELECT pl.*, r.nombre AS nombre_restaurante
        FROM Platos pl
        JOIN Restaurantes r ON pl.id_restaurante = r.id_restaurante
        WHERE pl.disponible = true
        ORDER BY RANDOM()
        LIMIT 8
      `);
      return res.rows;
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

    obtenerMejoresRestaurantes: async () => (await pool.query(`SELECT r.*, COUNT(p.id_pedido) as total_ventas FROM Restaurantes r LEFT JOIN Pedidos p ON r.id_restaurante = p.id_restaurante GROUP BY r.id_restaurante ORDER BY total_ventas DESC LIMIT 10;`)).rows,

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

    obtenerMenuRestaurante: async (_, { id_restaurante }) => {
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

    obtenerPedidosVendedor: async (_, { id_restaurante }) => (await pool.query(`SELECT pe.id_pedido, pe.id_restaurante, pe.estado, pe.metodo_pago, pe.direccion_envio, pl.nombre AS nombre_plato FROM Pedidos pe JOIN Platos pl ON pe.id_plato = pl.id_plato WHERE pe.id_restaurante = $1 ORDER BY pe.id_pedido DESC`, [id_restaurante])).rows,

    // Historial de pedidos con fechas y fotos del plato
    obtenerPedidosCliente: async (_, { id_usuario }) => {
      const res = await pool.query(`
        SELECT pe.id_pedido, pe.id_restaurante, pe.id_plato, pe.estado, pe.metodo_pago, pe.direccion_envio, pe.fecha_programada, pe.fecha_pedido,
               pl.nombre AS nombre_plato, pl.precio AS precio_plato, pl.disponible AS plato_disponible, pl.descripcion AS descripcion_plato, pl.imagen_url AS imagen_plato,
               r.nombre AS nombre_restaurante, r.imagen_url AS imagen_restaurante, r.aceptando_pedidos AS restaurante_abierto
        FROM Pedidos pe
        LEFT JOIN Platos pl ON pe.id_plato = pl.id_plato
        LEFT JOIN Restaurantes r ON pe.id_restaurante = r.id_restaurante
        WHERE pe.id_usuario = $1
        ORDER BY pe.id_pedido DESC
      `, [id_usuario]);
      return res.rows;
    },

    // Últimos pedidos con fechas y fotos del plato
    obtenerUltimosPedidos: async (_, { id_usuario }) => {
      const res = await pool.query(`
        SELECT pe.id_pedido, pe.id_restaurante, pe.id_plato, pe.estado, pe.metodo_pago, pe.direccion_envio, pe.fecha_programada, pe.fecha_pedido,
               pl.nombre AS nombre_plato, pl.precio AS precio_plato, pl.disponible AS plato_disponible, pl.descripcion AS descripcion_plato, pl.imagen_url AS imagen_plato,
               r.nombre AS nombre_restaurante, r.imagen_url AS imagen_restaurante, r.aceptando_pedidos AS restaurante_abierto
        FROM Pedidos pe
        LEFT JOIN Platos pl ON pe.id_plato = pl.id_plato
        LEFT JOIN Restaurantes r ON pe.id_restaurante = r.id_restaurante
        WHERE pe.id_usuario = $1
        ORDER BY pe.id_pedido DESC
        LIMIT 3
      `, [id_usuario]);
      return res.rows;
    },

    obtenerPerfilUsuario: async (_, { id_usuario }) => {
      const res = await pool.query('SELECT * FROM Usuarios WHERE id_usuario = $1', [id_usuario]);
      return res.rows[0];
    }
  },

  Mutation: {
    actualizarPerfilUsuario: async (_, { id_usuario, telefono, direccion }) => {
      const res = await pool.query(
        'UPDATE Usuarios SET telefono = $1, direccion = $2 WHERE id_usuario = $3 RETURNING *',
        [telefono, direccion, id_usuario]
      );
      return res.rows[0];
    },

    solicitarRecuperacionPassword: async (_, { identificador }) => {
      const res = await pool.query('SELECT id_usuario, nombre, email FROM Usuarios WHERE email ILIKE $1 OR nombre ILIKE $1', [identificador]);

      if (res.rows.length > 0) {
        const usuario = res.rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expira = new Date(Date.now() + 3600000);

        await pool.query('UPDATE Usuarios SET reset_token = $1, reset_token_expira = $2 WHERE id_usuario = $3', [token, expira, usuario.id_usuario]);

        const resetLink = `http://localhost:5173/?resetToken=${token}`;

        console.log(`\n🔍 Recuperación solicitada para: ${identificador}`);
        console.log(`📧 Intentando enviar correo a: ${usuario.email}...`);

        try {
          await transporter.sendMail({
            from: `"Soporte NexBite" <${process.env.EMAIL_USER}>`,
            to: usuario.email,
            subject: '🔒 Restablecer contraseña - NexBite',
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
        console.log(`⚠️ ALERTA: Alguien intentó recuperar la cuenta '${identificador}' pero no existe en la base de datos.`);
      }

      return "Si el usuario o correo existe en nuestra base de datos, te hemos enviado un enlace para restablecer la contraseña.";
    },

    restablecerPassword: async (_, { token, nueva_password }) => {
      const res = await pool.query('SELECT id_usuario, password_hash FROM Usuarios WHERE reset_token = $1 AND reset_token_expira > NOW()', [token]);

      if (res.rows.length === 0) {
        throw new Error('⛔ El enlace de recuperación es inválido o ha caducado. Por favor, solicita uno nuevo.');
      }

      const usuario = res.rows[0];
      const esMismaPassword = await bcrypt.compare(nueva_password, usuario.password_hash);

      if (esMismaPassword) {
        throw new Error('⚠️ La nueva contraseña no puede ser igual a la actual. Por favor, elige una diferente.');
      }

      const salt = await bcrypt.genSalt(10);
      const nuevo_hash = await bcrypt.hash(nueva_password, salt);

      await pool.query('UPDATE Usuarios SET password_hash = $1, reset_token = NULL, reset_token_expira = NULL WHERE id_usuario = $2', [nuevo_hash, usuario.id_usuario]);

      return "✅ Tu contraseña ha sido actualizada con éxito. Ya puedes iniciar sesión.";
    },

    crearIntencionPago: async (_, { monto }) => {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(monto * 100),
          currency: 'eur',
          automatic_payment_methods: { enabled: true },
        });
        return paymentIntent.client_secret;
      } catch (error) {
        console.error("Error al crear intención de pago en Stripe:", error);
        throw new Error("No se pudo conectar con la pasarela de pago.");
      }
    },

    solicitarAviso: async (_, { id_usuario, tipo, id_referencia }) => {
      const check = await pool.query('SELECT * FROM Alertas_Disponibilidad WHERE id_usuario = $1 AND tipo = $2 AND id_referencia = $3 AND email_enviado = FALSE', [id_usuario, tipo, id_referencia]);

      if (check.rows.length === 0) {
        await pool.query('INSERT INTO Alertas_Disponibilidad (id_usuario, tipo, id_referencia) VALUES ($1, $2, $3)', [id_usuario, tipo, id_referencia]);
      }

      return "Te avisaremos por correo cuando vuelva a estar disponible 📩";
    },

    registrarUsuario: async (_, { nombre, email, password, rol = 'CLIENTE' }) => {
      const emailExistente = await pool.query('SELECT id_usuario FROM Usuarios WHERE email = $1', [email]);

      if (emailExistente.rows.length > 0) {
        throw new Error('El correo ya está siendo usado por otra persona.');
      }

      const nombreExistente = await pool.query('SELECT id_usuario FROM Usuarios WHERE nombre = $1', [nombre]);

      if (nombreExistente.rows.length > 0) {
        throw new Error('Este nombre de usuario ya está en uso. Por favor, elige otro.');
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      const res = await pool.query(
        'INSERT INTO Usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id_usuario, nombre, email, rol, puntos_acumulados',
        [nombre, email, password_hash, rol]
      );

      const token = jwt.sign(
        { id_usuario: res.rows[0].id_usuario, rol: res.rows[0].rol },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

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

    guardarPreferencias: async () => "Preferencias guardadas exitosamente.",

    crearPedido: async (_, {
      id_usuario,
      id_restaurante,
      id_plato,
      metodo_pago,
      direccion_envio,
      fecha_programada,
      latitud_cliente,
      longitud_cliente
    }, contexto) => {
      console.log("==========================================");
      console.log("🛒 INTENTO DE CREAR PEDIDO RECIBIDO");
      console.log("==========================================");

      try {
        if (!contexto.usuario || contexto.usuario.id_usuario !== parseInt(id_usuario)) {
          throw new Error('⛔ Fraude detectado.');
        }

        const resRestaurante = await pool.query(
          'SELECT aceptando_pedidos, tiempo_reactivacion, latitud, longitud, radio_cobertura_km, horarios_recogida FROM Restaurantes WHERE id_restaurante = $1',
          [id_restaurante]
        );

        const restaurante = resRestaurante.rows[0];
        if (!restaurante) throw new Error('El restaurante no existe.');

        if (direccion_envio === 'Recogida en el local') {
          validarFechaRecogida(restaurante.horarios_recogida, fecha_programada);
        }

        if (!restaurante.aceptando_pedidos && !fecha_programada) {
          throw new Error('⛔ El restaurante está pausado temporalmente.');
        }

        if (latitud_cliente && longitud_cliente && restaurante.latitud && restaurante.longitud && restaurante.radio_cobertura_km) {
          const distanciaCalculada = calcularDistancia(
            parseFloat(latitud_cliente),
            parseFloat(longitud_cliente),
            parseFloat(restaurante.latitud),
            parseFloat(restaurante.longitud)
          );

          if (distanciaCalculada > restaurante.radio_cobertura_km) {
            throw new Error(`⛔ Estás demasiado lejos (${distanciaCalculada.toFixed(1)} km). Este restaurante solo reparte a un máximo de ${restaurante.radio_cobertura_km} km.`);
          }
        }

        const platoResCheck = await pool.query(
          'SELECT nombre, disponible, tiempo_disponible FROM Platos WHERE id_plato = $1',
          [id_plato]
        );

        let estaDisponible = platoResCheck.rows[0].disponible;

        if (!estaDisponible && !fecha_programada) {
          throw new Error('⛔ El producto está agotado.');
        }

        const estadoInicial = fecha_programada ? 'PROGRAMADO' : 'PENDIENTE';

        let fechaFormateada = null;

        if (fecha_programada) {
          const timestamp = !isNaN(fecha_programada) ? Number(fecha_programada) : fecha_programada;
          fechaFormateada = new Date(timestamp).toISOString();
        }

        const res = await pool.query(
          'INSERT INTO Pedidos (id_usuario, id_restaurante, id_plato, metodo_pago, direccion_envio, estado, fecha_programada) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
          [id_usuario, id_restaurante, id_plato, metodo_pago, direccion_envio, estadoInicial, fechaFormateada]
        );

        await pool.query(
          'UPDATE Usuarios SET puntos_acumulados = puntos_acumulados + 10 WHERE id_usuario = $1',
          [id_usuario]
        );

        const usuarioRes = await pool.query(
          'SELECT email, nombre FROM Usuarios WHERE id_usuario = $1',
          [id_usuario]
        );

        const nuevoPedido = res.rows[0];
        nuevoPedido.nombre_plato = platoResCheck.rows[0].nombre;

        if (fecha_programada) {
          transporter.sendMail({
            from: `"NexBite Delivery" <${process.env.EMAIL_USER}>`,
            to: usuarioRes.rows[0].email,
            subject: '📅 Pedido Programado con éxito',
            text: `Hola ${usuarioRes.rows[0].nombre}, tu pedido de ${platoResCheck.rows[0].nombre} ha sido programado. ¡Te avisaremos cuando empiecen a cocinarlo!`
          }).catch(console.error);
        } else {
          transporter.sendMail({
            from: `"NexBite Delivery" <${process.env.EMAIL_USER}>`,
            to: usuarioRes.rows[0].email,
            subject: `Actualización de tu pedido: ${platoResCheck.rows[0].nombre} 🍔`,
            text: `¡Hemos recibido tu pedido de ${platoResCheck.rows[0].nombre}! 📝 El restaurante lo está revisando.`
          }).catch(console.error);
        }

        eventEmitter.emit(PEDIDO_CREADO, { nuevoPedido });
        return nuevoPedido;
      } catch (error) {
        console.error("❌ ERROR CRÍTICO AL CREAR EL PEDIDO:", error.message);
        throw error;
      }
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

    crearPlato: async (_, {
      id_restaurante,
      nombre,
      descripcion,
      precio,
      categoria,
      imagen_url,
      platos_existentes
    }) => {
      const resCombo = await pool.query(
        'INSERT INTO Platos (id_restaurante, nombre, descripcion, precio, categoria, imagen_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [id_restaurante, nombre, descripcion, precio, categoria, imagen_url]
      );

      const nuevoPlato = resCombo.rows[0];

      if (platos_existentes && platos_existentes.length > 0) {
        try {
          for (const idVinculado of platos_existentes) {
            await pool.query(
              'INSERT INTO Menu_Platos (id_menu, id_plato_incluido) VALUES ($1, $2)',
              [nuevoPlato.id_plato, idVinculado]
            );
          }
        } catch (error) {
          console.warn("ADVERTENCIA: No se pudieron vincular los platos al menú.", error.message);
        }
      }

      return nuevoPlato;
    },

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

        const pedidosProgramados = await pool.query(
          `SELECT p.id_pedido, u.email, u.nombre, pl.nombre AS nombre_plato
           FROM Pedidos p
           JOIN Usuarios u ON p.id_usuario = u.id_usuario
           JOIN Platos pl ON p.id_plato = pl.id_plato
           WHERE p.id_restaurante = $1 AND p.estado = 'PROGRAMADO'`,
          [id_restaurante]
        );

        for (const pedido of pedidosProgramados.rows) {
          await pool.query(
            "UPDATE Pedidos SET estado = 'PENDIENTE', fecha_programada = NULL WHERE id_pedido = $1",
            [pedido.id_pedido]
          );

          transporter.sendMail({
            from: `"NexBite Delivery" <${process.env.EMAIL_USER}>`,
            to: pedido.email,
            subject: `🍳 Tu pedido de ${pedido.nombre_plato} ya ha entrado a cocina`,
            text: `¡Hola ${pedido.nombre}! El restaurante acaba de abrir y tu pedido programado ha sido enviado al cocinero.`
          }).catch(console.error);
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
    }) => {
      const res = await pool.query(
        'UPDATE Pedidos SET estado = $1 WHERE id_pedido = $2 RETURNING *',
        [nuevo_estado, id_pedido]
      );

      const pedido = res.rows[0];
      const userRes = await pool.query(
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
    }
  },

  Subscription: {
    nuevoPedido: {
      subscribe: async function* (_, { id_restaurante }) {
        for await (const [evento] of on(eventEmitter, PEDIDO_CREADO)) {
          yield evento;
        }
      }
    }
  }
};
