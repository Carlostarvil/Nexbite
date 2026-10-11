// Registra referencias y códigos, nunca respuestas completas, datos de tarjeta
// ni mensajes de Stripe que podrían contener credenciales.
const codigoSeguro = valor => typeof valor === 'string' && /^[a-zA-Z0-9_:-]{1,64}$/.test(valor) ? valor : null;

export function detalleErrorCompra(error) {
  const graphql = error?.errors?.[0] || error?.graphQLErrors?.[0];
  const extensiones = graphql?.extensions || error?.extensions;
  const estadoHttp = Number(error?.statusCode || error?.networkError?.statusCode);
  return {
    codigo: codigoSeguro(extensiones?.code) || codigoSeguro(error?.code) || codigoSeguro(error?.type) || codigoSeguro(error?.name) || 'ERROR_DESCONOCIDO',
    codigo_incidente: codigoSeguro(extensiones?.codigo_incidente),
    estado_http: Number.isInteger(estadoHttp) && estadoHttp >= 400 && estadoHttp <= 599 ? estadoHttp : null,
  };
}

export function registrarErrorCompra(origen, etapa, clave, error) {
  console.error('NexBite: no se pudo completar una operación de compra.', {
    origen, etapa, id_compra: clave || null, ...detalleErrorCompra(error),
  });
}

export function mensajeCompraPendiente(error) {
  const { codigo, estado_http } = detalleErrorCompra(error);
  if (codigo === 'UNAUTHENTICATED' || estado_http === 401) return {
    titulo: 'Inicia sesión para comprobar tu compra',
    descripcion: 'La sesión ya no es válida. Entra de nuevo con la misma cuenta y comprueba esta compra antes de volver a pagar.',
  };
  if (codigo === 'FORBIDDEN' || estado_http === 403) return {
    titulo: 'Comprueba la cuenta de tu compra',
    descripcion: 'La cuenta actual no puede consultar este pedido. Entra con la cuenta que inició la compra para comprobar su estado.',
  };
  if (codigo === 'COMPRA_EN_PROCESO') return {
    titulo: 'Tu compra sigue en proceso',
    descripcion: 'El servidor aún está procesando este pedido. Espera unos segundos y pulsa Comprobar compra; se consultará el mismo pedido.',
  };
  if (estado_http === 429) return {
    titulo: 'Espera un momento para comprobar tu compra',
    descripcion: 'El servidor ha recibido demasiadas peticiones. Espera unos segundos y pulsa Comprobar compra para consultar el mismo pedido.',
  };
  if (codigo === 'COMPRA_SERVIDOR_NO_DISPONIBLE' || estado_http >= 500) return {
    titulo: 'El servidor no ha podido comprobar tu compra',
    descripcion: 'No podemos confirmar todavía el resultado del pedido. Pulsa Comprobar compra para recuperar su estado con la misma referencia; no inicies otra compra.',
  };
  return {
    titulo: 'Comprueba el estado de tu compra',
    descripcion: 'No hemos podido consultar el resultado. Comprueba la conexión y que el servidor esté funcionando, y pulsa Comprobar compra. Se conservará la misma referencia; no inicies otra compra hasta conocer su estado.',
  };
}
