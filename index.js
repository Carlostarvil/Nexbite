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

// Importamos nuestros propios módulos
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';
import { inicializarChatbot } from './nlp/chatbot.js';
import { horariosRecogidaListos } from './config/db.js';

dotenv.config();

// Propósito: Servir exclusivamente como el director de orquesta que ensambla las piezas. 
// Por qué el cambio: Index.js ya no maneja SQL ni intenciones de IA. Solo enciende los motores (Express, HTTP, WebSockets) e inserta los middlewares (Rate Limit, Seguridad).
const app = express();

const limitadorTrafico = rateLimit({ windowMs: 1 * 60 * 1000, max: 100 });
app.use(limitadorTrafico);
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const schema = makeExecutableSchema({ typeDefs, resolvers });

const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
const serverCleanup = useServer({ schema }, wsServer);

const server = new ApolloServer({
  schema,
  plugins: [
    { async serverWillStart() { return { async drainServer() { await serverCleanup.dispose(); } }; } },
    ApolloServerPluginLandingPageLocalDefault({ embed: true })
  ],
});

// Iniciamos todo de forma coordinada
await horariosRecogidaListos;
await inicializarChatbot();
await server.start();

app.use('/graphql', expressMiddleware(server, {
  context: async ({ req }) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return { usuario: null };
    try {
      const usuarioDecodificado = jwt.verify(token, process.env.JWT_SECRET);
      return { usuario: usuarioDecodificado };
    } catch {
      return { usuario: null };
    }
  },
}));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP listo en http://localhost:${PORT}/graphql`);
    console.log(`⚡ Servidor WebSockets listo en ws://localhost:${PORT}/graphql`);
});
