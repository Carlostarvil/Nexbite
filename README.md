# NexBite

**Descubre locales cercanos, encuentra tus productos favoritos y organiza tus pedidos a domicilio o para recoger.**

NexBite es una aplicación web que conecta a clientes con restaurantes y otros comercios de su zona. Reúne la búsqueda de locales y productos, la gestión del carrito, los pagos y las reservas en una misma experiencia. Los vendedores disponen de un espacio propio para administrar sus locales, su catálogo y sus pedidos.

El proyecto utiliza React en el cliente y una API GraphQL con Node.js y PostgreSQL en el servidor. Actualmente se desarrolla en la rama `chatgpt-dev`.

[Funcionalidades](#funcionalidades) · [Tecnologías](#tecnologías) · [Instalación](#instalación) · [Ejecución](#ejecución) · [Documentación](#documentación)

## Funcionalidades

### Experiencia del cliente

- **Descubrimiento por ubicación.** Selección de dirección, exploración del mapa y catálogo filtrado según el radio de reparto de cada local.
- **Búsqueda y recomendaciones.** Buscador de locales y platos/productos, categorías, ofertas, recomendaciones y productos destacados.
- **Catálogo de cada local.** Información del negocio, valoraciones, categorías, productos y menús con sus imágenes y componentes.
- **Carrito y compra.** Control de cantidades, carritos organizados por local, elección de entrega o recogida y pago con tarjeta o efectivo.
- **Reservas.** Pedidos programados según los horarios de recogida y la disponibilidad del local y de los productos.
- **Cuenta personal.** Registro, inicio de sesión, acceso con Google, recuperación de contraseña, favoritos, reseñas e historial de pedidos.
- **Repetición de pedidos y asistencia.** Acceso a compras anteriores y asistente para consultar pedidos y explicar reservas, cancelaciones y pagos.

### Espacio del vendedor

- **Administración de locales.** Registro y edición de información, imagen, ubicación, cobertura de reparto y horarios de recogida.
- **Gestión del catálogo.** Creación y edición de productos, categorías, fotografías, menús y ofertas.
- **Disponibilidad.** Cierre temporal del local y productos no disponibles, con opción de indicar una fecha de reactivación.
- **Gestión de pedidos.** Búsqueda por número, filtros por estado y tipo de entrega, actualización de la preparación y cancelación con motivo.

### Compras y reservas

El servidor calcula los precios y el envío, valida la cobertura y comprueba todos los productos del carrito, incluidos los componentes de los menús. El pedido completo se guarda mediante una transacción.

Con tarjeta, el flujo implementado autoriza primero el importe en Stripe y lo captura después de guardar el pedido. Las compras conservan una referencia y utilizan claves de idempotencia para recuperar operaciones pendientes. Si se pierde una respuesta, el carrito ofrece **Comprobar compra** para consultar el mismo pedido.

En las reservas, el cobro se programa para la hora elegida y depende de la disponibilidad y del plazo de autorización de la tarjeta. El servidor revisa las operaciones pendientes al arrancar y cada 30 segundos; debe permanecer en ejecución para activar las reservas.

Consulta las reglas completas en [Compras, pagos y reservas](docs/pagos-y-reservas.md).

## Tecnologías

| Área | Tecnologías | Uso |
| --- | --- | --- |
| Interfaz | React 19, Vite 8, JavaScript y CSS | Catálogo, carrito, perfiles y espacio del vendedor |
| Comunicación | GraphQL y Apollo Client | Consultas y operaciones del cliente |
| Servidor | Node.js, Express y Apollo Server | API, autenticación y reglas de negocio |
| Persistencia | PostgreSQL y `pg` | Usuarios, locales, catálogo, pedidos y compras |
| Autenticación | JWT, bcrypt y Google OAuth | Sesiones, contraseñas y acceso con Google |
| Pagos | Stripe y Stripe Elements | Tarjetas, autorizaciones, cobros y devoluciones |
| Ubicación | Leaflet, React Leaflet, Photon y Nominatim | Mapas y búsqueda de direcciones |
| Correo | Nodemailer | Recuperación de contraseña y notificaciones |
| Asistencia | Node NLP y lógica de soporte propia | Procesamiento de lenguaje y consultas sobre pedidos |
| Pruebas | Node.js Test Runner y PGlite | Pruebas automatizadas y PostgreSQL en memoria |

## Arquitectura

El cliente React consume la API GraphQL. El servidor concentra la autenticación, los permisos, la validación del catálogo y las operaciones de compra; PostgreSQL conserva los datos. Los servicios de pago, correo y direcciones se integran con este flujo.

Las reglas de horarios, cobertura, precios y errores de compra se encuentran en módulos compartidos para reutilizarlas en el cliente y el servidor. La API también expone una suscripción de nuevos pedidos mediante WebSocket.

| Ruta | Responsabilidad |
| --- | --- |
| [`index.js`](index.js) | Arranque del servidor HTTP, WebSocket y revisión de compras pendientes |
| [`config/`](config/) | Conexión con PostgreSQL y actualizaciones de estructura al iniciar |
| [`graphql/`](graphql/) | Esquema, resolvers, permisos y operaciones de negocio |
| [`graphql/compras.js`](graphql/compras.js) | Confirmación, recuperación, reservas y cancelación de compras |
| [`shared/`](shared/) | Reglas compartidas de cobertura, horarios, precios y diagnóstico |
| [`nexbite-frontend/`](nexbite-frontend/) | Aplicación React y estilos de la interfaz |
| [`nlp/`](nlp/) | Inicialización y entrenamiento del modelo NLP |
| [`tests/`](tests/) | Pruebas automatizadas del proyecto |
| [`docs/`](docs/) | Documentación de funcionalidades y reglas de negocio |
| [`.env.example`](.env.example) | Plantilla de configuración del servidor, sin credenciales |

## Instalación

### 1. Requisitos

- Node.js **22, desde la versión 22.13**, o **24**, con npm.
- Git, para descargar y actualizar el repositorio.
- PostgreSQL en ejecución y una base de datos con el esquema inicial de NexBite.
- Credenciales de Stripe en modo de pruebas para configurar el servidor de pagos.
- Una cuenta de correo compatible con la configuración de Gmail del proyecto si se van a utilizar recuperación de contraseña y notificaciones.

### 2. Descargar e instalar dependencias

Para una instalación nueva:

```sh
git clone --branch chatgpt-dev https://github.com/Carlostarvil/Nexbite.git NexBite
cd NexBite
npm ci
cd nexbite-frontend
npm ci
cd ..
```

El backend y el frontend tienen dependencias independientes. `npm ci` instala las versiones de cada archivo de bloqueo.

### 3. Configurar el entorno

Copia [`.env.example`](.env.example) como `.env` en la raíz del proyecto y completa los valores.

En Windows:

```cmd
copy .env.example .env
```

En macOS o Linux:

```sh
cp .env.example .env
```

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto del backend; el servidor utiliza `4000` si no se indica |
| `DB_HOST`, `DB_PORT` | Dirección y puerto del servidor PostgreSQL |
| `DB_NAME` | Nombre de la base de datos del proyecto |
| `DB_USER`, `DB_PASSWORD` | Credenciales del usuario de PostgreSQL |
| `JWT_SECRET` | Valor secreto propio para firmar las sesiones |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe en modo de pruebas |
| `EMAIL_PROVIDER` | `brevo` para enviar por HTTPS o `smtp` para Gmail; si está vacío, detecta Brevo cuando existe su clave |
| `BREVO_API_KEY`, `EMAIL_FROM` | Clave API de Brevo y correo del remitente verificado |
| `EMAIL_USER`, `EMAIL_PASS` | Cuenta de Gmail y contraseña de aplicación cuando se utiliza SMTP |
| `FRONTEND_URL` | URL pública del frontend para los enlaces de recuperación de contraseña |
| `GOOGLE_CLIENT_ID` | Identificador OAuth de Google, que debe coincidir con el configurado en el cliente |
| `PHOTON_URL` | Dirección del proveedor Photon; por defecto, `https://photon.komoot.io` |

Utiliza valores propios en `.env`. Las credenciales de PostgreSQL, Stripe, correo y sesión no se deben incluir en el README ni en archivos publicados.

Para el envío desde Render gratuito, consulta [Configurar los correos por HTTPS](docs/correo-render.md). El pago se confirma sin esperar al correo; las notificaciones de compras quedan pendientes en PostgreSQL y se intentan desde una tarea independiente cada 30 segundos mientras el servidor está activo.

### 4. Preparar la base de datos

La configuración debe apuntar a una base de datos que ya tenga el esquema inicial de NexBite, incluidas las tablas `Usuarios`, `Restaurantes`, `Platos` y `Pedidos` y sus tablas relacionadas.

**El repositorio todavía no incluye un script completo para crear ese esquema desde cero.** Para instalar el proyecto en otro equipo, primero hay que importar el esquema base o una copia de la base de datos de desarrollo.

Al arrancar, el backend aplica las actualizaciones incluidas en [`config/db.js`](config/db.js) y [`graphql/migracionCompras.js`](graphql/migracionCompras.js): horarios de recogida, referencias de Stripe, menús, favoritos de productos y estructura de compras. El usuario de PostgreSQL necesita permisos para crear y modificar esas estructuras.

### 5. Revisar las integraciones del cliente

La configuración actual utiliza direcciones y constantes definidas en el código:

- **API GraphQL del frontend en `deploy-render`:** `https://nexbite.onrender.com/graphql`, en [`nexbite-frontend/src/main.jsx`](nexbite-frontend/src/main.jsx).
- **Stripe:** clave publicable de pruebas en [`nexbite-frontend/src/Carrito.jsx`](nexbite-frontend/src/Carrito.jsx). Debe pertenecer a la misma cuenta y modo que la clave secreta del servidor.
- **Google:** identificador OAuth en [`nexbite-frontend/src/Auth.jsx`](nexbite-frontend/src/Auth.jsx). Configura el origen del frontend en tu cliente OAuth y utiliza el mismo identificador en el backend.
- **Recuperación de contraseña:** utiliza `FRONTEND_URL`. En Render, si no se indica, apunta al frontend público de NexBite; en desarrollo local utiliza `http://localhost:5173`.

Si cambias de puerto, dominio o cuenta de integración, actualiza estos valores. El frontend actual no los obtiene de variables `VITE_*`.

## Ejecución

Se necesitan dos terminales abiertas.

### Terminal 1: backend

Desde la raíz del proyecto:

```sh
node index.js
```

API GraphQL: [http://localhost:4000/graphql](http://localhost:4000/graphql).

Endpoint de suscripciones: `ws://localhost:4000/graphql`.

### Terminal 2: frontend

Desde la raíz del proyecto:

```sh
cd nexbite-frontend
npm run dev
```

Aplicación: [http://localhost:5173](http://localhost:5173).

Si Vite utiliza otro puerto porque el habitual está ocupado, abre la dirección que muestre la terminal. El backend debe permanecer encendido para cargar datos, confirmar pedidos y gestionar reservas.

## Verificación

### Pruebas del proyecto

Desde la raíz:

```sh
npm test
```

También se pueden ejecutar suites específicas:

| Comando | Cobertura |
| --- | --- |
| `npm run test:pagos` | Tarjetas, compras, recuperación, reservas y cancelaciones |
| `npm run test:recogida` | Horarios y validación de recogida |
| `npm run test:zona` | Coordenadas, cobertura y consultas por ubicación |
| `npm run test:locales` | Edición y validación de locales |

Las pruebas de compras utilizan PostgreSQL en memoria y una pasarela simulada: no necesitan la base de datos de desarrollo ni realizan cobros reales. La suite general también incluye edición de productos y menús, imágenes, búsqueda de pedidos y diagnóstico de errores de compra.

### Frontend

Desde `nexbite-frontend`:

```sh
npm run lint
npm run build
```

La compilación genera `nexbite-frontend/dist`. Para revisar esa compilación en local, ejecuta `npm run preview` desde la carpeta del frontend. Sigue siendo necesario tener disponible el backend y revisar la configuración de sus integraciones.

## Actualización del proyecto

Con la rama `chatgpt-dev` seleccionada y tus cambios locales guardados en Git:

```sh
git pull --ff-only origin chatgpt-dev
```

Reinicia el backend si se han modificado archivos del servidor y recarga el frontend. Instala de nuevo las dependencias cuando cambien los archivos `package.json` o `package-lock.json` correspondientes.

Si Git avisa de que una actualización sobrescribiría cambios locales, conserva esos cambios antes de continuar.

## Documentación

- [Ubicación, cobertura de entrega y búsqueda de direcciones](docs/ubicacion-entrega.md).
- [Horarios y validación de recogida](docs/horarios-recogida.md).
- [Compras, pagos, reservas y cancelaciones](docs/pagos-y-reservas.md).
- [Desarrollo del frontend](nexbite-frontend/README.md).

## Contribuciones

Mantén cada cambio centrado en un problema o funcionalidad. Describe su efecto, indica cómo se ha comprobado y ejecuta las pruebas correspondientes antes de proponer su integración. Conserva las validaciones del servidor cuando modifiques el flujo del cliente.

## Licencias

El [`package.json`](package.json) del backend declara la licencia ISC. Las tipografías DM Sans y Montserrat incluyen sus propias licencias en [`nexbite-frontend/src/assets/fonts/`](nexbite-frontend/src/assets/fonts/).
