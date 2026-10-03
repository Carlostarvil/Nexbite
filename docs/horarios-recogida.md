# Horarios de recogida

Al registrar un negocio se seleccionan los días con recogida y hasta cuatro franjas por día. Se pueden separar comida y cena o desactivar días. Las horas usan `Europe/Madrid` (hora peninsular, con cambios de verano/invierno).

Cada franja tiene `dia` (0 = lunes, 6 = domingo), `inicio` y `fin` en formato `HH:mm`. Si `fin` es anterior a `inicio`, acaba al día siguiente. No se permiten franjas de menos de 30 minutos ni solapamientos, incluidos los del día siguiente.

El carrito ofrece franjas de 30 minutos durante los próximos siete días, con al menos 15 minutos de antelación. Solo muestra días y horas disponibles. La recogida inmediata se ofrece dentro del horario si faltan al menos 15 minutos para el cierre. El horario se vuelve a consultar antes del pago y el backend valida también cada pedido de recogida.

La mutación `registrarNegocio` acepta `horarios_recogida: [FranjaRecogidaInput!]`. El campo se almacena como JSONB y se devuelve en `Restaurante.horarios_recogida`.

## Instalación

Actualizar la rama `chatgpt-dev` y reiniciar el backend. Antes de aceptar peticiones, el servidor ejecuta `ALTER TABLE Restaurantes ADD COLUMN IF NOT EXISTS horarios_recogida JSONB`. El usuario de PostgreSQL necesita permiso para modificar esa tabla. Los restaurantes ya existentes mantienen `NULL` y su funcionamiento anterior; el formulario nuevo siempre envía un horario.

## Comprobaciones

Desde la raíz: `npm run test:recogida`. Desde `nexbite-frontend`: `npm run build`.

Para probarlo: registrar un local con lunes 12:00–15:00 y 19:00–23:00; dejar el martes sin recogida. En su carrito, seleccionar «Recogida en local» y «Editar». No deben aparecer el martes ni horas entre 15:00 y 19:00. El último inicio disponible de cada franja debe dejar 30 minutos hasta el cierre.
