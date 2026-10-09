# Compras, pagos y reservas

La compra de un local se confirma completa. El servidor calcula los precios y el envío, comprueba la propiedad de los productos, su disponibilidad y los componentes del menú. Una transacción guarda todas las unidades; el navegador ya no crea un pedido por cada unidad después de cobrar.

Con tarjeta, Stripe autoriza primero el importe (`capture_method: manual`). El cobro solo se ejecuta después de guardar el pedido completo. Cada compra, captura y devolución tiene una clave de idempotencia. Si se pierde una respuesta o se reinicia el servidor, se consulta el mismo pago y se recupera la compra sin duplicarla.

Las reservas conservan su fecha aunque se reabra el local antes. Se permiten entre 15 minutos y 7 días desde su creación, después de la reactivación del local y de todos los productos. La recogida respeta las franjas configuradas y el domicilio valida el radio de entrega.

Con tarjeta se autoriza el importe al reservar y se cobra cuando llega la hora y todo está disponible. Se utiliza el vencimiento real de la autorización que devuelve Stripe; si la fecha elegida lo supera, se libera la retención y se ofrece reservar con efectivo o elegir otra hora. El banco puede mostrar temporalmente la retención en el saldo.

El servidor revisa compras pendientes cada 30 segundos y al arrancar. Si el local o los productos no están disponibles, espera hasta 30 minutos después de la hora reservada. Después cancela la reserva sin cobrar y libera la autorización. El servidor debe estar funcionando para activar las reservas. Tras una interrupción prolongada, las reservas cuya ventana haya pasado se cancelan sin un cobro nuevo.

Cancelar un pedido nuevo cancela la compra completa de ese local, mientras ninguna unidad haya empezado a prepararse. Si solo estaba autorizado, se libera la retención; si ya estaba cobrado, se solicita la devolución real a Stripe. Si falla la conexión, la operación queda pendiente y se reintenta. El chatbot informa del resultado confirmado, sin prometer devoluciones para pagos antiguos que no tienen una referencia de Stripe guardada.

## Actualizar y ejecutar

En la carpeta raíz del proyecto:

```bat
git pull --ff-only origin chatgpt-dev
npm install
node index.js
```

Detén primero el servidor anterior con Ctrl+C. Al arrancar se crea automáticamente la tabla `Compras` y se añaden columnas de referencia y precio a `Pedidos`; los pedidos anteriores se conservan. Las variables de conexión, sesión y Stripe siguen siendo las del proyecto.

En otra terminal, inicia el cliente como siempre:

```bat
cd nexbite-frontend
npm run dev
```

## Verificación

`npm test` ejecuta las pruebas. Las compras se prueban con PostgreSQL en memoria y una pasarela simulada, sin leer `.env`, usar la base de datos del proyecto ni realizar cobros. `npm run test:pagos` ejecuta las pruebas de tarjetas y compras. El cliente se compila con `npm run build` en `nexbite-frontend`.

Las operaciones antiguas `crearPedido` y `crearIntencionPago(monto: ...)` están deshabilitadas y piden actualizar la página para usar el carrito completo. Una pestaña abierta con la versión anterior debe recargarse.
