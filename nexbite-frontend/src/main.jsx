import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// 1. MODIFICACIÓN: Separación de las herramientas del "Núcleo" (Core)
// Propósito: Importar el motor de Apollo, la memoria caché y el enlace HTTP directamente desde la carpeta 'core'.
// Por qué el cambio: Estas funciones son pura lógica de JavaScript (Vanilla). Al pedirlas directamente a su carpeta original, evitamos que el empaquetador de Vite se confunda y busque componentes visuales donde no los hay.
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core/index.js';

// 2. MODIFICACIÓN: Separación del "Proveedor" de React
// Propósito: Importar el componente visual ApolloProvider directamente desde la carpeta 'react'.
// Por qué el cambio: ApolloProvider es un componente de interfaz (por eso se escribe con mayúscula y se usa como etiqueta HTML <ApolloProvider>). Al importarlo desde su sub-carpeta específica, React lo reconoce instantáneamente.
import { ApolloProvider } from '@apollo/client/react/index.js';

import { setContext } from '@apollo/client/link/context/index.js';

// =========================================================================
// PARCHE DE TOLERANCIA PARA GOOGLE TRANSLATE Y EXTENSIONES
// Esto evita el error "Failed to execute 'removeChild' on 'Node'"
// =========================================================================
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (console) console.warn("🛡️ DOM mismatch evitado (probablemente por Google Translate).");
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) console.warn("🛡️ DOM mismatch evitado (probablemente por Google Translate).");
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments);
  };
}
// =========================================================================

// 3. Enlace HTTP (El camino)
// Propósito: Le indica a React exactamente en qué dirección de internet está viviendo nuestro backend de Node.js (tu servidor en el puerto 4000).
const httpLink = createHttpLink({
  uri: 'http://localhost:4000/graphql',
});

// 4. Enlace de Autenticación (El guardia de seguridad)
// Propósito: Intercepta cada petición que sale hacia el servidor y busca en el navegador (localStorage) si el usuario tiene un token.
// Por qué se hace así: Inyecta el token en las cabeceras bajo "Authorization: Bearer ...". Esto garantiza que tus mutaciones protegidas (crear pedidos, guardar favoritos) pasen la seguridad del backend.
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('nexbite_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

// 5. El Cliente Apollo (El ensamblador)
// Propósito: Une el guardia de seguridad (authLink) con la carretera hacia el servidor (httpLink) e inicializa la memoria rápida (InMemoryCache) para no repetir consultas innecesarias.
const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

// 6. Inyección del Proveedor
// Propósito: Envuelve tu aplicación entera para que cualquier pantalla o botón (dentro de <App />) pueda "hablar" con la base de datos mágicamente sin tener que reconfigurar la conexión.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
);