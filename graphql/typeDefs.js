export const typeDefs = `#graphql
  type DireccionUbicacion { direccion: String!, lat: Float!, lng: Float! }
  type Tag { id_tag: ID!, nombre: String!, categoria: String! }
  type UsuarioAuth { id_usuario: ID!, nombre: String!, email: String!, rol: String!, puntos_acumulados: Int!, token: String! }
  type FranjaRecogida { dia: Int!, inicio: String!, fin: String! }
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

  type Query {
    consultarCompra(id_compra: ID!): Compra!
    obtenerMisTarjetas(id_usuario: ID!): [TarjetaGuardada!]!
    buscarDirecciones(termino: String!): [DireccionUbicacion!]!
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

  type Mutation {
    prepararCompra(input: CompraInput!): Compra!
    confirmarCompra(id_compra: ID!): Compra!
    registrarUsuario(nombre: String!, email: String!, password: String!, rol: String): UsuarioAuth
    guardarPreferencias(id_usuario: ID!, tags: [ID!]!): String
    
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

    registrarNegocio(
      nombre: String!, 
      tipo: String!, 
      latitud: Float, 
      longitud: Float, 
      imagen_url: String,
      radio_cobertura_km: Float,
      telefono: String,
      direccion: String,
      horarios_recogida: [FranjaRecogidaInput!]
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

    alternarFavorito(id_restaurante: ID!): String
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
