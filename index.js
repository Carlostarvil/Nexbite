import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import { typeDefs } from './graphql/typeDefs.js';
import { resolvers, procesarComprasPendientes, procesarNotificacionesPendientes, procesarAvisosPedidos } from './graphql/resolvers.js';
import { inicializarChatbot } from './nlp/chatbot.js';
import pool, { horariosRecogidaListos, clientesPagoListos, menusListos, comprasListas } from './config/db.js';
import cuerpoJson from './config/cuerpoJson.js';

dotenv.config();

// Inicializa la API HTTP/WebSocket y las tareas de revisión de compras.
const app = express();
if (process.env.RENDER_GIT_COMMIT) app.use((_req, res, next) => {
  res.setHeader('X-App-Version', process.env.RENDER_GIT_COMMIT);
  next();
});

const limitadorTrafico = rateLimit({ windowMs: 1 * 60 * 1000, max: 100 });
app.use(limitadorTrafico);
app.use(cors());
app.use(cuerpoJson);

const httpServer = createServer(app);
const schema = makeExecutableSchema({ typeDefs, resolvers });

async function contextoToken(autorizacion = '') {
  const token = String(autorizacion).replace(/^Bearer\s+/i, '');
  if (!token) return { usuario: null };
  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = (await pool.query('SELECT id_usuario, rol FROM Usuarios WHERE id_usuario = $1', [datos.id_usuario])).rows[0];
    return { usuario: usuario || null };
  } catch { return { usuario: null }; }
}

let revisionEnCurso = null;
let notificacionesEnCurso = null;
let avisosEnCurso = null;
const revisarCompras = () => {
  if (!revisionEnCurso) revisionEnCurso = procesarComprasPendientes()
    .catch(error => console.error('No se pudieron revisar las compras pendientes:', error.code || 'CONEXION', error.message))
    .finally(() => { revisionEnCurso = null; });
};
const revisarNotificaciones = () => {
  if (!notificacionesEnCurso) notificacionesEnCurso = procesarNotificacionesPendientes()
    .catch(error => console.error('No se pudieron enviar las notificaciones pendientes:', error.code || 'NOTIFICACION'))
    .finally(() => { notificacionesEnCurso = null; });
};
const revisarAvisos = () => {
  if (!avisosEnCurso) avisosEnCurso = procesarAvisosPedidos()
    .catch(error => console.error('No se pudieron revisar los avisos de estado:', error.code || 'NOTIFICACION'))
    .finally(() => { avisosEnCurso = null; });
};
let temporizadorCompras;
let temporizadorAvisos;

const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
const serverCleanup = useServer({ schema, context: ctx => contextoToken(ctx.connectionParams?.authorization || ctx.connectionParams?.Authorization || '') }, wsServer);

const server = new ApolloServer({
  schema,
  plugins: [
    { async serverWillStart() { return { async drainServer() { clearInterval(temporizadorCompras); clearInterval(temporizadorAvisos); await Promise.allSettled([revisionEnCurso, notificacionesEnCurso, avisosEnCurso]); await serverCleanup.dispose(); } }; } },
    ApolloServerPluginLandingPageLocalDefault({ embed: true })
  ],
});

await Promise.all([horariosRecogidaListos, clientesPagoListos, menusListos, comprasListas]);
await inicializarChatbot();
await server.start();

app.use('/graphql', expressMiddleware(server, {
  context: ({ req }) => contextoToken(req.headers.authorization),
}));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    revisarCompras();
    revisarNotificaciones();
    revisarAvisos();
    temporizadorCompras = setInterval(() => { revisarCompras(); revisarNotificaciones(); }, 30_000);
    temporizadorCompras.unref();
    temporizadorAvisos = setInterval(revisarAvisos, 5000);
    temporizadorAvisos.unref();
    console.log(`🚀 Servidor HTTP listo en http://localhost:${PORT}/graphql`);
    console.log(`⚡ Servidor WebSockets listo en ws://localhost:${PORT}/graphql`);
});
