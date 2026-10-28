// ============================================================================
// Definición del Esquema GraphQL (El contrato entre el Frontend y el Backend).
// Fuera de la cadena usamos //; dentro del esquema GraphQL usamos #.
// ============================================================================
export const typeDefs = `#graphql
  
  # ============================================================================
  # DEFINICIÓN DE TIPOS DE SALIDA (Lo que el servidor devuelve al cliente)
  # ============================================================================
  # 'String' = Texto, 'Float' = Decimal, 'Int' = Entero, 'ID' = Identificador único.
  # '!' impide null; en una entrada también exige enviar el dato. No rechaza por sí solo un texto vacío.
  type DireccionUbicacion { direccion: String!, lat: Float!, lng: Float! }
  type Tag { id_tag: ID!, nombre: String!, categoria: String! }
  type UsuarioAuth { id_usuario: ID!, nombre: String!, email: String!, rol: String!, puntos_acumulados: Int!, token: String! }
  type FranjaRecogida { dia: Int!, inicio: String!, fin: String! }
  
  # ============================================================================
  # DEFINICIÓN DE TIPOS DE ENTRADA (Lo que el cliente debe enviar al servidor)
  # ============================================================================
  # 'input' agrupa datos de entrada; se puede usar en argumentos de Query y de Mutation.
  input FranjaRecogidaInput { dia: Int!, inicio: String!, fin: String! }
  
  type Restaurante { 
    id_restaurante: ID!
    nombre: String!
    tipo: String!
    latitud: Float
    longitud: Float
    imagen_url: String 
    aceptando_pedidos: Boolean 
    horarios_recogida: [FranjaRecogida!]
    tiempo_reactivacion: String 
    radio_cobertura_km: Float
    telefono: String
    direccion: String
    calificacion: Float # <--- NUEVO CAMPO AÑADIDO
  }

  type RestauranteConDistancia { 
    id_restaurante: ID!
    nombre: String!
    tipo: String!
    latitud: Float
    longitud: Float
    distancia_km: Float
    imagen_url: String 
    radio_cobertura_km: Float
    telefono: String
    direccion: String
    calificacion: Float # <--- NUEVO CAMPO AÑADIDO
  }

  type Plato { 
    id_plato: ID!
    id_restaurante: ID! 
    nombre: String!
    descripcion: String!
    precio: Float!
    categoria: [String]
    imagen_url: String
    disponible: Boolean
    tiempo_disponible: String 
    items_menu: [Plato]
    nombre_restaurante: String
  }

  type PlatoRecomendado { id_plato: ID!, nombre: String!, descripcion: String!, precio: Float!, restaurante: String!, coincidencias: Int! }
  
  type Pedido { 
    id_pedido: ID!
    id_restaurante: ID!
    id_plato: ID
    nombre_plato: String
    precio_plato: Float
    estado: String!
    metodo_pago: String
    direccion_envio: String
    fecha_programada: String 
    nombre_restaurante: String
    imagen_restaurante: String
    plato_disponible: Boolean
    restaurante_abierto: Boolean
    fecha_pedido: String
    descripcion_plato: String
    imagen_plato: String
    id_compra: ID
    estado_pago: String
    mensaje_pago: String
  }

  type Usuario {
    id_usuario: ID!
    nombre: String!
    email: String!
    rol: String!
    telefono: String
    direccion: String
  }

  type TarjetaGuardada {
    id: ID!
    brand: String!
    last4: String!
    name: String
  }

  type Resena {
    id_resena: ID!
    nombre_usuario: String
    puntuacion: Int!
    comentario: String!
    fecha: String!
  }

  input ItemCompraInput { id_plato: ID!, cantidad: Int! }
  input CompraInput {
    clave: ID!
    id_restaurante: ID!
    items: [ItemCompraInput!]!
    metodo_pago: String!
    id_tarjeta: ID
    tipo_entrega: String!
    direccion_envio: String
    latitud_cliente: Float
    longitud_cliente: Float
    fecha_programada: String
  }
  type ItemCompra { id_plato: ID!, nombre: String!, cantidad: Int!, precio: Float! }
  type Compra {
    id_compra: ID!
    estado: String!
    subtotal: Float!
    envio: Float!
    total: Float!
    client_secret: String
    fecha_programada: String
    autorizacion_hasta: String
    mensaje: String!
    items: [ItemCompra!]!
    pedidos: [Pedido!]!
  }

  # ============================================================================
  # QUERIES: OPERACIONES PARA CONSULTAR DATOS
  # ============================================================================
  # Por diseño consultan datos. Query no es un método HTTP ni garantiza ausencia de efectos secundarios.
  type Query {
    # Exige un 'id_compra' obligatorio (!). Devuelve un objeto 'Compra' obligatorio (!).
    consultarCompra(id_compra: ID!): Compra!
    obtenerMisTarjetas(id_usuario: ID!): [TarjetaGuardada!]!
    buscarDirecciones(termino: String!): [DireccionUbicacion!]!
    
    # Devuelve 'DireccionUbicacion' SIN '!' final. Significa que si las coordenadas caen
    # en medio del océano y no hay calle, es válido que la función devuelva 'null'.
    obtenerDireccionUbicacion(latitud: Float!, longitud: Float!): DireccionUbicacion
    obtenerTags: [Tag]
    obtenerRecomendaciones(id_usuario: ID!, limit: Int, offset: Int): [PlatoRecomendado]
    chatearConBot(mensaje: String!): String
    
    obtenerFavoritos(id_usuario: ID!, latitud: Float, longitud: Float, solo_con_entrega: Boolean, radio_km: Float): [Restaurante]
    obtenerPlatosFavoritos(id_usuario: ID!, latitud: Float, longitud: Float, solo_con_entrega: Boolean, radio_km: Float): [Plato] 

    obtenerRestaurantesCercanos(latitud: Float!, longitud: Float!, radio_km: Float, solo_con_entrega: Boolean): [RestauranteConDistancia]
    
    buscarRestaurantes(termino: String!, latitud: Float, longitud: Float, solo_con_entrega: Boolean, radio_km: Float): [Restaurante]
    buscarPlatos(termino: String!, latitud: Float, longitud: Float, solo_con_entrega: Boolean, radio_km: Float): [Plato] 
    
    obtenerMisRestaurantes: [Restaurante]
    obtenerMiRestaurante: Restaurante
    obtenerPedidosVendedor(id_restaurante: ID!): [Pedido]
    
    obtenerPedidosCliente(id_usuario: ID!): [Pedido]
    obtenerUltimosPedidos(id_usuario: ID!, latitud: Float, longitud: Float, solo_con_entrega: Boolean, radio_km: Float): [Pedido]

    obtenerRestaurantePorId(id_restaurante: ID!): Restaurante 
    obtenerMejoresRestaurantes(latitud: Float, longitud: Float, solo_con_entrega: Boolean, radio_km: Float): [Restaurante]
    obtenerMenuRestaurante(id_restaurante: ID!): [Plato]
    obtenerMasVendidos(id_restaurante: ID!): [Plato]
    obtenerPlatosPorCategoria(categoria: String!): [Plato]
    obtenerRestaurantesSimilares(id_restaurante: ID!): [Restaurante]
    obtenerPerfilUsuario(id_usuario: ID!): Usuario
    obtenerPlatosDestacados(latitud: Float, longitud: Float, solo_con_entrega: Boolean, radio_km: Float): [Plato]
    
    obtenerResenasRestaurante(id_restaurante: ID!): [Resena]
  }

  # ============================================================================
  # MUTATIONS: OPERACIONES QUE SOLICITAN CAMBIOS
  # ============================================================================
  # Funciones que alteran la base de datos (crear, actualizar, borrar, pagar).
  type Mutation {
    # Recibe CompraInput y devuelve Compra: el registro del proceso de compra, no el estado React del carrito.
    prepararCompra(input: CompraInput!): Compra!
    confirmarCompra(id_compra: ID!): Compra!
    registrarUsuario(nombre: String!, email: String!, password: String!, rol: String): UsuarioAuth
    guardarPreferencias(id_usuario: ID!, tags: [ID!]!): String
    
    # DIRECTIVA DE OBSOLESCENCIA (@deprecated):
    # Marca la operación antigua: los clientes deben usar prepararCompra para el flujo actual.
    # La directiva comunica la obsolescencia; no implementa por sí sola el comportamiento del resolver.
    crearPedido(
      id_usuario: ID!, 
      id_restaurante: ID!, 
      id_plato: ID!, 
      metodo_pago: String!, 
      direccion_envio: String!, 
      fecha_programada: String,
      latitud_cliente: Float,
      longitud_cliente: Float
    ): Pedido @deprecated(reason: "Utiliza prepararCompra y confirmarCompra para guardar el pedido completo.")
    
    solicitarAviso(id_usuario: ID!, tipo: String!, id_referencia: ID!): String

    # ============================================================================
# EL CONTRATO DE GRAPHQL (SCHEMA DEFINITION)
# Esto NO es el código que guarda datos (Resolver). Es "el menú" o
# "el portero de discoteca": filtra, valida los tipos de datos y bloquea
# peticiones mal formadas ANTES de que lleguen a tocar tu base de datos.
# ============================================================================

registrarNegocio(
  
  # 1. CAMPOS OBLIGATORIOS (El modificador '!')
  # El cierre de exclamación '!' significa "Non-Nullable" (No admite null; un texto vacío requiere validación adicional).
  # Si la app móvil intenta registrar un negocio sin enviar el 'nombre' o el 'tipo',
  # GraphQL aborta la petición automáticamente en la puerta de entrada.
  nombre: String!, 
  tipo: String!, 
  
  # 2. CAMPOS OPCIONALES Y DECIMALES (Tipos Escalares)
  # 'Float' indica un número con decimales (vital para coordenadas GPS).
  # Como NO tienen el símbolo '!', son opcionales. El portero de GraphQL
  # dejará pasar la petición aunque estos campos vengan vacíos.
  latitud: Float, 
  longitud: Float, 
  radio_cobertura_km: Float,
  
  # 'String' son cadenas de texto tradicionales (también opcionales aquí).
  imagen_url: String,
  telefono: String,
  direccion: String,
  
  # 3. ESTRUCTURAS COMPLEJAS (Listas y Tipos Input)
  # Los corchetes '[]' indican que se espera recibir una LISTA (Array).
  # 'FranjaRecogidaInput' es una regla estructurada que tú mismo creaste.
  # Le dice a GraphQL: "Aquí no quiero un simple texto, quiero que me manden
  # varios objetos completos que contengan los días y las horas por separado".
  horarios_recogida: [FranjaRecogidaInput!]

# 4. LA PROMESA DE DEVOLUCIÓN (El Molde / Return Type)
# Los dos puntos ':' definen el "Return Type".
# Promete que, al terminar, no devolverá un simple mensaje de "OK", sino
# un objeto que encaja exactamente en el molde llamado 'Restaurante'.
# Esto da a la app móvil el superpoder de elegir qué piezas de ese molde
# quiere recibir (ej. pedir solo el 'id_restaurante' para no gastar datos de internet).
): Restaurante
    
    actualizarNegocio(
      id_restaurante: ID!,
      nombre: String!,
      tipo: String!,
      latitud: Float!,
      longitud: Float!,
      imagen_url: String!,
      radio_cobertura_km: Float!,
      telefono: String!,
      direccion: String,
      horarios_recogida: [FranjaRecogidaInput!]
    ): Restaurante

    crearPlato(
        id_restaurante: ID!, 
        nombre: String!, 
        descripcion: String!, 
        precio: Float!, 
        categoria: [String]!, 
        imagen_url: String,
        platos_existentes: [ID!]
    ): Plato

    actualizarPlato(
        id_plato: ID!,
        id_restaurante: ID!,
        nombre: String!,
        descripcion: String!,
        precio: Float!,
        categoria: [String]!,
        imagen_url: String,
        platos_existentes: [ID!]
    ): Plato

    # ============================================================================
# CONTRATO GRAPHQL: EL INTERRUPTOR DE FAVORITOS (TOGGLE)
# ============================================================================

alternarFavorito(
  
  # 1. EL TIPO ESPECIAL (ID) Y EL PORTERO (!)
  # 'id_restaurante' es el dato que el móvil tiene que enviar.
  # 'ID' es un tipo de dato exclusivo de GraphQL. Aunque en tu base de datos
  # sea un número (ej. 5) o un texto largo, GraphQL lo trata como un "código
  # de barras único". Le dice al programador del móvil: "No intentes sumar
  # ni hacer matemáticas con esto, es solo una etiqueta de identificación".
  # El '!' hace que sea obligatorio. Si el móvil no envía a qué restaurante
  # darle like, la petición se rechaza en la puerta.
  id_restaurante: ID!

# 2. LA RESPUESTA LIGERA (: String)
# En la función anterior devolvíamos un objeto gigante (: Restaurante).
# Aquí devolvemos un simple 'String' (una cadena de texto).
# ¿Por qué? Porque el usuario ya está viendo el restaurante en la pantalla
# de su móvil. No necesita que le vuelvas a enviar la foto o las coordenadas.
# Solo necesita que el servidor le devuelva un mensaje de texto como:
# "Añadido a favoritos" o "Eliminado de favoritos" para confirmar la acción.
): String
    alternarFavoritoPlato(id_plato: ID!): String

    iniciarSesion(email: String!, password: String!): UsuarioAuth
    iniciarSesionGoogle(token_google: String!, rol: String): UsuarioAuth
    
    solicitarRecuperacionPassword(identificador: String!): String
    restablecerPassword(token: String!, nueva_password: String!): String
    
    cambiarEstadoRestaurante(id_restaurante: ID!, aceptando: Boolean!, tiempo: String): Restaurante 
    marcarPlatoAgotado(id_plato: ID!, disponible: Boolean!, tiempo: String): Plato
    
    actualizarEstadoPedido(
      id_pedido: ID!, 
      nuevo_estado: String!,
      motivo_rechazo: String,
      mensaje_personalizado: String
    ): Pedido
    
    eliminarRestaurante(id_restaurante: ID!): String
    eliminarPlato(id_plato: ID!): String
    eliminarPedido(id_pedido: ID!): String
    
    crearConfiguracionTarjeta: String!
    eliminarTarjetaGuardada(id_tarjeta: ID!): Boolean!
    crearIntencionPago(monto: Float!, id_tarjeta: ID!, clave_pago: ID!): String! @deprecated(reason: "El importe se calcula en prepararCompra.")
    actualizarPerfilUsuario(id_usuario: ID!, telefono: String, direccion: String): Usuario

    crearResena(id_restaurante: ID!, id_usuario: ID!, puntuacion: Int!, comentario: String!): Resena
  }

  type Subscription { nuevoPedido(id_restaurante: ID!): Pedido }
`;
