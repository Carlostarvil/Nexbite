import { GraphQLError } from 'graphql';
// IMPORTACIÓN DE FUNCIONES: Las llaves {} extraen exclusivamente estas 
// funciones matemáticas y logísticas de sus respectivos archivos.
import { centimos, costeEnvio } from '../shared/preciosCompra.js';
import { recogidaDisponible, validarFechaRecogida } from '../shared/horariosRecogida.js';
import { validarZonaEntrega } from '../shared/zonaEntrega.js';
import { exigirUsuario, exigirLocalPropio } from './permisos.js';
import { detalleErrorCompra, registrarErrorCompra } from '../shared/erroresCompra.js';

// ============================================================================
// UTILIDADES BÁSICAS
// ============================================================================

// Crea un error estándar de GraphQL con un código específico para que el frontend lo reconozca.
// Función flecha (atajo): Si no se le pasa el parámetro 'code', usa 'COMPRA_NO_VALIDA' por defecto.
const errorCompra = (mensaje, code = 'COMPRA_NO_VALIDA') => new GraphQLError(mensaje, { extensions: { code } });

// Convierte una fecha a formato estándar internacional ISO 8601 de forma segura.
const fechaISO = fecha => fecha ? new Date(fecha).toISOString() : null;

// Extrae el ID de Stripe, ya sea que venga como un simple texto ("card_123") o dentro de un objeto { id: "card_123" }.
const idStripe = valor => typeof valor === 'string' ? valor : valor?.id;

// EXPLICACIÓN DE 'new Set(...)':
// Un 'Set' (Conjunto) es una estructura de datos nativa de JavaScript.
// Es similar a un Array (lista), pero con rendimiento optimizado. 
// En lugar de usar [].includes() que obliga al servidor a leer la lista entera 
// elemento por elemento, un Set permite usar .has(), que verifica de forma 
// matemáticamente instantánea si un elemento existe en su interior.
//
// LÓGICA DE NEGOCIO ('finales'):
// Agrupa los estados terminales de una transacción (callejones sin salida). 
// Si una compra entra en alguno de estos 3 estados, el ciclo de vida del pedido 
// se bloquea definitivamente y se rechaza cualquier intento futuro de modificarlo.
const finales = new Set(['CANCELADA', 'REEMBOLSADA', 'REEMBOLSO_FALLIDO']);

/**
 * SANITIZACIÓN Y NORMALIZACIÓN DE ENTRADA
 * Limpia y valida estrictamente todos los datos que envía el usuario desde el carrito.
 * @param {object} input - Los datos en crudo (el "paquete") enviados por el cliente.
 * @returns {object} - Un objeto con los datos limpios y seguros para la base de datos.
 */
export function normalizarSolicitud(input) {
  // Expresiones regulares para evitar inyección de código: solo letras, números y guiones.
  if (!input || !/^[a-zA-Z0-9-]{16,64}$/.test(input.clave)) throw errorCompra('El identificador de la compra no es válido.');
  if (!/^[1-9]\d*$/.test(String(input.id_restaurante))) throw errorCompra('Selecciona un local válido.');
  if (!['TARJETA', 'EFECTIVO'].includes(input.metodo_pago) || !['DOMICILIO', 'RECOGIDA'].includes(input.tipo_entrega)) throw errorCompra('Selecciona el método de pago y la entrega.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50) throw errorCompra('El carrito está vacío o contiene demasiados productos.');
  
  // Agrupa productos repetidos y suma sus cantidades usando un Mapa (Diccionario).
  // Si el carrito trae varias líneas del mismo producto (por error o hackeo),
  // esto las agrupa y suma matemáticamente sus cantidades para evitar trucos.
  const cantidades = new Map();
  for (const item of input.items) {
    if (!/^[1-9]\d*$/.test(String(item.id_plato)) || !Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 100) throw errorCompra('La cantidad de productos no es válida.');
    cantidades.set(String(item.id_plato), (cantidades.get(String(item.id_plato)) || 0) + item.cantidad);
  }
  
  // Límite de seguridad: máximo 100 productos en total por compra para no saturar al restaurante.
  // REDUCE: Extrae solo los números (.values()) y los suma consecutivamente (a + b, empezando en 0).
  if ([...cantidades.values()].reduce((a, b) => a + b, 0) > 100) throw errorCompra('Puedes pedir hasta 100 unidades por compra.');
  
  // 'let' declara una variable que puede cambiar de valor (a diferencia de 'const').
  let fecha = null;
  if (input.fecha_programada) {
    const instante = new Date(input.fecha_programada);
    // Number.isNaN comprueba si la fecha resultante es inválida (ej: 32 de febrero o texto basura).
    if (Number.isNaN(instante.getTime())) throw errorCompra('Selecciona una fecha válida para la reserva.');
    fecha = instante.toISOString();
  }
  
  return {
    clave: input.clave, 
    id_restaurante: String(input.id_restaurante),
    // Ordena (sort) matemáticamente los IDs para que la firma de carritos idénticos sea siempre la misma,
    // y luego reconstruye (map) los objetos.
    items: [...cantidades].sort((a, b) => Number(a[0]) - Number(b[0])).map(([id_plato, cantidad]) => ({ id_plato, cantidad })),
    metodo_pago: input.metodo_pago, 
    id_tarjeta: input.metodo_pago === 'TARJETA' ? input.id_tarjeta || null : null,
    tipo_entrega: input.tipo_entrega,
    // Operador Ternario: Si es RECOGIDA, fuerza el texto; si no, limpia la dirección enviada (.trim()).
    direccion_envio: input.tipo_entrega === 'RECOGIDA' ? 'RECOGIDA EN LOCAL' : String(input.direccion_envio || '').trim(),
    // Doble Interrogación (??) (Fusión Nula): Usa la latitud del cliente, pero si viene vacía usa 'null' explícitamente.
    latitud_cliente: input.tipo_entrega === 'DOMICILIO' ? input.latitud_cliente ?? null : null,
    longitud_cliente: input.tipo_entrega === 'DOMICILIO' ? input.longitud_cliente ?? null : null,
    // Asigna el valor que calculamos más arriba.
    fecha_programada: fecha,
  };
}

/**
 * FÁBRICA DEL SERVICIO DE COMPRAS (El núcleo financiero)
 * Contiene toda la lógica de validación de precios, cobros y estado de pedidos.
 */
// Parámetros por defecto: se inyecta la BD (pool), la pasarela (stripe) y funciones de utilidad.
export function crearServicioCompras(pool, stripe, { ahora = () => new Date(), notificar = async () => {} } = {}) {
  
  // ============================================================================
  // SISTEMA DE BLOQUEO MUTUO (MUTEX) PARA PREVENIR DOBLES COBROS
  // ============================================================================
  // Si un usuario pulsa el botón "Pagar" dos veces seguidas muy rápido por lag, podrían
  // crearse dos peticiones simultáneas. Esta función usa los "Advisory Locks" de
  // PostgreSQL: funciona como un semáforo rojo en la base de datos.
  async function conBloqueo(clave, accion) {
    // Extrae un "cable privado" de la piscina (pool) para no mezclarse con otras peticiones.
    const conexion = await pool.connect();
    let bloqueado = false;
    try {
      // Intenta conseguir el candado virtual para esta compra específica.
      bloqueado = (await conexion.query('SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS bloqueado', ['compra:' + clave])).rows[0].bloqueado;
      // Si el candado estaba cerrado (bloqueado = false), lanza el error 'COMPRA_EN_PROCESO'.
      // Este código específico le dice al frontend que mantenga el botón girando sin mostrar un error rojo.
      if (!bloqueado) throw errorCompra('Esta compra se está procesando. Espera unos segundos y vuelve a comprobarla.', 'COMPRA_EN_PROCESO');
      // Si consigue el candado, ejecuta la lógica principal.
      return await accion(conexion);
    } finally {
      // El bloque 'finally' asegura que, pase lo que pase (incluso si hay un fallo de red,
      // el servidor explota o hay un error grave), el candado se suelte siempre para 
      // que la compra no quede bloqueada para siempre y se devuelva la conexión.
      try { if (bloqueado) await conexion.query('SELECT pg_advisory_unlock(hashtext($1)::bigint)', ['compra:' + clave]); }
      finally { conexion.release(); }
    }
  }

// EXPLICACIÓN DE LA FUNCIÓN 'leer':
// Es un atajo para no repetir código. Recibe la conexión (cx) y un ID de compra (clave).
// Envuelve la consulta a PostgreSQL entre paréntesis para poder encadenar '.rows[0]' 
// al instante. Así, extrae la fila exacta con los datos de la compra ignorando 
// todos los metadatos innecesarios que devuelve el servidor.
  const leer = async (cx, clave) => (await cx.query('SELECT * FROM Compras WHERE id_compra = $1', [clave])).rows[0];
  
// 'motivo' es un parámetro opcional. Si cambiamos la compra a 'CONFIRMADA', 
// no enviaremos ningún motivo, por lo que la función asignará automáticamente 'null'. 
// Si la cambiamos a 'CANCELADA', le enviaremos un texto explicando por qué, 
// y ese texto sobrescribirá el 'null'. Esto evita errores y hace el código más limpio.
  const cambiar = async (cx, compra, estado, motivo = null) => {
    // Lógica SQL pura (CASE WHEN...): Si el nuevo estado es 'RESERVADA', pone 'notificada' en FALSE
    // para obligar al sistema a enviarle un correo de aviso al usuario más adelante.
    const res = await cx.query("UPDATE Compras SET estado = $2, motivo = $3, actualizada = NOW(), notificada = CASE WHEN estado = 'RESERVADA' THEN FALSE ELSE notificada END WHERE id_compra = $1 RETURNING *", [compra.id_compra, estado, motivo]);
    return res.rows[0];
  };

  // ============================================================================
  // MOTOR DE COTIZACIÓN (Precios y Disponibilidad)
  // ============================================================================
  // 'fase = preparar' es un valor por defecto si no le pasamos el tercer parámetro al llamar la función.
  async function cotizar(cx, solicitud, fase = 'preparar') {
    // Ejecuta la función ahora() y guarda la hora exacta actual en la variable 'momento'.
    const momento = ahora();
    
    // Reactivaciones automáticas: Si el local o los platos estaban pausados hasta una hora específica,
    // y esa hora ya pasó respecto al 'momento' actual, los vuelve a activar (TRUE).
    await cx.query(`UPDATE Restaurantes SET aceptando_pedidos = TRUE, tiempo_reactivacion = NULL WHERE id_restaurante = $1 AND aceptando_pedidos = FALSE AND NULLIF(tiempo_reactivacion::text, '')::timestamptz <= $2::timestamptz`, [solicitud.id_restaurante, momento]);
    await cx.query(`UPDATE Platos SET disponible = TRUE, tiempo_disponible = NULL WHERE id_restaurante = $1 AND disponible = FALSE AND NULLIF(tiempo_disponible::text, '')::timestamptz <= $2::timestamptz`, [solicitud.id_restaurante, momento]);
    
    // FOR SHARE: Bloquea las filas en modo lectura. Previene que el dueño del restaurante borre 
    // o edite el plato justo en el milisegundo en el que el cliente lo está comprando.
    // Nunca se concatenan variables directamente en el texto SQL para evitar ataques 
  // de "Inyección SQL". PostgreSQL utiliza '$1' como un "marcador de posición seguro". 
  // La librería intercepta el array '[solicitud.id_restaurante]', lo limpia de cualquier 
  // código malicioso, y lo inyecta de forma segura en el hueco '$1' antes de ejecutar la búsqueda.
  //'solicitud' es la variable que contiene el carrito de la compra limpio del cliente (un Objeto).
// En JavaScript, el punto (.) se usa para acceder a las propiedades internas de un objeto.
// Al escribir 'solicitud.id_restaurante', el código extrae únicamente el ID del local 
// (ej: el número 5) y lo mete en el array para que PostgreSQL busque ese restaurante exacto.
// Cuando PostgreSQL responde a la consulta (await cx.query), devuelve un objeto 
// gigante con metadatos técnicos de la conexión. 
// - '.rows' aísla únicamente el Array (lista) con los datos reales encontrados.
// - '[0]' extrae directamente el primer (y único) elemento de esa lista.
// Esto permite guardar en la variable 'local' exclusivamente el objeto limpio del 
// restaurante, ahorrando líneas de código intermedias.
    const local = (await cx.query('SELECT * FROM Restaurantes WHERE id_restaurante = $1 FOR SHARE', [solicitud.id_restaurante])).rows[0];
    if (!local) throw errorCompra('El local ya no está disponible.');
    
    //En JavaScript, una variable (const ids) es solo un contenedor.
// Como el método .map() SIEMPRE devuelve un Array (lista) como resultado final de su trabajo,
// al usar el signo '=', estamos guardando esa lista resultante directamente dentro de 
// la variable 'ids'. A partir de aquí, 'ids' equivale a una lista plana (ej: [5, 8]).
// La palabra 'item' es un alias temporal inventado por el programador. 
// Representa el elemento individual que el bucle (.map) está leyendo en cada vuelta.
// Como el array original se llama 'items' (plural), por convención de lectura humana 
// se bautiza a la variable individual como 'item' (singular), pero podría llamarse de cualquier otra forma.
    const ids = solicitud.items.map(item => item.id_plato);

 /*   
    1. WITH RECURSIVE componentes(id) AS (...)
  Crea una "tabla temporal y virtual" llamada 'componentes' que existirá solo durante esta consulta. 
  La palabra RECURSIVE le otorga el superpoder de ejecutarse en bucle a sí misma.

  2. EL CASO BASE: SELECT unnest($1::int[])
  Es el punto de partida. Coge el array de JavaScript con los IDs del carrito (ej: [5, 12]) 
  que entra por el hueco $1, lo desempaqueta (unnest) y mete esos primeros números en 
  la tabla temporal 'componentes'.

  3. EL BUCLE: UNION SELECT mp.id_plato_incluido FROM Menu_Platos... JOIN componentes
  Aquí ocurre la magia. La base de datos revisa los números que acaba de meter y se pregunta: 
  "¿Alguno de estos platos es un Menú? Si lo es, entra en la tabla puente Menu_Platos, 
  saca todos los IDs de los platos que lleva incluidos, y añádelos a nuestra tabla temporal".
  Al ser recursivo, si un menú tuviera sub-menús dentro, seguiría escarbando hasta sacar todo.

  4. LA SELECCIÓN FINAL: SELECT p.* FROM Platos p WHERE p.id_plato IN (SELECT id FROM componentes)
  Ahora que la tabla temporal ya tiene la "lista maestra" con absolutamente todos los IDs 
  (los platos sueltos + los ingredientes desempaquetados de los menús), va a la tabla real 
  de Platos y extrae toda su información (nombre, precio, etc.).

  5. PROTECCIÓN DE CONCURRENCIA: ORDER BY p.id_plato FOR SHARE
  Ordena los resultados matemáticamente y les pone el "Candado de Lectura" (FOR SHARE). 
  Esto prohíbe terminantemente al dueño del restaurante borrar o modificar cualquiera de 
  esos ingredientes exactos hasta que se haya terminado de procesar el pago del cliente.
  
  6. EXTRACCIÓN JS: ], [ids])).rows;
  Inyecta la variable 'ids' en el $1(.rows), y extrae limpiamente la lista de resultados (.rows).

  */
    const productos = (await cx.query(`
      WITH RECURSIVE componentes(id) AS (
        SELECT unnest($1::int[])
        UNION SELECT mp.id_plato_incluido FROM Menu_Platos mp JOIN componentes c ON mp.id_menu = c.id
      )
      SELECT p.* FROM Platos p WHERE p.id_plato IN (SELECT id FROM componentes)
      ORDER BY p.id_plato FOR SHARE
    `, [ids])).rows;
    
    // ============================================================================
// DOBLE ESCUDO DE SEGURIDAD (Validación de Integridad del Carrito)
// ============================================================================
//EL MÉTODO .some():
// Es una función de alto rendimiento para Arrays. Evalúa si "al menos un" 
// elemento de la lista cumple una condición, devolviendo true o false. 
// Es muy eficiente porque hace "cortocircuito": en cuanto encuentra el primer 
// elemento que da 'true', se detiene y no sigue leyendo el resto de la lista.

// 2. COMPARACIÓN ESTRICTA Y TIPADO ( !== ):
// En JavaScript, '!==' comprueba que dos valores sean diferentes en valor Y en tipo 
// (un número 5 no es lo mismo que el texto "5"). 
// Aquí comparamos String(p.id_restaurante) con solicitud.id_restaurante. 
// Esto es seguro porque la función 'normalizarSolicitud' (ejecutada previamente) 
// ya forzó a que 'solicitud.id_restaurante' fuera un String. Así garantizamos que 
// estamos comparando (Texto !== Texto) y evitamos falsos positivos.
// El operador || (OR) separa dos validaciones críticas de seguridad.
// Si ALGUNA de las dos falla, se lanza el error y se bloquea la transacción.
if (
  // ESCUDO 1 (Anti-mezcla): 
  // Verifica si en la BD hay ALGÚN producto cuyo id_restaurante NO coincida con 
  // el id_restaurante del carrito. Evita comprar en 2 locales con un solo pago.
  productos.some(p => String(p.id_restaurante) !== solicitud.id_restaurante) 
  
  || 
  
  // ESCUDO 2 (Anti-fantasmas): 
  // Recorre los IDs que pide el cliente y verifica si ALGUNO de ellos NO fue 
  // encontrado en la BD. Evita cobrar productos que el dueño acaba de borrar del menú.
  // ============================================================================
// ANIDACIÓN DE MÉTODOS Y FUNCIONES FLECHA ( x => )
// ============================================================================

// 1. EL USO DE LA FLECHA (=>) EN .SOME():
// El método .some() exige una función que dicte la "regla" de búsqueda. 
// Usar la función flecha (ej: id => ...) es la forma moderna, anónima y 
// compacta de escribir esa regla en una sola línea sin usar la palabra 'function'.

// 2. EXPLICACIÓN DEL CÓDIGO ANIDADO (Inception):
// ids.some(id => !productos.some(p => String(p.id_plato) === id))
// 
// Esta línea es un bucle dentro de otro bucle:
// - Bucle interno (productos.some): Busca si el ID que pide el cliente coincide 
//   con algún plato real de la base de datos.
// - Operador NOT (!): Invierte el resultado. Si el plato NO se encuentra en 
//   la base de datos, devuelve TRUE (Verdadero, ¡es un plato fantasma!).
// - Bucle externo (ids.some): Recorre el carrito del cliente buscando si "ALGUNO" 
//   de sus platos ha dado TRUE en la prueba anterior. Si encuentra un fantasma, 
//   el escudo se activa y bloquea la compra completa.
  ids.some(id => !productos.some(p => String(p.id_plato) === id))
) {
  // Si cualquiera de las trampas o errores se cumple, aborta la compra.
  throw errorCompra('Selecciona productos existentes de este mismo local.');
}
    
    //Esta línea hace 3 cosas en un solo movimiento:
// 1. Extrae los IDs de los productos validados: productos.map(...)
// 2. Consulta a la BD qué ingredientes componen esos menús usando 'ANY($1::int[])', 
//    que es la forma óptima en PostgreSQL de buscar múltiples IDs de golpe. 
//    Aplica 'FOR SHARE' para bloquear la edición de los menús durante el pago.
// 3. Transforma la respuesta: .rows.map(v => [v.id_menu, v.id_plato_incluido])
//    Convierte la lista de objetos que devuelve SQL en una matriz limpia 
//    (un Array de Arrays, ej: [[menu, plato], [menu, plato]]), lo cual 
//    facilita enormemente los cálculos matemáticos posteriores en JavaScript.
// ============================================================================
// PASO DE ARRAYS A SQL: ANY($1::int[])
// ============================================================================

// Cuando necesitamos buscar múltiples IDs de golpe en la base de datos, 
// no podemos usar la sintaxis clásica 'IN ($1)' si enviamos un Array desde Node.js, 
// porque PostgreSQL no sabrá desempaquetarlo y dará un error de sintaxis.
//
// La solución profesional es usar ANY():
// 1. $1: Recibe el array de JavaScript (ej: [5, 8, 12]).
// 2. ::int[] : Fuerza a PostgreSQL a interpretar esos datos estrictamente 
//    como un Array de Números Enteros (Integer Array), evitando fallos de lectura.
// 3. ANY() : Comprueba si el 'id_menu' de la base de datos coincide con 
//    al menos uno de los números contenidos dentro de ese Array.
// ============================================================================
// DIFERENCIA CLAVE: IN (...) vs ANY (...)
// ============================================================================

// ¿Por qué no usamos el clásico 'IN' con variables dinámicas?
// 
// - El comando 'IN' espera una lista de valores escalares sueltos y separados 
//   por comas en el texto SQL (ej: IN (1, 2, 3)). 
// - Si inyectamos un array de JavaScript a través de un parámetro ($1), 
//   PostgreSQL lo recibe como un único objeto complejo (un tipo de dato Array), 
//   no como elementos sueltos. Al hacer 'IN ($1)', el motor compara el ID contra 
//   el array entero, provocando un error de tipos.
// 
// La solución es el operador 'ANY()'. Este comando está programado para abrir 
// internamente el objeto Array que recibe por el parámetro '$1' y evaluar la 
// condición contra cada uno de sus elementos individuales.
    const composicion_menu = (await cx.query('SELECT id_menu, id_plato_incluido FROM Menu_Platos WHERE id_menu = ANY($1::int[]) ORDER BY id_menu, id_plato_incluido FOR SHARE', [productos.map(p => p.id_plato)])).rows.map(v => [v.id_menu, v.id_plato_incluido]);
    
    const programada = solicitud.fecha_programada ? new Date(solicitud.fecha_programada) : null;

// ============================================================================
// ANÁLISIS DE STRINGS: EL MÉTODO .startsWith()
// ============================================================================

// El método .startsWith() evalúa si una cadena de texto comienza exactamente 
// con los caracteres indicados entre paréntesis. 
// Devuelve un valor Booleano (true o false).
// 
// En este caso, se utiliza para categorizar acciones de forma dinámica. 
// Si la variable 'fase' contiene textos como "activar_usuario" o "activar_menu", 
// la constante 'activando' será 'true'. Si contiene "desactivar_x" o cualquier 
// otra palabra, será 'false'. Esto permite bifurcar la lógica del programa 
// (encender vs apagar) de forma muy limpia.
    const activando = fase.startsWith('activar');
    
    if (programada && !activando) {
      // Regla de negocio: Las reservas deben hacerse con un mínimo de 15 minutos de antelación y un máximo de 7 días.
      const minimo = fase === 'preparar' ? 15 * 60_000 : 0; // 60_000 son milisegundos (1 minuto).
      if (programada.getTime() < momento.getTime() + minimo || programada.getTime() > momento.getTime() + 7 * 86400_000) throw errorCompra('Elige una hora futura: entre 15 minutos y 7 días al reservar.');
    }
    
    // 3. EXPLICACIÓN DE OBJETIVO (Operador Ternario)
    // Lee la condición: Si hay una fecha programada AND no estamos en la fase de activación, 
    // entonces la fecha "objetivo" a evaluar será esa fecha programada. 
    // Si no (los dos puntos ':'), el objetivo es el "momento" actual (ahora mismo).
    const objetivo = programada && !activando ? programada : momento;
    
    
// DIFERENCIA ENTRE CONST Y LA FLECHA (=>)
// ============================================================================

// La palabra 'const' NO sustituye a 'function'. 'const' simplemente declara 
// una variable inmutable (una constante) en la memoria, que puede almacenar 
// números, textos o funciones.
// 
// El elemento que realmente sustituye a la antigua palabra reservada 'function' 
// es el Operador Flecha ( => ).
// 
// Al combinar ambos (const miFuncion = () => {}), dividimos el trabajo:
// 1. La flecha (=>) crea la lógica y el comportamiento de la función.
// 2. El 'const' guarda esa lógica en un contenedor bloqueado, evitando que 
//    el motor de JavaScript o un error humano sobrescriba o destruya 
//    la función accidentalmente en otra parte del código.
    // 4. FUNCIÓN INTERNA DE COMPROBACIÓN
    // Esta pequeña función se crea aquí para no repetir código. Comprueba pausas temporales.
    const comprobar = (disponible, reactivacion, nombre) => {
      // Si el elemento está disponible (es decir, no es estrictamente falso), 
      // usa 'return' para salir inmediatamente de esta función porque todo está bien.
      if (disponible !== false) return;
      
      // ============================================================================
// CLOSURES (CLAUSURAS) Y ÁMBITO LÉXICO
// ============================================================================

// ¿Cómo es posible que esta función utilice la variable 'objetivo' si no 
// se la hemos pasado por los parámetros (disponible, reactivacion, nombre)?
// 
// Esto es posible gracias a una característica de JavaScript llamada "Closure".
// Cuando defines una función dentro de otra función, la función interna tiene 
// acceso automático a todas las variables de la función que la envuelve (su padre).
// 
// La variable 'objetivo' fue declarada unas líneas más arriba en el ámbito general 
// de la función padre. Por lo tanto, nuestra función flecha 'comprobar' puede 
// "mirar hacia afuera" y leer el valor de 'objetivo' sin necesidad de que se 
// lo inyectemos explícitamente en sus parámetros. Esto mantiene el código más limpio.
      // Si llegamos aquí, es porque estaba inactivo (false).
      // Si no tiene fecha de reactivación (!reactivacion) OR la fecha en la que 
      // volverá a estar activo es MAYOR (posterior) a nuestro tiempo 'objetivo' de compra, lanza error.
      if (!reactivacion || new Date(reactivacion) > objetivo) {
        // ============================================================================
// TEMPLATE LITERALS (INTERPOLACIÓN DE VARIABLES: ${...})
// ============================================================================

// La sintaxis ${variable} se utiliza para inyectar dinámicamente el valor de 
// una variable de JavaScript directamente dentro de una cadena de texto.
// 
// Para que esto funcione, el texto completo debe ir envuelto obligatoriamente 
// en comillas invertidas o acentos graves ( ` ` ) en lugar de comillas normales.
// 
// Sustituye a la antigua y propensa a errores concatenación clásica con el 
// operador de suma (ejemplo antiguo: "El producto " + nombre + " no está").
// Esto hace que el código sea mucho más limpio, fácil de leer y permite 
// introducir saltos de línea reales dentro del texto sin romper el código.







          throw errorCompra(`${nombre} no estará disponible a esa hour. Elige otra hour o retira el producto del carrito.`, 'NO_DISPONIBLE');
      }
    };
    
    // 5. LLAMADAS A LA FUNCIÓN DE COMPROBACIÓN
    // Primero, ejecuta la función para evaluar el restaurante entero.
    comprobar(local.aceptando_pedidos, local.tiempo_reactivacion, 'El local');
    
    // Luego, usa un bucle FOR para enviar cada producto individualmente a la misma función.
    //1. FORMA MODERNA (ES6+):
// for (const producto of productos) { ... }
// El operador 'of' extrae directamente el VALOR de cada elemento de la lista.
// Es más limpio y evita tener que llevar la cuenta matemática de la posición.

// 2. FORMA ANTIGUA (Bucle clásico por índice):
// for (let i = 0; i < productos.length; i++) {
//   const producto = productos[i];
    for (const producto of productos) {
        comprobar(producto.disponible, producto.tiempo_disponible, '«' + producto.nombre + '»');
    }
    
    // Evalúa si el texto es exactamente 'RECOGIDA' y guarda true o false.
    //¿Cómo sabemos si la constante 'recogida' almacena true o false?
// El resultado es dinámico y depende de los datos que el cliente (frontend) 
// envíe dentro del objeto 'solicitud'.
// 
// El motor de JavaScript resuelve esta línea en dos pasos lógicos:
// 1. Evaluación (===): Compara estrictamente el valor recibido contra la palabra.
//    - Si solicitud.tipo_entrega vale exactamente "RECOGIDA" -> Devuelve true.
//    - Si vale "DOMICILIO", "recogida" (minúsculas) o no existe -> Devuelve false.
// 
// 2. Asignación (=): El operador de asignación simple (=) toma el resultado 
//    lógico de esa comparación (el true o el false) y lo almacena 
//    definitivamente en la constante 'recogida' para usarlo en cálculos futuros.
    const recogida = solicitud.tipo_entrega === 'RECOGIDA';
    
    // 6. EXPLICACIÓN DE 'LET'
    // 'let' declara una variable que puede reasignarse. Empieza en 0, pero si es a domicilio
    // cambiará su valor por los kilómetros reales más abajo.
    let distancia = 0;
    
    // Validaciones logísticas: Distancias y Zonas de reparto
    //Cuando una variable ya almacena un valor Booleano puro (true o false), 
// no es necesario volver a compararla usando '=== true' o '=== false'.
// 
// - Práctica redundante (Novato): if (recogida === true)
// - Práctica limpia (Profesional): if (recogida)
// 
// El condicional 'if' internamente solo necesita un 'true' o 'false' para actuar. 
// Al pasarle la variable directamente, el motor lee su valor y lo sustituye, 
// evaluándolo como 'if (true)' o 'if (false)' de forma automática y óptima.
// 
// Para evaluar el caso negativo (false), usamos el operador de negación (!):
// if (!recogida) // Se lee como: "Si NO es recogida"
// Escribir 'if (recogida)' es la forma abreviada y estándar de preguntar 
// 'if (recogida === true)'. 
// 
// La estructura de control 'if' evalúa inherentemente la "veracidad" (truthiness) 
// de lo que hay entre sus paréntesis. 
// - Si la variable 'recogida' es false, el motor evalúa 'if (false)'. No se 
//   produce ningún error; simplemente se ignora el bloque de código interno 
//   y la ejecución continúa en la línea siguiente.
// - Si es true, el motor evalúa 'if (true)' y ejecuta el bloque interno.
// 
// Omitir el '=== true' elimina redundancia lógica y hace el código más limpio.
    if (recogida) { // Si 'recogida' es verdadero (true)
      // El operador de exclamación (!) invierte estrictamente un valor booleano:
// !true  -> devuelve false
// !false -> devuelve true
// 
// Además de invertir, actúa como un "coercionador" de tipos. Si se aplica sobre  
// un valor que no es un booleano puro (como un número, objeto o texto), el motor 
// de JavaScript primero evalúa si el valor original es "Truthy" o "Falsy", 
// y luego devuelve el booleano exactamente opuesto.
//
// Ejemplos comunes de valores "Falsy" que al negarse (!) devuelven TRUE:
// !0         // true (el número cero es falsy)
// !""        // true (un string vacío es falsy)
// !undefined // true (la ausencia de valor es falsy)
// !null      // true (el valor nulo es falsy)
      if (programada && !activando) {
        // La confirmación conserva el margen validado al preparar la compra.
        // Math.min() elige la fecha más antigua entre el 'momento' actual y 15 minutos antes de la hora programada.
        const referencia = fase === 'preparar' ? momento : new Date(Math.min(momento.getTime(), programada.getTime() - 15 * 60_000));
        validarFechaRecogida(local.horarios_recogida, solicitud.fecha_programada, referencia);
        
      // '!' invierte el resultado. Si recogidaDisponible() devuelve falso (local cerrado), 
      // el '!' lo convierte en verdadero y ejecuta el error.
      } else if (!recogidaDisponible(local.horarios_recogida, momento)) {
          throw errorCompra('La recogida no está disponible ahora.', 'NO_DISPONIBLE');
      }
      
    } else if (fase !== 'activar-antiguo') { // Si NO es recogida (es a domicilio)
      if (!solicitud.direccion_envio || solicitud.direccion_envio.length > 1000) throw errorCompra('Introduce una dirección de entrega válida.');
      distancia = validarZonaEntrega(local, solicitud.latitud_cliente, solicitud.longitud_cliente);
    }
    
    // 7. EXPLICACIÓN DE MAP Y FIND
    // .map() transforma la lista de items del carrito creando una lista nueva.
    const items = solicitud.items.map(item => {
  // 1. BÚSQUEDA Y SEGURIDAD DE TIPOS (DEFENSA CONTRA INTERNET)
  // 'solicitud.items' contiene los datos no confiables que viajan desde el móvil del cliente.
  // 'productos' es nuestra "fuente de la verdad" segura sacada de la base de datos.
  // Usamos String(p.id_plato) para forzar el ID de la base de datos (que suele ser Número) 
  // a Texto. Así garantizamos que el operador estricto (===) no falle al compararlo con 
  // el ID que llega de internet (que suele ser Texto).
  const producto = productos.find(p => String(p.id_plato) === item.id_plato);
  
  // 2. MATEMÁTICAS FINANCIERAS SEGURAS
  // Ignoramos el precio que envía el cliente (evitando hackeos) y usamos el de nuestra BD.
  // Convertimos el dinero a números enteros (céntimos) para evitar el fallo estructural 
  // de JavaScript al sumar decimales (punto flotante, ej: 0.1 + 0.2 = 0.30000000000000004).
  const precio_centimos = centimos(producto.precio);
  
  // 3. ENSAMBLAJE FINAL CON SPREAD OPERATOR (...)
  // Devolvemos el objeto que conformará la nueva lista generada por .map().
  // Los tres puntos (...item) "desparraman" automáticamente todos los datos originales 
  // del cliente (cantidad, notas) para no perderlos ni tener que reescribirlos a mano.
  // A eso le fusionamos nuestros datos 100% seguros: nombre oficial y precios calculados.
  return { 
    ...item, 
    nombre: producto.nombre, 
    precio_centimos, 
    precio: precio_centimos / 100 
  };
});
    
    // 8. EXPLICACIÓN DE REDUCE
    // .reduce() coge la lista entera de items y los reduce a un solo número (el precio total).
    // Funciona como un acumulador. 'suma' empieza valiendo 0, y por cada 'item' en el carrito, 
    // le suma (precio_centimos * cantidad).
    // El método .reduce() procesa listas ejecutando un bucle interno oculto y 
// delegando la lógica matemática a una función inyectada como parámetro.
//
// Estructura real que procesa la máquina:
// array.reduce( Parametro1_FuncionCallback , Parametro2_ValorInicial )
//
// 1. El Callback (suma, item) => { ... }:
//    - 'suma' (Acumulador): Mantiene el estado continuo a lo largo del bucle.
//    - 'item' (Elemento actual): El objeto que se evalúa en el ciclo presente.
//    Es una Función de Primera Clase inyectada como "manual de instrucciones".
//
// 2. El Valor Inicial (0):
//    Obligatorio al reducir objetos a números. Actúa como el segundo parámetro 
//    aislado de .reduce(), definiendo el Tipo de Dato inicial para prevenir 
//    errores de coerción de tipos (Type Coercion) en la primera iteración.
// ¿Cómo sabe el motor de JavaScript que el 0 es el valor inicial?
// La respuesta es la firma oficial del método (su diseño estructural). 
// JavaScript lee los argumentos basándose estrictamente en su posición, 
// separados por una coma (,).
//
// Firma oficial del lenguaje:
// Array.prototype.reduce( callbackFn , initialValue )
// 
// 1. Primer argumento (callbackFn): Todo el bloque de código antes de la 
//    última coma. Es la lógica de ejecución.
// 
// 2. Segundo argumento (initialValue): Todo lo que hay después de la 
//    última coma. Es el estado de arranque.
// 
// Ejemplo visual simplificado:
// items.reduce( FUNCION_GIGANTE , 0 );
// 
// El ordenador no adivina qué es el 0 por su forma de número, sino porque 
// ocupa exactamente la segunda silla (después de la coma) en la función reduce.
// La mayor fuente de confusión al usar .reduce() es que rompe el estándar 
// de parámetros del resto de métodos de arrays en JavaScript.
// 
// - En métodos comunes (.map, .find, .forEach): 
//   El parámetro 1 es SIEMPRE el elemento actual (item).
//   Ej: array.map((item) => ...)
//
// - En el método .reduce():
//   El parámetro 1 es el Acumulador (la memoria arrastrada).
//   El parámetro 2 pasa a ser el Elemento actual (item).
//   Ej: array.reduce((acumulador, item) => ..., 0)
//
// Regla mnemotécnica: .reduce() es el método de la "Memoria", por lo tanto, 
// la memoria (acumulador) exige ocupar el primer lugar en la función.
// Error común: Confundir la función callback entera con el acumulador.
// (suma, item) => suma + item.precio // <-- ESTO NO ES EL ACUMULADOR
// 
// Definiciones estrictas:
// 1. EL CALLBACK: Es TODA la función flecha. Es el "Manual de reglas".
// 2. EL ACUMULADOR: Es ÚNICAMENTE el primer parámetro dentro de los 
//    paréntesis de esa función (la variable 'suma'). Es la "memoria".
// 3. LA ADICIÓN: Es la operación matemática (item.precio). Es "lo que se suma".
// 4. EL VALOR INICIAL: Es el número 0 al final de reduce(). Es "el saldo inicial".
//
// El '0' no se suma a nada activamente, simplemente se inyecta dentro 
// de la variable 'suma' durante la iteración número 1 para evitar que 
// empiece siendo 'undefined'.
    const subtotal_centimos = items.reduce((suma, item) => suma + item.precio_centimos * item.cantidad, 0);
    
    const envio_centimos = costeEnvio(subtotal_centimos, local.tipo, distancia, recogida);
    const total_centimos = subtotal_centimos + envio_centimos;
    
    // Validación de mínimos impuestos por Stripe (50 céntimos).
    if (total_centimos > 99999999 || solicitud.metodo_pago === 'TARJETA' && total_centimos < 50) throw errorCompra('El importe de la compra no es válido.');
    
    return { items, subtotal_centimos, envio_centimos, total_centimos, composicion_menu, nombre_restaurante: local.nombre };
  }
//////
  // ============================================================================
  // INTEGRACIÓN CON STRIPE (Pasarela de pagos)
  // ============================================================================
  
  // 'async' obliga a esta función a devolver siempre una Promesa, incluso si 
  // devuelve 'null' en la primera línea, manteniendo el código consistente.
  // La palabra clave 'async' delante de una función tiene dos efectos técnicos:
// 1. Habilita el uso de la palabra 'await' en su interior.
// 2. Modifica el comportamiento del 'return', envolviendo automáticamente 
//    cualquier valor devuelto en una Promesa (Promise.resolve).
//
// Consistencia de la API (El porqué del comentario):
// Si una función tiene rutas de código asíncronas (consultas a DB) y rutas 
// síncronas (cláusulas de guarda que devuelven null de inmediato), el tipo 
// de dato devuelto sería inconsistente. 
//
// Al declarar la función como 'async', forzamos a que incluso el 'return null' 
// más rápido se convierta en una Promesa. Así, el código consumidor que invoca 
// a la función puede usar siempre 'await' de forma segura sin miedo a que 
// la aplicación colapse por un cambio de tipo de dato inesperado.
// Una Promesa (Promise) es un objeto que representa la terminación o el 
// fracaso eventual de una operación asíncrona. Sirve para evitar el bloqueo 
// (blocking) del hilo principal de ejecución en JavaScript (Single-Threaded).
//
// Una Promesa tiene 3 estados posibles:
// 1. Pending (Pendiente): Estado inicial. La operación aún no ha terminado.
// 2. Fulfilled (Resuelta): La operación terminó con éxito (llama a 'resolve').
// 3. Rejected (Rechazada): La operación falló (llama a 'reject').
//
// Consumo tradicional vs Moderno:
// - Tradicional: Se usan los métodos .then() para capturar el éxito y 
//   .catch() para capturar el error.
// - Moderno: Se usa la sintaxis 'async/await', que "pausa" visualmente el 
//   código hasta que la Promesa se resuelve, haciendo que el código asíncrono 
//   se lea de arriba a abajo como si fuera código síncrono clásico.
  async function recuperarIntencion(compra) {
    if (!compra.payment_intent_id) return null;
    
    // ============================================================================
// CONEXIÓN CON STRIPE: RECUPERACIÓN Y EXPANSIÓN DE DATOS BANCARIOS
// ============================================================================

// Pide a Stripe el estado actual del pago. { expand: ['latest_charge'] } le dice a Stripe 
// que incluya todos los detalles de la tarjeta usada dentro de la misma respuesta.
// 'retrieve' es simplemente el nombre que los arquitectos de software de Stripe 
// decidieron darle a la función encargada de realizar peticiones HTTP GET 
// contra su endpoint de "Payment Intents". No es código nativo de JavaScript.
return stripe.paymentIntents.retrieve(
  
  // PARÁMETRO 1: EL LOCALIZADOR (Identificador)
  // Es el ID único (ej: 'pi_12345') que guardamos en nuestra base de datos.
  // Funciona como el número de seguimiento de un paquete postal.
  compra.payment_intent_id, 

  // PARÁMETRO 2: CONFIGURACIÓN DE RED Y DICCIONARIO EXTERNO
  // 'latest_charge' no es una variable local nuestra. Es un texto (String) literal
  // extraído directamente de la Documentación Oficial de Stripe.
  // Al enviarlo dentro de la propiedad 'expand', obligamos al servidor de Stripe 
  // a hacer un esfuerzo extra antes de responder: sustituir el ID básico del cobro 
  // por un Objeto completo con los datos del banco, tipo de tarjeta y recibo.
  // Esto nos ahorra hacer una segunda petición a internet.
  { expand: ['latest_charge'] }

); // El 'return' inicial captura la Promesa generada por esta petición de red 
   // y la devuelve hacia arriba para que el servidor pueda esperar con 'await'.
}

  function comprobarIntencion(compra, intencion) {
    // Escudo antifraude: Comprueba que el usuario no haya manipulado la petición en el frontend 
    // intentando asociar un pago de 1€ a una compra de 100€, o pagando con una tarjeta distinta a la elegida.
    if (intencion.id !== compra.payment_intent_id || intencion.amount !== compra.total_centimos || intencion.currency !== 'eur' || intencion.capture_method !== 'manual' || idStripe(intencion.payment_method) !== compra.solicitud.id_tarjeta || intencion.metadata?.id_compra !== compra.id_compra || intencion.metadata?.id_usuario !== String(compra.id_usuario)) throw errorCompra('No se ha podido verificar el pago de esta compra.', 'PAGO_NO_VERIFICADO');
  }

  // Traductor de estados: Convierte los estados de la base de datos a mensajes legibles para el cliente.
  async function resultado(cx, compra, intencion = null) {
  // [1. CONSULTA BD Y ASINCRONÍA]
  // 'await': Pausa la ejecución de esta función hasta que la base de datos responda, sin bloquear el servidor.
  // '$1': Consulta parametrizada. Inyecta el ID de forma segura para evitar ataques de Inyección SQL.
  // '.rows': Desecha los metadatos técnicos de la base de datos y extrae únicamente el Array con los platos puros.
  const pedidos = (await cx.query('SELECT * FROM Pedidos WHERE id_compra = $1 ORDER BY id_pedido', [compra.id_compra])).rows;
  
  // [2. PATRÓN DE DICCIONARIO]
  // Evita usar decenas de condicionales (if/else). Actúa como un traductor directo
  // entre los códigos técnicos de la máquina ('BORRADOR') y el texto amigable para el cliente.
  const mensajes = {
    BORRADOR: 'Revisa el importe y confirma la compra.',
    AUTORIZADA: 'El pedido completo está guardado. Estamos confirmando el pago; no vuelvas a pagar.',
    // Operador ternario (? :): Cambia dinámicamente la frase dependiendo de si el pago es en efectivo o con tarjeta.
    RESERVADA: compra.solicitud.metodo_pago === 'TARJETA' ? 'Reserva confirmada. El banco retiene el importe; se cobrará a la hora reservada, cuando todo esté disponible. Si no lo está en los 30 minutos siguientes, cancelaremos la reserva y liberaremos la retención.' : 'Reserva confirmada. Se enviará al local a la hora elegida, cuando todo esté disponible. Si no lo está en los 30 minutos siguientes, se cancelará.',
    CONFIRMADA: 'El local ha recibido tu pedido completo.',
    CANCELANDO: 'Compra cancelada. Estamos liberando la autorización de tu tarjeta.',
    CANCELADA: 'Compra cancelada. No se ha efectuado ningún cobro.',
    REEMBOLSO_PENDIENTE: 'Compra cancelada. Estamos tramitando la devolución del pago.',
    REEMBOLSADA: 'La devolución se ha tramitado. Tu banco determina cuándo aparece en tu cuenta.',
    REEMBOLSO_FALLIDO: 'El banco no ha completado la devolución. Contacta con el local para resolverla.',
  };
  
  // [3. FORMATEO DE SALIDA (DTO)]
  // Empaqueta los datos con la estructura exacta que la aplicación móvil espera recibir.
  return {
    id_compra: compra.id_compra, 
    estado: compra.estado, 
    
    // CONVERSIÓN DE DIVISA: Divide entre 100. Deshace la protección del backend (que calcula
    // en enteros para no perder precisión decimal) para mostrar Euros reales en el Frontend.
    subtotal: compra.resumen.subtotal_centimos / 100,
    envio: compra.resumen.envio_centimos / 100, 
    total: compra.total_centimos / 100,
    
    // REGLA DE SEGURIDAD: Solo envía la clave secreta de pago (client_secret) si el pedido
    // sigue en 'BORRADOR'. Si ya se autorizó, envía 'null' para bloquear cualquier doble cobro accidental.
    client_secret: compra.estado === 'BORRADOR' ? intencion?.client_secret || null : null,
    
    fecha_programada: compra.solicitud.fecha_programada, 
    autorizacion_hasta: fechaISO(compra.autorizacion_hasta),
    items: compra.resumen.items, 
    
    // MUTACIÓN DE DATOS CON .MAP: Recorre el Array de platos puros de la BD e inyecta propiedades nuevas
    // (estado_pago), renombra columnas (nombre_producto a nombre_plato) y convierte los precios a Euros.
    pedidos: pedidos.map(p => ({ 
      ...p, 
      estado_pago: compra.estado, 
      nombre_plato: p.nombre_producto, 
      precio_plato: p.precio_centimos / 100 
    })), 
    
    // CORTOCIRCUITO LÓGICO (||): Lee de izquierda a derecha. Si hay un motivo manual, lo usa.
    // Si no, busca la traducción en el diccionario. Si el estado no existe, muestra el genérico.
    mensaje: compra.motivo || mensajes[compra.estado] || 'Estamos comprobando la compra.',
  };
}

  async function notificarUnaVez(cx, compra) {
    // ============================================================================
    // CLÁUSULA DE GUARDA (EL PORTERO DE LA DISCOTECA)
    // ============================================================================

    if (
      // MOTIVO A: ¿El cliente ya recibió un aviso previamente?
      // Si esto es 'true', significa que ya se le envió el email en el pasado.
      compra.notificada 
      
      || // Operador "O" lógico (Si se cumple el Motivo A, o el Motivo B)
      
      // MOTIVO B: ¿El estado actual NO es válido para avisar al restaurante?
      // 1. Creamos un Array (lista) con los únicos estados válidos: ['RESERVADA', 'CONFIRMADA']
      // 2. .includes(compra.estado) busca si el estado actual está dentro de esa lista.
      // 3. El símbolo de exclamación (!) invierte el resultado: si NO está en la lista, da 'true'.
      !['RESERVADA', 'CONFIRMADA'].includes(compra.estado)
    ) {
      
      // EL FRENO DE EMERGENCIA (Trabajo 2 del return)
      // Como el return está vacío (no hay datos a su derecha), actúa como un botón de pánico.
      // Si el 'if' SÍ SE CUMPLE (la compra ya se notificó o el estado es inválido):
      // El motor lee este 'return' y aborta la función instantáneamente.
      // Así evitamos enviar emails duplicados o avisar de pedidos cancelados.
      return; 
    }

    // Si el 'if' NO SE CUMPLE (es una compra nueva y en estado válido):
    // El motor ignora el 'return', pasa de largo y continúa leyendo el código de aquí abajo
    // (que será donde realmente estén las instrucciones para enviar el correo).
    
    // ============================================================================
// ENVÍO DE NOTIFICACIONES Y ACTUALIZACIÓN DE ESTADO
// ============================================================================

// [1. LA RED DE SEGURIDAD (TRY / CATCH)]
// Intenta enviar la notificación. Si el servidor de correos se cae o hay un corte de red, 
// el bloque catch atrapa el error y lo imprime en consola. Esto es VITAL porque evita 
// que un fallo secundario (un email no enviado) haga colapsar/explotar el servidor completo.
try {
  
  // [2. CONSULTA ANIDADA: EXTRACCIÓN DE LA LISTA COMPLETA]
  // La función 'notificar' necesita saber qué pidió el cliente. 
  // - $1: Usamos consulta parametrizada para protegernos de hackers (Inyección SQL).
  // - .rows: Extraemos la matriz de datos puras de la caja técnica. 
  // - NO usamos [0]: Porque un cliente pide múltiples cosas. Necesitamos pasarle a 
  //   la función notificar el Array completo con todos los platos, no solo el primero.
  await notificar(
    compra, 
    (await cx.query('SELECT * FROM Pedidos WHERE id_compra = $1', [compra.id_compra])).rows, 
    cx
  );

  // [3. EL UPDATE "DISPARA Y OLVIDA" (FIRE AND FORGET)]
  // Si la notificación se envió con éxito (el código no saltó al catch), le decimos 
  // a la base de datos que marque esta compra como notificada.
  // ¿Por qué no hay .rowCount ni .rows aquí? 
  // Porque no nos interesa guardar ni auditar el resultado en ninguna variable. 
  // Confiamos en que funcione para que, en el futuro, la "Cláusula de Guarda" (el portero 
  // de la discoteca del paso anterior) lea que ya está notificada y bloquee emails duplicados.
  await cx.query('UPDATE Compras SET notificada = TRUE WHERE id_compra = $1', [compra.id_compra]);
  
} catch (error) { 
  
  // [4. EL AMORTIGUADOR (CATCH)]
  // Si cualquiera de las promesas de arriba (los await) falla y lanza un error,
  // el código aborta el bloque 'try', salta directamente aquí y deja un registro
  // silencioso en los logs del servidor para que el programador lo revise luego.
  console.error('No se pudo notificar la compra:', error.code || 'NOTIFICACION'); 
  
}
  }











////////////////








  // ============================================================================
  // GESTIÓN DE CANCELACIONES Y REEMBOLSOS (Idempotencia)
  // ============================================================================
  async function finalizarCancelacion(cx, compra) {
    // El símbolo de exclamación (!) al principio significa "NO existe", "está vacío" o "es nulo".
// Le pregunta al objeto: "¿Es cierto que a esta compra le falta su código de Stripe?"
    if (!compra.payment_intent_id) 
      // EL RETURN DE DOBLE ACCIÓN (Freno + Repartidor)
  // 1. Freno: Como está dentro de un 'if', sigue matando esta función al instante.
  // 2. Repartidor: Como TIENE algo a su derecha, antes de morir le pasa "el paquete" 
  // (el problema) a la función 'cambiar' para que ella se encargue de arreglar el desastre.
      return cambiar(cx, compra, 'CANCELADA', compra.motivo);
    try {
      // ============================================================================
// EL PORQUÉ DEL 'AWAIT' Y QUÉ ES REALMENTE 'COMPRA'
// ============================================================================

// 1. ¿QUÉ ES 'COMPRA'?
// Es simplemente un objeto JSON normal y corriente que vive en la memoria RAM 
// de tu servidor en este momento. Es como el "ticket de papel" del restaurante.
// Sí, sus datos se sacaron de la base de datos un poco antes, pero ahora 
// mismo es solo un trozo de texto con datos como:
// { id_compra: 5, estado: 'BORRADOR', payment_intent_id: 'pi_123...' }

// 2. ¿POR QUÉ EL AWAIT?
// El await afecta a la FUNCIÓN (la acción), no a la variable (el ticket).
      const intencion = await recuperarIntencion(compra);
      // Es el equivalente en la vida real a decirle a un camarero:
// "Toma este ticket (compra). Vete a la cocina a preguntar (recuperarIntencion) 
// y ESPERA (await) allí quieto hasta que el cocinero (Stripe) te dé la respuesta (intencion)".
      comprobarIntencion(compra, intencion);
      
      // Si el pago ya había sido cobrado físicamente ('succeeded'), se debe emitir un REEMBOLSO.
      if (intencion.status === 'succeeded') {
        
        // Operador Ternario: Si ya existe un ID de reembolso, pide a Stripe su estado. 
        // Si no existe, dile a Stripe que cree un reembolso nuevo.
        const devolucion = compra.refund_id ? await stripe.refunds.retrieve(compra.refund_id) : await stripe.refunds.create({ payment_intent: intencion.id }, { idempotencyKey: 'nexbite-reembolso-' + compra.id_compra });
        
        // Si no teníamos guardado el ID del reembolso en nuestra BD, lo guardamos ahora.
        // '$1' y '$2' se rellenan con el array seguro [compra.id_compra, devolucion.id].
        if (!compra.refund_id) await cx.query('UPDATE Compras SET refund_id = $2 WHERE id_compra = $1', [compra.id_compra, devolucion.id]);
        
        if (devolucion.status === 'succeeded') return cambiar(cx, compra, 'REEMBOLSADA');
        
        // Si Stripe indica que el reembolso ha fallado o fue cancelado por el banco, actualizamos el estado.
        if (['failed', 'canceled'].includes(devolucion.status)) return cambiar(cx, compra, 'REEMBOLSO_FALLIDO', 'El banco no ha completado la devolución. Contacta con el local para resolverla.');
        return cambiar(cx, compra, 'REEMBOLSO_PENDIENTE', 'La devolución del pago está pendiente de confirmación.');
      }
      
      // ============================================================================
// LA REGLA DE LAS POSICIONES EN JAVASCRIPT (Firma de la función)
// ============================================================================

// El manual de Stripe dice que su función acepta hasta 3 parámetros en este orden:
// stripe.paymentIntents.cancel( Identificador, Datos_del_negocio, Opciones_de_red )

await stripe.paymentIntents.cancel(
  
  // HUECO 1: Identificador (Obligatorio)
  // Siempre tiene que ser el texto con el ID del cobro ('pi_123').
  intencion.id, 
  
  // HUECO 2: Datos del negocio (Opcional, pero posicionalmente necesario)
  // Aquí Stripe permite enviar información como { cancellation_reason: 'fraudulent' }.
  // Tu código no necesita enviar un motivo, pero en JavaScript no puedes "saltarte" 
  // el hueco 2 para llegar al hueco 3. Si pones el hueco 3 en la segunda posición, 
  // Stripe pensará que es el hueco 2 y explotará.
  // Por eso ponemos {} (un objeto vacío). Sirve como un "puente" para rellenar el espacio.
  {}, 
  
  // HUECO 3: Opciones de Red (Opcional)
  // Aquí es donde el manual de Stripe dice que debes poner configuraciones 
  // de seguridad del servidor, como la clave de idempotencia.
  { idempotencyKey: 'nexbite-cancelar-' + compra.id_compra }
  
);
      return cambiar(cx, compra, 'CANCELADA', compra.motivo);
    } catch (error) {
      // Si ocurre un error, imprime el código de error. El || 'CONEXION' significa: 
      // "Si no hay código de error, imprime la palabra 'CONEXION' por defecto".
      console.error('Cancelación pendiente de conciliar:', error.code || 'CONEXION');
      return compra;
    }
  }

  async function cancelar(cx, compra, motivo) {
    if (finales.has(compra.estado)) return compra;
    
    // TRANSACCIÓN SQL: 'BEGIN' avisa a PostgreSQL de que vamos a hacer varios cambios y que 
    // no guarde nada definitivamente hasta que le digamos 'COMMIT'.
    await cx.query('BEGIN');
    try {
      compra = await cambiar(cx, compra, 'CANCELANDO', motivo);
      await cx.query("UPDATE Pedidos SET estado = 'CANCELADO' WHERE id_compra = $1", [compra.id_compra]);
      await cx.query('COMMIT'); 
    } catch (error) { 
      // Si algo falla a medias, 'ROLLBACK' deshace los cambios en la BD para no dejar datos corruptos,
      // y 'throw error' empuja el error hacia arriba para que el sistema lo maneje.
      await cx.query('ROLLBACK'); throw error; 
    }
    
    return finalizarCancelacion(cx, compra);
  }

  async function capturar(cx, compra, intencion) {
    comprobarIntencion(compra, intencion);
    // 'requires_capture': El banco retuvo el dinero, pero aún no lo hemos cobrado.
    // 'capture' mueve físicamente el dinero de la cuenta del usuario a la cuenta del restaurante.
    if (intencion.status === 'requires_capture') {
      try {
        intencion = await stripe.paymentIntents.capture(intencion.id, {}, { idempotencyKey: 'nexbite-capturar-' + compra.id_compra });
      } catch (error) {
        console.error('Pago pendiente de conciliar:', error.code || 'CONEXION');
        return compra;
      }
    }
    
    if (intencion.status === 'succeeded') {
      // Seguridad: Comprueba que Stripe capturó el importe exacto que cuesta el carrito.
      if (intencion.amount_received !== compra.total_centimos) return cancelar(cx, compra, 'El importe recibido no coincide con el pedido. Se ha cancelado y se tramitará su devolución.');
      
      // ============================================================================
// TRANSACCIONES DE BASE DE DATOS (EL PRINCIPIO DE "TODO O NADA")
// ============================================================================

// [1. BEGIN: Abre la caja de arena (Modo Simulador)]
// Le dice a PostgreSQL: "A partir de ahora, todo lo que te pida, guárdalo 
// en una memoria temporal secreta. No cambies la base de datos real todavía".
await cx.query('BEGIN');

try {
  // [2. OPERACIONES CRÍTICAS: El bloque de riesgo]
  // Paso A: Marcamos el carrito entero (Compra) como CONFIRMADO.
  compra = await cambiar(cx, compra, 'CONFIRMADA');
  
  // Paso B: Marcamos cada plato individual (Pedidos) como PENDIENTE de cocinar.
  await cx.query("UPDATE Pedidos SET estado = 'PENDIENTE' WHERE id_compra = $1 AND estado = 'PROGRAMADO'", [compra.id_compra]);
  
  // [3. COMMIT: El botón de "Guardar Oficialmente"]
  // Si el ordenador llega a esta línea, significa que el Paso A y el Paso B 
  // funcionaron sin dar errores. Le decimos a PostgreSQL: "Todo ha ido perfecto, 
  // fusiona los cambios de la memoria temporal en la base de datos real".
  await cx.query('COMMIT');
  
} catch (error) { 
  
  // [4. ROLLBACK: La máquina del tiempo (Ctrl + Z)]
  // Si CUALQUIER línea dentro del 'try' falla (ej: el Paso B da error de sintaxis 
  // o el servidor pierde conexión), JavaScript salta aquí. 
  // El ROLLBACK le grita a PostgreSQL: "¡Cancela todo! Borra la memoria temporal 
  // y deja la base de datos exactamente como estaba antes del BEGIN".
  await cx.query('ROLLBACK'); 
  
  // Vuelve a lanzar el error hacia arriba para que tu servidor sepa que hubo un fallo grave.
  throw error; 
}

// [5. FUERA DE LA TRANSACCIÓN: Las consecuencias]
// Como ya estamos 100% seguros de que la base de datos guardó los cambios con éxito,
// ahora sí es seguro enviar el WhatsApp o Email al restaurante.
await notificarUnaVez(cx, compra);

// Devuelve el objeto del carrito actualizado al Frontend.
return compra;
    }
    
    if (intencion.status === 'canceled') return cancelar(cx, compra, 'La autorización bancaria ha caducado. No se ha cobrado la compra.');
    return compra;
  }

  // ============================================================================
  // FUNCIONES EXPUESTAS AL FRONTEND (Las que se llaman desde GraphQL)
  // ============================================================================
  
  // Confirma internamente que la orden está lista para pasar de "borrador" a "pagada/reservada"
  async function confirmarInterna(cx, compra) {
    if (compra.estado !== 'BORRADOR') return compra;
    let intencion = null;
    if (compra.solicitud.metodo_pago === 'TARJETA') {
      intencion = await recuperarIntencion(compra);
      comprobarIntencion(compra, intencion);
      if (intencion.status === 'canceled') return cancelar(cx, compra, 'La autorización se ha cancelado. No se ha cobrado la compra.');
      if (intencion.status !== 'requires_capture') throw errorCompra('Completa la autorización de tu tarjeta para confirmar el pedido.', 'AUTORIZACION_PENDIENTE');
      
      // ============================================================================
// EXTRACCIÓN SEGURA DE DATOS PROFUNDOS (OPTIONAL CHAINING)
// ============================================================================

// El objetivo de esta línea NO es recolectar todos los datos del camino, 
// sino viajar a través del "árbol" de información de Stripe para agarrar 
// EXCLUSIVAMENTE el último dato de la derecha (capture_before).

// Los símbolos '?.' actúan como "puertas de seguridad" que el ordenador 
// va abriendo de izquierda a derecha:
// 1. Abre latest_charge -> ¿Existe? Sí, sigue el viaje.
// 2. Abre payment_method_details -> ¿Existe? Sí, sigue.
// 3. Abre card -> ¿Existe? (Si pagó con Bizum o ApplePay, aquí no habrá tarjeta).
//
// Si el ordenador se encuentra una puerta que NO existe, el '?.' hace que 
// aborte el viaje de inmediato y guarde 'undefined' (vacío) en la variable, 
// salvando así al servidor de sufrir un error fatal y colapsar.
//
// Si todas las puertas existen, guarda en la variable 'limite' un único 
// dato: un número gigante (Timestamp) que representa la fecha límite del banco.
const limite = intencion.latest_charge?.payment_method_details?.card?.capture_before;
      
      // Calcula la fecha de vencimiento. Si Stripe dio un límite, lo multiplica por 1000 
      // (para pasar de segundos a milisegundos). Si no, le suma 5 días por defecto.
      const vencimiento = new Date(limite ? limite * 1000 : (intencion.created * 1000 || ahora().getTime()) + 5 * 86400_000);
      
      // ============================================================================
// VALIDACIÓN DE TIEMPO: EL MARGEN DE SEGURIDAD DE 30 MINUTOS
// ============================================================================

if (
  // --------------------------------------------------------------------------
  // LADO IZQUIERDO: ¿CUÁNDO SE TIENE QUE ENTREGAR EL PEDIDO?
  // --------------------------------------------------------------------------
  // El operador || (O) actúa como un valor por defecto (fallback).
  // Si el cliente eligió una hora para más tarde, usa 'fecha_programada'.
  // Si el cliente pidió la comida para YA (el campo está vacío), usa 'ahora()'.
  // new Date(...) envuelve esa fecha para poder compararla matemáticamente.
  new Date(compra.solicitud.fecha_programada || ahora()) 
  
  >= // ¿Es MAYOR O IGUAL? (En fechas, "mayor" significa "después en el tiempo")
  
  // --------------------------------------------------------------------------
  // LADO DERECHO: EL LÍMITE DEL BANCO MENOS EL COLCHÓN DE SEGURIDAD
  // --------------------------------------------------------------------------
  // 1. vencimiento.getTime(): Transforma la fecha límite del banco en un número
  //    gigante de milisegundos para poder hacer operaciones matemáticas.
  // 2. 30 * 60_000: Calcula cuántos milisegundos hay en 30 minutos. 
  //    (Nota: El guion bajo en 60_000 es solo un separador visual de JavaScript 
  //    para que los humanos leamos "sesenta mil" más fácilmente).
  // 3. La resta (-): Al límite del banco le quitamos esos 30 minutos.
  // 4. new Date(...): Volvemos a convertir ese número matemático en una Fecha real.
  new Date(vencimiento.getTime() - 30 * 60_000)
) 
// Si entramos aquí, significa que la fecha de entrega ocurre DEMASIADO CERCA 
  // (o incluso después) de que el banco nos quite el dinero. ¡Peligro!













  ///////////////////////////////////////////////////////////














  
{
        await cancelar(cx, compra, 'La fecha elegida supera la autorización de esta tarjeta. Reserva con efectivo o elige una hora más cercana.');
        throw errorCompra('La fecha elegida supera la autorización de esta tarjeta. No se ha cobrado: reserva con efectivo o elige otra hora.', 'AUTORIZACION_CORTA');
      }
      
      // ============================================================================
// CONSULTAS PARAMETRIZADAS Y EL BOMBEO DE DATOS ($1, $2)
// ============================================================================

await cx.query(
  
  // 1. LA PLANTILLA DE TEXTO (Con huecos vacíos)
  // Observa que el programador puso el $2 antes que el $1 en la frase. 
  // No importa el orden en el texto, PostgreSQL buscará el número exacto.
  'UPDATE Compras SET autorizacion_hasta = $2 WHERE id_compra = $1', 
  
  // 2. LA MUNICIÓN (El Array)
  // Como hay un $1 y un $2, el array está obligado a tener dos elementos exactos.
  [
    compra.id_compra,  // Elemento 1 del array -> Vuela y sustituye a todos los $1
    vencimiento        // Elemento 2 del array -> Vuela y sustituye a todos los $2
  ]
  
);
      compra.autorizacion_hasta = vencimiento;
    }
    
    try {
      await cx.query('BEGIN');
      ////////////
      // BUCLE FOR...OF: Recorre cada producto distinto que hay dentro del carrito.
      // En cada vuelta, 'item' representará un plato diferente.
      for (const item of compra.resumen.items) {
        await cx.query(`
  -- 1. EL DESTINO FINAL (El molde de la tabla)
  -- Definimos exactamente las 10 columnas físicas de la base de datos 
  -- que van a recibir los datos. Cada plato ocupará una fila independiente.
  INSERT INTO Pedidos (id_usuario, id_restaurante, id_plato, metodo_pago, direccion_envio, fecha_programada, estado, id_compra, precio_centimos, nombre_producto)
  
  -- 2. LOS DATOS A GUARDAR (La tinta)
  -- El SELECT extrae los parámetros del $1 al $10 y los empareja en orden estricto 
  -- con las 10 columnas de arriba. 
  -- IMPORTANTE: El $11 NO va aquí porque no es un dato de la comida y la tabla no tiene una columna "cantidad".
  SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10 
  
  -- 3. EL CONTROL DEL BUCLE (La máquina clonadora)
  -- La base de datos lee esto antes de guardar nada. generate_series va al array, 
  -- agarra el $11 (ej. un 4) y le ordena al SELECT que se repita 4 veces. 
  -- El comando ::int es obligatorio para forzar que el dato sea un número matemático.
  FROM generate_series(1, $11::int)
  
`, [
  // 4. EL ARRAY DE VARIABLES (La munición de Node.js)
  // El número de la etiqueta $N no depende de las columnas de la tabla, 
  // depende EXCLUSIVAMENTE del número de asiento que el dato ocupa en esta lista.
  compra.id_usuario,                 // Asiento 1  -> Viaja a la base de datos como $1
  compra.id_restaurante,             // Asiento 2  -> Viaja a la base de datos como $2
  item.id_plato,                     // Asiento 3  -> Viaja a la base de datos como $3
  compra.solicitud.metodo_pago,      // Asiento 4  -> Viaja a la base de datos como $4
  compra.solicitud.direccion_envio,  // Asiento 5  -> Viaja a la base de datos como $5
  compra.solicitud.fecha_programada, // Asiento 6  -> Viaja a la base de datos como $6
  estadoPedido,                      // Asiento 7  -> Viaja a la base de datos como $7
  compra.id_compra,                  // Asiento 8  -> Viaja a la base de datos como $8
  item.precio_centimos,              // Asiento 9  -> Viaja a la base de datos como $9
  item.nombre,                       // Asiento 10 -> Viaja a la base de datos como $10
  
  item.cantidad                      // Asiento 11 -> Viaja a la base de datos como $11 
                                     // (Y solo se usa en el FROM para controlar cuántas copias hacer)
]);
      }
      
      // DOBLE TERNARIO: Calcula el estado de la compra con dos preguntas en cadena.
      // 1. ¿Es para una hora futura? -> 'RESERVADA'
      // 2. Si no, ¿está pagado con tarjeta? -> 'AUTORIZADA'
      // 3. Si no es futura y no es tarjeta (es inmediato en efectivo) -> 'CONFIRMADA'
      compra = await cambiar(cx, compra, compra.solicitud.fecha_programada ? 'RESERVADA' : intencion ? 'AUTORIZADA' : 'CONFIRMADA');
      // Fidelidad: Añade puntos al usuario por confirmar la compra.
      await cx.query('UPDATE Usuarios SET puntos_acumulados = puntos_acumulados + 10 WHERE id_usuario = $1', [compra.id_usuario]);
      await cx.query('COMMIT');
    } catch (error) {
      await cx.query('ROLLBACK');
      await cancelar(cx, await leer(cx, compra.id_compra), error.message);
      throw error;
    }
    ///////
    // Si el cliente pagó con tarjeta y la retención se ha cobrado correctamente ('succeeded'), 
      // actualiza el estado a CONFIRMADA, y luego actualiza todos los pedidos individuales.
      if (compra.estado === 'AUTORIZADA') compra = await capturar(cx, compra, intencion);
      await notificarUnaVez(cx, compra);
      return compra;
    }
  
    // ============================================================================
    // CREACIÓN DEL CARRITO (Borrador) Y PREPARACIÓN DEL PAGO
    // ============================================================================
    // Guarda el carrito como BORRADOR y genera el intento de pago (Payment Intent) en Stripe.
    async function preparar(input, contexto) {
      const usuario = exigirUsuario(contexto);
      const solicitud = normalizarSolicitud(input);
      
      // FUNCIÓN DE ORDEN SUPERIOR (Callback): Le pasamos a 'conBloqueo' la clave 
      // y la función (async cx => {...}) que debe ejecutar una vez consiga el candado.
      return conBloqueo(solicitud.clave, async cx => {
        let compra = await leer(cx, solicitud.clave);
        
        // CONDICIONAL DE EXISTENCIA: 'if (compra)' se evalúa como Verdadero si la BD encontró el carrito.
        // Si no lo encontró, vale 'null' (Falso) y saltará al bloque de abajo.
        if (compra) {
          if (String(compra.id_usuario) !== usuario) throw errorCompra('Esta compra no pertenece a tu cuenta.', 'FORBIDDEN');
          
          // COMPROBACIÓN ESTRICTA (!==): Compara si el carrito que guardamos en la base de datos 
          // antes, sigue siendo exactamente igual al que el usuario nos está mandando ahora.
          if (JSON.stringify(compra.solicitud) !== JSON.stringify(solicitud)) {
            if (JSON.stringify(normalizarSolicitud(compra.solicitud)) !== JSON.stringify(solicitud)) throw errorCompra('Usa un nuevo identificador para un carrito diferente.');
          }
          if (compra.estado !== 'BORRADOR') return resultado(cx, compra);
        }
        
        if (!compra) {
          await cx.query('BEGIN');
          try {
            const resumen = await cotizar(cx, solicitud);
            
            // INSERCIÓN Y EXTRACCIÓN INMEDIATA:
            // Inserta los datos en la tabla, el 'RETURNING *' devuelve la fila recién creada, 
            // y el '.rows[0]' la extrae para guardarla en la variable 'compra' y seguir trabajando con ella.
            compra = (await cx.query('INSERT INTO Compras (id_compra, id_usuario, id_restaurante, solicitud, resumen, total_centimos) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6) RETURNING *', [solicitud.clave, usuario, solicitud.id_restaurante, JSON.stringify(solicitud), JSON.stringify(resumen), resumen.total_centimos])).rows[0];
            await cx.query('COMMIT');
          } catch (error) { 
            // ROLLBACK DE SEGURIDAD: Si algo falló (ej: error calculando precios), 
            // deshace los cambios a medias en la BD y escupe (throw) el error.
            await cx.query('ROLLBACK'); throw error; 
          }
        }
        
        let intencion = null;
        if (solicitud.metodo_pago === 'TARJETA') {
          if (compra.payment_intent_id) intencion = await recuperarIntencion(compra);
          else {
            const cliente = (await cx.query('SELECT stripe_customer_id FROM Usuarios WHERE id_usuario = $1', [usuario])).rows[0]?.stripe_customer_id;
            if (!cliente || !/^pm_[a-zA-Z0-9]+$/.test(solicitud.id_tarjeta || '')) throw errorCompra('Selecciona una tarjeta guardada.');
            
            const tarjeta = await stripe.paymentMethods.retrieve(solicitud.id_tarjeta);
            if (tarjeta.type !== 'card' || idStripe(tarjeta.customer) !== cliente) throw errorCompra('La tarjeta no pertenece a tu cuenta.', 'FORBIDDEN');
            
            // Crea la intención de pago indicándole a Stripe que retenga el dinero (capture_method: 'manual') pero no lo cobre aún.
            intencion = await stripe.paymentIntents.create({
              amount: compra.total_centimos, currency: 'eur', customer: cliente,
              payment_method: solicitud.id_tarjeta, payment_method_types: ['card'], capture_method: 'manual',
              metadata: { id_compra: compra.id_compra, id_usuario: usuario },
            }, { idempotencyKey: 'nexbite-compra-' + compra.id_compra });
            
            compra = (await cx.query('UPDATE Compras SET payment_intent_id = $2 WHERE id_compra = $1 RETURNING *', [compra.id_compra, intencion.id])).rows[0];
          }
        }
        return resultado(cx, compra, intencion);
      });
    }
  
    async function confirmar(clave, contexto) {
      const usuario = exigirUsuario(contexto);
      return conBloqueo(clave, async cx => {
        let compra = await leer(cx, clave);
        if (!compra || String(compra.id_usuario) !== usuario) throw errorCompra('Esta compra no pertenece a tu cuenta.', 'FORBIDDEN');
        compra = await confirmarInterna(cx, compra);
        if (compra.estado === 'AUTORIZADA') compra = await capturar(cx, compra, await recuperarIntencion(compra));
        return resultado(cx, compra);
      });
    }
  
    async function consultar(clave, contexto) {
      const usuario = exigirUsuario(contexto);
      return conBloqueo(clave, async cx => {
        let compra = await leer(cx, clave);
        if (!compra || String(compra.id_usuario) !== usuario) throw errorCompra('Esta compra no pertenece a tu cuenta.', 'FORBIDDEN');
        compra = await conciliar(cx, compra);
        
        // CORTOCIRCUITO LÓGICO (&&): Si está en borrador AND tiene un ID de Stripe, 
        // ejecuta la función recuperar. Si falla la primera, se detiene y devuelve 'null'.
        return resultado(cx, compra, compra.estado === 'BORRADOR' && compra.payment_intent_id ? await recuperarIntencion(compra) : null);
      });
    }
  
    // ============================================================================
    // WORKER BACKGROUND (Procesamiento y Mantenimiento en Segundo Plano)
    // ============================================================================
    // Revisa el estado de la compra vs el estado en Stripe por si se perdió la conexión a la red.
    // También evalúa si las compras "Programadas/Reservadas" ya deben ser activadas.
    async function conciliar(cx, compra) {
      // ARRAY AL VUELO: Crea una lista [A, B] y verifica si incluye el estado actual.
      if (['CANCELANDO', 'REEMBOLSO_PENDIENTE'].includes(compra.estado)) return finalizarCancelacion(cx, compra);
      
      if (compra.estado === 'BORRADOR') {
        const intencion = compra.payment_intent_id && await recuperarIntencion(compra);
        if (intencion?.status === 'requires_capture') return confirmarInterna(cx, compra);
        if (intencion?.status === 'canceled' || ahora().getTime() - new Date(compra.creada).getTime() > 30 * 60_000) return cancelar(cx, compra, 'La compra no se confirmó a tiempo. No se ha cobrado.');
        return compra;
      }
      
      if (compra.estado === 'AUTORIZADA') return capturar(cx, compra, await recuperarIntencion(compra));
      if (compra.estado !== 'RESERVADA') return compra;
      
      const momento = ahora();
      if (compra.autorizacion_hasta && momento >= new Date(new Date(compra.autorizacion_hasta).getTime() - 5 * 60_000)) return cancelar(cx, compra, 'La autorización ha caducado antes de poder preparar el pedido. No se ha cobrado.');
      
      const fecha = new Date(compra.solicitud.fecha_programada);
      if (momento < fecha) return compra;
      
      // Si han pasado 30 minutos desde la hora pactada de la reserva y el local sigue inactivo, cancela para no perjudicar al usuario.
      if (momento > new Date(fecha.getTime() + 30 * 60_000)) return cancelar(cx, compra, 'El pedido no estuvo disponible a tiempo. La reserva se ha cancelado sin cobrar.');
      
      await cx.query('BEGIN');
      try {
        const resumen = await cotizar(cx, compra.solicitud, 'activar');
        // EVALUACIÓN ESTRICTA (!==): Convierte a JSON el menú antiguo y el nuevo y verifica si el restaurante alteró los platos o precios.
        if (JSON.stringify(resumen.composicion_menu) !== JSON.stringify(compra.resumen.composicion_menu)) throw errorCompra('Los productos incluidos en el menú han cambiado.');
        
        if (compra.solicitud.metodo_pago === 'EFECTIVO') {
          compra = await cambiar(cx, compra, 'CONFIRMADA');
          // PARAMETRIZACIÓN DE SEGURIDAD: Aunque sea 1 solo valor (compra.id_compra), 
          // la librería exige ponerlo dentro de un Array [] para limpiar el dato y meterlo en el $1.
          await cx.query("UPDATE Pedidos SET estado = 'PENDIENTE' WHERE id_compra = $1 AND estado = 'PROGRAMADO'", [compra.id_compra]);
        } else compra = await cambiar(cx, compra, 'AUTORIZADA');
        
        await cx.query('COMMIT');
      } catch (error) {
        await cx.query('ROLLBACK');
        if (error.extensions?.code === 'NO_DISPONIBLE') return compra;
        return cancelar(cx, compra, 'La reserva ya no se puede servir: ' + error.message);
      }
      if (compra.estado === 'AUTORIZADA') compra = await capturar(cx, compra, await recuperarIntencion(compra));
      await notificarUnaVez(cx, compra);
      return compra;
    }
////////
  // ============================================================================
  // GESTIÓN DE ESTADOS DEL RESTAURANTE (Pedidos individuales)
  // ============================================================================
  // ============================================================================
  // GESTIÓN DE ESTADOS DEL RESTAURANTE (Pedidos individuales)
  // ============================================================================
  
  async function validarCambioPedido(idPedido, estado, conexion = pool) {
    const permitidos = ['PENDIENTE', 'EN COCINA', 'PREPARANDO', 'EN CAMINO', 'ENVIADO', 'ENTREGADO', 'CANCELADO', 'RECHAZADO'];
    if (!permitidos.includes(estado)) throw errorCompra('El estado del pedido no es válido.');
    
    const pedido = (await conexion.query('SELECT p.*, c.estado AS estado_compra FROM Pedidos p LEFT JOIN Compras c ON p.id_compra = c.id_compra WHERE p.id_pedido = $1', [idPedido])).rows[0];
    if (!pedido) throw errorCompra('El pedido no existe.');
    if (['ENTREGADO', 'CANCELADO', 'RECHAZADO'].includes(pedido.estado)) throw errorCompra('Este pedido ya ha finalizado.');
    if (!['CANCELADO', 'RECHAZADO'].includes(estado) && (pedido.fecha_programada && new Date(pedido.fecha_programada) > ahora() || pedido.estado === 'PROGRAMADO' || pedido.id_compra && pedido.estado_compra !== 'CONFIRMADA')) throw errorCompra('El pedido aún está reservado o pendiente de confirmar el pago.');
    
    // MÁQUINA DE ESTADOS: Diccionario que asigna un valor numérico a cada estado.
    // Esto impide matemáticamente que el restaurante mueva un pedido hacia atrás.
    // Si intenta pasar de ENTREGADO (3) a PREPARANDO (1), la condición (1 < 3) se cumple y bloquea la acción.
    const etapas = { PENDIENTE: 0, PREPARANDO: 1, 'EN COCINA': 1, ENVIADO: 2, 'EN CAMINO': 2, ENTREGADO: 3 };
    if (etapas[estado] < etapas[pedido.estado]) throw errorCompra('Un pedido no puede volver a un estado anterior.');
    
    return pedido;
  }

  async function cancelarPedido(idPedido, contexto, motivo = 'Cancelado por el cliente') {
    const usuario = exigirUsuario(contexto);
    let pedido = (await pool.query('SELECT * FROM Pedidos WHERE id_pedido = $1', [idPedido])).rows[0];
    if (!pedido) throw errorCompra('El pedido no existe.');
    
    if (contexto.usuario.rol === 'VENDEDOR') await exigirLocalPropio(pool, contexto, idPedido, 'pedido');
    else if (String(pedido.id_usuario) !== usuario) throw errorCompra('Este pedido no pertenece a tu cuenta.', 'FORBIDDEN');
    
    if (pedido.id_compra) {
      return conBloqueo(pedido.id_compra, async cx => {
        const pedidos = (await cx.query('SELECT * FROM Pedidos WHERE id_compra = $1', [pedido.id_compra])).rows;
        
        // CONDICIONAL INVERSO (.some y !.includes): 
        // Si ALGÚN plato del carrito NO ESTÁ en estado inicial (ej: la cocina ya lo marcó como "Preparando"), 
        // bloquea la cancelación porque ya se están gastando ingredientes.
        if (pedidos.some(p => !['PENDIENTE', 'PROGRAMADO', 'CANCELADO', 'RECHAZADO'].includes(p.estado))) throw errorCompra('La preparación ya ha empezado. Contacta con el local para resolver la incidencia.');
        
        // DOBLE AWAIT: Primero espera a leer los datos frescos del carrito, y luego espera a que termine la cancelación.
        const compra = await cancelar(cx, await leer(cx, pedido.id_compra), motivo);
        pedido = (await cx.query('SELECT * FROM Pedidos WHERE id_pedido = $1', [idPedido])).rows[0];
        
        // SPREAD OPERATOR (...pedido): Devuelve todos los datos del pedido y le inyecta 
        // el nuevo estado_pago y el mensaje amigable de Stripe generado por la función resultado().
        return { ...pedido, estado_pago: compra.estado, mensaje_pago: (await resultado(cx, compra)).mensaje };
      });
    }
    
    if (!['PENDIENTE', 'PROGRAMADO', 'CANCELADO', 'RECHAZADO'].includes(pedido.estado)) throw errorCompra('La preparación ya ha empezado. Contacta con el local para resolver la incidencia.');
    pedido = (await pool.query("UPDATE Pedidos SET estado = 'CANCELADO' WHERE id_pedido = $1 AND estado IN ('PENDIENTE','PROGRAMADO','CANCELADO','RECHAZADO') RETURNING *", [idPedido])).rows[0];
    if (!pedido) throw errorCompra('El local ya ha empezado a preparar el pedido.');
    return { ...pedido, mensaje_pago: pedido.metodo_pago === 'TARJETA' ? 'Pedido antiguo cancelado. Consulta con el local para verificar la devolución de su pago.' : 'Pedido cancelado. No hay ningún cobro con tarjeta.' };
  }

  // ============================================================================
  // WORKER BACKGROUND (Procesos en Segundo Plano y Cron Jobs)
  // ============================================================================
  async function procesarPendientes() {
    
    // Consulta SQL que busca compras atascadas (ej: pendientes de reembolso o confirmación).
    // [ahora()] inyecta la hora actual segura en la variable $1 de la base de datos.
    const pendientes = (await pool.query(`
      SELECT id_compra FROM Compras
      WHERE estado IN ('BORRADOR','AUTORIZADA','CANCELANDO','REEMBOLSO_PENDIENTE')
        OR estado = 'RESERVADA' AND ((solicitud->>'fecha_programada')::timestamptz <= $1 OR autorizacion_hasta <= $1::timestamptz + INTERVAL '5 minutes')
      ORDER BY CASE WHEN estado = 'BORRADOR' THEN 1 ELSE 0 END, actualizada LIMIT 100
    `, [ahora()])).rows;
    
    // BUCLE DE MANTENIMIENTO: Recorre los pedidos atascados y fuerza su conciliación.
    for (const { id_compra } of pendientes) {
      try { await conBloqueo(id_compra, async cx => {
        await cx.query('UPDATE Compras SET actualizada = NOW() WHERE id_compra = $1', [id_compra]);
        return conciliar(cx, await leer(cx, id_compra));
      }); }
      catch (error) { 
        // Si no pudo conciliar porque otro proceso ya lo estaba bloqueando, lo ignora.
        // Si fue un error grave de conexión, lo registra en consola sin detener el resto del bucle.
        if (error.extensions?.code !== 'COMPRA_EN_PROCESO') console.error('Compra pendiente de revisar:', id_compra, error.code || error.extensions?.code || 'CONEXION'); 
      }
    }
    
    // COMPATIBILIDAD HACIA ATRÁS (Legacy Support)
    // Busca pedidos "antiguos" que no usan el nuevo sistema de "Carritos" (Compras).
    const antiguos = (await pool.query(`
      SELECT pe.* FROM Pedidos pe JOIN Restaurantes r ON r.id_restaurante = pe.id_restaurante JOIN Platos p ON p.id_plato = pe.id_plato
      WHERE pe.id_compra IS NULL AND pe.estado = 'PROGRAMADO' AND NULLIF(pe.fecha_programada::text, '')::timestamptz <= $1::timestamptz
        AND (r.aceptando_pedidos IS DISTINCT FROM FALSE OR NULLIF(r.tiempo_reactivacion::text, '')::timestamptz <= $1::timestamptz)
        AND (p.disponible IS DISTINCT FROM FALSE OR NULLIF(p.tiempo_disponible::text, '')::timestamptz <= $1::timestamptz)
        AND NOT EXISTS (SELECT 1 FROM Menu_Platos mp JOIN Platos incluido ON incluido.id_plato = mp.id_plato_incluido WHERE mp.id_menu = pe.id_plato AND incluido.disponible = FALSE AND (incluido.tiempo_disponible IS NULL OR NULLIF(incluido.tiempo_disponible::text, '')::timestamptz > $1::timestamptz))
      ORDER BY pe.id_pedido LIMIT 100
    `, [ahora()])).rows;
    
    // Transforma los pedidos antiguos forzándolos a pasar por la tubería moderna de pagos y validaciones.
    for (const pedido of antiguos) {
      try {
        await conBloqueo('antiguo-' + pedido.id_pedido, async cx => {
          await cx.query('BEGIN');
          try {
            await cotizar(cx, normalizarSolicitud({ clave: 'antiguo-pedido-' + pedido.id_pedido, id_restaurante: pedido.id_restaurante, items: [{ id_plato: pedido.id_plato, cantidad: 1 }], metodo_pago: 'EFECTIVO', tipo_entrega: pedido.direccion_envio?.toUpperCase().startsWith('RECOGIDA') ? 'RECOGIDA' : 'DOMICILIO' }), 'activar-antiguo');
            await cx.query("UPDATE Pedidos SET estado = 'PENDIENTE' WHERE id_pedido = $1 AND estado = 'PROGRAMADO' AND NULLIF(fecha_programada::text, '')::timestamptz <= $2::timestamptz", [pedido.id_pedido, ahora()]);
            await cx.query('COMMIT');
          } catch (error) { await cx.query('ROLLBACK'); throw error; }
        });
      } catch (error) { if (error.extensions?.code !== 'NO_DISPONIBLE') console.error('Reserva antigua pendiente:', pedido.id_pedido, error.extensions?.code || 'VALIDACION'); }
    }
  }

  // Wrapper que bloquea el pedido específico (o todo el carrito asociado a él)
  // y le pasa el cable seguro de conexión (cx) a la acción.
  const conPedidoBloqueado = async (idPedido, accion) => {
    const pedido = (await pool.query('SELECT id_compra FROM Pedidos WHERE id_pedido = $1', [idPedido])).rows[0];
    return conBloqueo(pedido?.id_compra || 'pedido-' + idPedido, cx => accion(cx));
  };

  // Envoltorio genérico (Guardaespaldas). Atrapa cualquier error de servidor y lo
  // transforma en un error limpio de GraphQL para que el Frontend no colapse.
  async function ejecutarOperacion(etapa, clave, accion) {
    try {
      return await accion();
    } catch (error) {
      if (error instanceof GraphQLError) throw error;
      registrarErrorCompra('servidor', etapa, clave, error);
      throw new GraphQLError('El servidor no ha podido completar esta operación de compra. Comprueba el estado del mismo pedido antes de volver a pagar.', {
        extensions: { code: 'COMPRA_SERVIDOR_NO_DISPONIBLE', codigo_incidente: detalleErrorCompra(error).codigo },
      });
    }
  }

  // ============================================================================
  // MAPEO A GRAPHQL (API Pública)
  // ============================================================================
  // Devuelve el objeto que finalmente exportará las funciones.
  return {
    preparar, confirmar, consultar, cancelarPedido, validarCambioPedido, procesarPendientes, conPedidoBloqueado,
    
    // DEFINICIÓN GRAPHQL:
    // Query: Funciones de Lectura (GET). Ej: consultar datos de compra.
    Query: { 
      consultarCompra: (_, { id_compra }, ctx) => ejecutarOperacion('consultar', id_compra, () => consultar(id_compra, ctx)) 
    },
    // Mutation: Funciones de Escritura/Modificación (POST/PUT). Ej: Pagar o Confirmar.
    Mutation: {
      prepararCompra: (_, { input }, ctx) => ejecutarOperacion('preparar', input?.clave, () => preparar(input, ctx)),
      confirmarCompra: (_, { id_compra }, ctx) => ejecutarOperacion('confirmar', id_compra, () => confirmar(id_compra, ctx)),
    },
  };
}