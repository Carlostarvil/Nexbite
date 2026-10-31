# Correos de NexBite en Render

Render gratuito bloquea las conexiones SMTP en los puertos 25, 465 y 587. Por eso la configuración de Gmail por SMTP puede funcionar en tu ordenador y fallar al publicar la web.

NexBite permite enviar los mismos correos mediante la API HTTPS de Brevo. No es necesario instalar nuevas dependencias.

## Activación

1. Crea una cuenta en [Brevo](https://www.brevo.com/) y selecciona su plan gratuito si cubre tu uso. Según sus límites publicados, incluye 300 envíos diarios; las cuotas y condiciones pueden cambiar.
2. En la configuración de remitentes, añade el correo desde el que quieres enviar y completa la verificación que recibas. Si dispones de un dominio propio, autentícalo también. Con direcciones como Gmail, Brevo puede sustituir la dirección visible por una de su dominio para cumplir los requisitos de entrega.
3. En **Settings → SMTP & API → API Keys & MCP**, genera una clave API estándar con permiso para enviar correos transaccionales. La integración utiliza una clave API, no una clave SMTP ni una clave MCP.
4. En Render, abre el **Web Service del backend** y añade estas variables en **Environment**:

| Variable | Valor |
| --- | --- |
| `EMAIL_PROVIDER` | `brevo` |
| `BREVO_API_KEY` | Tu clave API de Brevo |
| `EMAIL_FROM` | El correo que has verificado como remitente |
| `FRONTEND_URL` | `https://nexbite-pvfz.onrender.com` |

5. Guarda las variables y despliega de nuevo el backend. No publiques la clave en el repositorio ni la pongas en variables `VITE_*`.
6. Comprueba un correo desde la aplicación y revisa el registro de correos transaccionales de Brevo. La aceptación por la API no garantiza que llegue a la bandeja principal: comprueba también spam y los eventos de entrega o rechazo.

La integración queda preparada en el código, pero el envío real necesita una clave válida y un remitente verificado en tu cuenta. No cambia automáticamente la configuración de Render ni crea cuentas en Brevo.

## Compras y espera del pago

La respuesta al pagar depende de la validación del pedido y, cuando corresponde, de la confirmación de Stripe. No espera al envío del correo.

Las compras confirmadas y las reservas pendientes de notificación se guardan con `notificada = FALSE`. Una tarea independiente intenta sus correos cada 30 segundos, sin retener el bloqueo del pago o del pedido. Si el envío falla, siguen pendientes; si el servidor se reinicia, se recuperan desde la base de datos.

En Render gratuito, estas tareas solo se ejecutan mientras el servicio está despierto. Un reinicio o una respuesta perdida del proveedor puede ocasionar un reintento de correo; este mecanismo no promete entrega exactamente una vez.

Para desarrollo local puedes conservar `EMAIL_PROVIDER=smtp`, `EMAIL_USER` y `EMAIL_PASS`. Los cambios de estado de los pedidos, altas y recuperación de contraseña utilizan el mismo servicio de correo; el reintento persistente descrito arriba corresponde a las notificaciones de compras.

## Avisos al cambiar el estado de un pedido

La confirmación inicial de la compra y los cambios de estado son mensajes distintos. Al pasar a preparación, reparto, recogida, entrega o cancelación, se guarda un aviso en `Notificaciones_Pedido` junto con el cambio del pedido. Si no se puede guardar el aviso, se revierte el cambio.

El envío se solicita justo después de guardar. Además, una tarea cada cinco segundos recupera los avisos pendientes mientras el servidor está activo. Un fallo del proveedor conserva el aviso para reintentarlo, con esperas crecientes. No hace esperar al cambio de estado ni utiliza el bloqueo del pago.

Los avisos conservan el orden de cada compra. Repetir el mismo estado no genera otro aviso. Cancelar una compra completa genera un único correo que identifica todos sus pedidos e incluye el motivo. Para recogida se utilizan «Listo para recoger» y «Recogido», en lugar de «En camino».

La tabla se crea al arrancar mediante la migración habitual. Se registran los cambios nuevos; no se generan correos retrospectivos de estados anteriores. La aceptación por Brevo y la llegada a la bandeja del destinatario son pasos diferentes.

Para comprobar un aviso en el editor SQL de tu base de datos:

```sql
SELECT clave, datos->>'estado' AS estado, intentos,
       proximo_intento, enviada, ultimo_error
FROM Notificaciones_Pedido
ORDER BY id_notificacion DESC
LIMIT 20;
```

`enviada` indica que el servicio de correo aceptó el mensaje. Si está vacía, `ultimo_error` contiene un código de diagnóstico. Tras una caída se recuperan también los envíos que se habían reservado temporalmente. Una respuesta perdida del proveedor puede ocasionar un reintento; no se promete entrega exactamente una vez.

## Fuentes

- [Límites de Render gratuito](https://render.com/docs/free)
- [API de correo transaccional de Brevo](https://developers.brevo.com/reference/send-transac-email)
- [Configuración de claves API de Brevo](https://help.brevo.com/hc/en-us/articles/40159485019794-Create-and-manage-your-API-keys)
- [Límites del plan gratuito de Brevo](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
- [Remitentes y direcciones de proveedores gratuitos](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication)
