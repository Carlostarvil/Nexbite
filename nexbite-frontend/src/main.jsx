import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Apollo Core proporciona el cliente, el enlace HTTP y la caché.
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core/index.js';

// ApolloProvider conecta ese cliente con la interfaz de React.
import { ApolloProvider } from '@apollo/client/react/index.js';

import { setContext } from '@apollo/client/link/context/index.js';

// Tolera cambios de DOM de traductores o extensiones que alteran los nodos de React.
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

// Endpoint GraphQL utilizado por las consultas y mutaciones de la interfaz.
const httpLink = createHttpLink({
  uri: 'http://localhost:4000/graphql',
});

// Envía el JWT de la sesión en Authorization para que el servidor lo verifique.
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('nexbite_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

// Une autenticación, transporte HTTP y caché de consultas en memoria.
const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
);