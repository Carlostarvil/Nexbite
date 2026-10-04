# Ubicación de entrega

El cliente elige una dirección al entrar por primera vez. Puede buscar la calle, el número y la ciudad, o pulsar «Usar mi ubicación actual». El navegador solo pide permiso de GPS después de pulsar ese botón. La dirección se confirma antes de cargar el catálogo.

La selección se guarda en el navegador por usuario y se puede cambiar desde la barra superior o desde el carrito. Cambiarla conserva los productos del carrito y vuelve a comprobar la cobertura del local.

## Reparto y recogida

- **A domicilio:** portada, platos destacados, buscador, favoritos, repetición de pedidos y mapa muestran locales cuya distancia a la dirección elegida no supera su `radio_cobertura_km`.
- **Recogida:** estos listados muestran locales a menos de 50 km, sin aplicar el radio de reparto. El carrito mantiene la selección y los horarios de recogida existentes.
- Los filtros se ejecutan en SQL antes de ordenar o limitar los resultados. Los locales sin coordenadas válidas no aparecen en los listados de la zona. Para reparto también necesitan un radio positivo.
- La distancia se calcula en línea recta sobre la Tierra, siguiendo el radio de cobertura configurado en el registro del local.
- El carrito comprueba la cobertura antes de iniciar el pago. El servidor también la valida al crear cada pedido a domicilio, incluso si faltan coordenadas o valen cero.
- El historial completo del perfil conserva todos los pedidos. Las consultas antiguas sin argumentos de ubicación mantienen su compatibilidad.

## Búsqueda de direcciones

El servidor consulta [Photon](https://github.com/komoot/photon) a petición del cliente. La búsqueda se ejecuta al pulsar «Buscar dirección», sin enviar peticiones con cada letra. El proveedor predeterminado es `https://photon.komoot.io`; no requiere una clave para probar el proyecto. El servidor limita las solicitudes a una por segundo y reutiliza los resultados durante cinco minutos, con un máximo de 200 entradas en memoria.

El proveedor se puede sustituir por una instancia Photon propia añadiendo `PHOTON_URL=https://tu-servidor-photon` a la configuración del backend y reiniciándolo. El servidor público de Photon admite uso moderado y no garantiza disponibilidad; para una aplicación con tráfico elevado debe usarse una instancia o servicio adecuado. La interfaz muestra la atribución de Photon y OpenStreetMap. [Documentación de su API](https://github.com/komoot/photon/blob/master/docs/api-v1.md).

Si se deniega el GPS, se puede seguir buscando una dirección manualmente. Si el proveedor falla, la interfaz permite reintentar y conserva la dirección anterior al cancelar. El GPS del navegador requiere HTTPS, salvo en localhost.

## Verificación

```sh
npm run test:zona
node --test tests/*.test.js
cd nexbite-frontend
npm run build
```

Después de descargar estos cambios se debe reiniciar el backend y recargar el frontend. No hacen falta cambios en las tablas ni nuevas dependencias del proyecto.
