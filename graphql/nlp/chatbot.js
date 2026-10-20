/**
 * BASE DE CONOCIMIENTO DEL CHATBOT
 * Un array estático que funciona como un sistema de "Preguntas Frecuentes" (FAQ).
 * Asocia palabras clave (claves) escritas por el usuario con respuestas predefinidas.
 */
const CONOCIMIENTO_SOPORTE = [
  { claves: ['reserva', 'reservar', 'programar', 'más tarde', 'mas tarde'], respuesta: 'Puedes reservar para una hora futura compatible con la reapertura del local y de todos los productos del carrito, incluidos los del menú. La fecha se conserva aunque el local abra antes. Con tarjeta se autoriza el importe ahora y solo se cobra al llegar la hora y estar todo disponible. La reserva debe caber en el plazo de autorización que permita tu tarjeta. Si no puede servirse en los 30 minutos siguientes, se cancela y se libera la retención. También puedes reservar con efectivo.' },
  { claves: ['pagar', 'pago', 'agotado', 'pausado', 'cerrado', 'error', 'comprar'], respuesta: 'No se aceptan compras inmediatas de productos no disponibles ni de locales cerrados. Puedes retirar esos productos del carrito o reservar para una hora posterior a su disponibilidad, si tienen una fecha de reactivación. El servidor comprueba todos los productos y el precio antes de cobrar. Si cambia algo, te pedirá revisar el carrito.' },
  { claves: ['tarda', 'tiempo', 'demora', 'cuánto', 'cuanto'], respuesta: 'La entrega depende de la distancia y de los pedidos del local. Consulta el estado en Mi perfil, en Tus pedidos anteriores.' },
  { claves: ['contacto', 'humano', 'agente', 'persona', 'teléfono', 'telefono'], respuesta: 'Abre la información del local para consultar su teléfono y contactar sobre tu pedido.' },
];

/**
 * Procesa los mensajes de soporte del usuario e identifica intenciones.
 * 
 * CONCEPTOS DE DOCUMENTACIÓN (JSDoc):
 * @param: Indica un parámetro que recibe la función (entrada).
 * @returns: Indica qué devuelve la función (salida).
 * {Promise<string>}: Significa que la función es asíncrona y devolverá 
 * un texto (string) en el futuro (Promise), una vez acabe de consultar la base de datos.
 * 
 * @param {string} mensaje - El texto enviado por el usuario.
 * @param {object} contexto - Información de la sesión actual (usuario logueado).
 * @param {object} pool - Conexión a la base de datos PostgreSQL.
 * @param {object} compras - Módulo/Servicio encargado de gestionar pagos y cancelaciones.
 * @returns {Promise<string>} - La respuesta de texto definitiva que enviará el chatbot.
 */

// export async function: 
// - 'export' permite que este archivo preste esta función a otros archivos.
// - 'async' indica que dentro de la función habrá procesos que toman tiempo (como consultas a BD) y usará 'await'.
export async function procesarMensaje(mensaje, contexto, pool, compras) {
  
  // if (!mensaje || typeof mensaje !== 'string'):
  // 1. !mensaje: Comprueba si 'mensaje' está vacío, es nulo o indefinido.
  // 2. typeof mensaje !== 'string': Comprueba si lo que ha llegado NO es texto.
  // Propósito: Es un "escudo". Si el bot recibe datos basura, en lugar de dar error, saluda amablemente.
  if (!mensaje || typeof mensaje !== 'string') return 'Hola, ¿en qué puedo ayudarte con NexBite?';
  
  // .trim(): Elimina los espacios en blanco accidentales al principio y al final del texto.
  const texto = mensaje.toLowerCase().trim();
  
  // texto.match(/\b\d+\b/)?.[0]:
  // El símbolo '?.' se evalúa ANTES que el '[0]'. Si match() no encuentra un número, devuelve 'null'. 
  // Al usar '?.' le dices a JavaScript: "Si es null, detente y devuelve 'undefined', no intentes leer la posición [0]".
  // Propósito: Extraer el número de pedido sin romper la aplicación si el usuario no escribió ningún número.
  const numero = texto.match(/\b\d+\b/)?.[0]; 
  
  // La letra 'p' en (p => texto.includes(p)):
  // 'p' es una variable temporal. El método '.some()' recorre el array ['cancelar', 'anular'...]. 
  // En cada vuelta, 'p' toma el valor de esa palabra y comprueba si el 'texto' del usuario la incluye.
  const cancelar = ['cancelar', 'anular', 'eliminar'].some(p => texto.includes(p));
  const reembolso = ['reembolso', 'devolución', 'devolucion', 'dinero', 'cobro'].some(p => texto.includes(p));
  
  // Comprueba tres cosas a la vez: hay un número AND el usuario está logueado AND hay conexión a la BD.
  if (numero && contexto?.usuario && pool) {
    
    // EXPLICACIÓN DE $1, $2 Y EL ARRAY [...]
    // PostgreSQL usa $1 y $2 como "huecos seguros" para evitar Inyección SQL (hackeos).
    // Nunca debes concatenar variables directamente. El array [numero, contexto...] es la lista 
    // de piezas para rellenar esos huecos en orden estricto ($1 = numero, $2 = id_usuario).
    //
    // EXPLICACIÓN DE .rows[0]:
    // La BD devuelve metadatos junto con los datos. 'rows' es la lista de resultados reales, 
    // y '[0]' extrae directamente la primera (y única) fila que coincide con ese pedido.
    const pedido = (await pool.query(
        'SELECT * FROM Pedidos WHERE id_pedido = $1 AND id_usuario = $2', 
        [numero, contexto.usuario.id_usuario]
    )).rows[0];
    
    if (!pedido) return 'No encuentro el pedido #' + numero + ' en tu cuenta.';
    
    if (cancelar || reembolso) {
      if (!compras) return 'No se puede gestionar la cancelación ahora. Inténtalo de nuevo.';
      try {
        // EXPLICACIÓN DE AWAIT Y RESULTADO.MENSAJE_PAGO
        // 'await' pausa la ejecución hasta que el módulo 'compras' termine de hablar con el banco.
        // 'compras' es un objeto externo. Al poner 'compras.', llamamos a su función 'cancelarPedido'.
        // Cuando termina, devuelve un objeto (una caja de datos). Lo guardamos en 'resultado' 
        // y con el punto (.) sacamos exclusivamente la variable 'mensaje_pago'.
        const resultado = await compras.cancelarPedido(numero, contexto);
        
        // Operador Ternario (condicion ? si_es_verdad : si_es_falsa):
        // Si pedido.id_compra existe, añade "Se ha cancelado la compra...", si no, añade texto vacío ('').
        return 'Pedido #' + numero + ' cancelado.' + 
               (pedido.id_compra ? ' Se ha cancelado la compra completa de ese local.' : '') + 
               ' ' + resultado.mensaje_pago;
      } catch (error) { 
        return error.message; 
      }
    }
    
    // Sobre 'pedido.': 'pedido' es el objeto extraído de la base de datos. Leemos su columna "estado".
    if (pedido.estado === 'PROGRAMADO') {
        // 1. Concatena la frase inicial.
        // 2. Operador ternario: ¿Hay una fecha programada? Si sí, la formatea a hora de España. Si no, no añade nada.
        // 3. Concatena la explicación final.
        return 'Tu pedido #' + numero + ' está reservado' + 
               (pedido.fecha_programada ? ' para ' + new Date(pedido.fecha_programada).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : '') + 
               '. Solo se activa al llegar la hora y estar disponibles el local y los productos.';
    }
    
    return 'Tu pedido #' + numero + ' está ' + pedido.estado.toLowerCase() + '.';
  }
  
  if ((cancelar || reembolso) && !contexto?.usuario) {
      return 'Inicia sesión para consultar o cancelar tus pedidos.';
  }
  
  if (cancelar || reembolso) return 'Escribe Cancelar seguido del número de pedido. La compra completa se puede cancelar mientras su preparación no haya empezado. La devolución o liberación de la autorización se confirma con la pasarela de pago.';
  
  // Bucle for...of combinado con .some():
  // Recorre cada 'item' de CONOCIMIENTO_SOPORTE. '.some()' comprueba si alguna de las 'claves'
  // está en el texto. Si coincide, devuelve inmediatamente la 'respuesta' y detiene la función.
  for (const item of CONOCIMIENTO_SOPORTE) {
      if (item.claves.some(p => texto.includes(p))) return item.respuesta;
  }
  
  return 'Puedo explicar las reservas o consultar tus pedidos. Escribe el número de pedido o pregunta cómo reservar con un local cerrado.';
}