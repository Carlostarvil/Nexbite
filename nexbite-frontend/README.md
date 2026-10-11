# NexBite · Frontend

Interfaz web de NexBite, desarrollada con **React 19**, **Vite 8**, **JavaScript** y **CSS**. Incluye las experiencias de cliente y vendedor: descubrimiento de locales, catálogo, carrito, perfiles y gestión de negocios y pedidos.

La instalación completa del proyecto, la preparación de PostgreSQL y la configuración del backend se explican en el [README principal](../README.md).

## Preparación

Desde esta carpeta:

```sh
npm ci
```

Utiliza Node.js 22, desde la versión 22.13, o Node.js 24. Para consultar datos y completar pedidos, inicia también el backend desde la raíz del proyecto con `node index.js`.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Iniciar Vite en modo de desarrollo |
| `npm run lint` | Revisar el código con ESLint |
| `npm run build` | Compilar la aplicación en `dist/` |
| `npm run preview` | Revisar localmente la compilación generada |

El servidor de desarrollo utiliza normalmente [http://localhost:5173](http://localhost:5173). Abre la dirección que indique Vite si el puerto está ocupado.

## Configuración de integraciones

| Archivo | Configuración |
| --- | --- |
| [`src/main.jsx`](src/main.jsx) | Endpoint GraphQL: `http://localhost:4000/graphql` |
| [`src/Auth.jsx`](src/Auth.jsx) | Identificador OAuth de Google |
| [`src/Carrito.jsx`](src/Carrito.jsx) | Clave publicable de pruebas de Stripe |

Estas configuraciones están definidas en el código. Si utilizas otras cuentas o direcciones, actualízalas y comprueba su correspondencia con el backend. El frontend actual no utiliza variables `VITE_*` para estas integraciones. Las claves secretas se configuran exclusivamente en el servidor.

## Organización

| Área | Archivos principales |
| --- | --- |
| Aplicación y navegación | `src/App.jsx`, `src/Header.jsx`, `src/Footer.jsx` |
| Registro y cuenta | `src/Auth.jsx`, `src/PerfilUsuario.jsx` |
| Ubicación y búsqueda | `src/SelectorUbicacion.jsx`, `src/Buscador.jsx`, `src/MapView.jsx` |
| Catálogo | `src/PerfilRestaurante.jsx`, `src/DetallePlato.jsx`, `src/CarruselPlatos.jsx` |
| Compra | `src/Carrito.jsx`, `src/ConfirmacionPedido.jsx` |
| Espacio del vendedor | `src/EspacioVendedor.jsx`, `src/MisLocales.jsx`, `src/GestorMenu.jsx`, `src/GestorPedidos.jsx` |
| Reglas compartidas | [`../shared/`](../shared/) |

La compilación del cliente genera los archivos estáticos de la interfaz. La API, PostgreSQL y las integraciones externas deben seguir disponibles para utilizar las funciones conectadas.
