export const typeDefs = `#graphql
  type Tag { id_tag: ID!, nombre: String!, categoria: String! }
  type UsuarioAuth { id_usuario: ID!, nombre: String!, email: String!, rol: String!, puntos_acumulados: Int!, token: String! }
  
  type Restaurante { 
    id_restaurante: ID!
    nombre: String!
    tipo: String!
    latitud: Float
    longitud: Float
    imagen_url: String 
    aceptando_pedidos: Boolean 
    tiempo_reactivacion: String 
    radio_cobertura_km: Float
    telefono: String
    direccion: String
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
  }

  type Usuario {
    id_usuario: ID!
    nombre: String!
    email: String!
    rol: String!
    telefono: String
    direccion: String
  }

  type Query {
    obtenerTags: [Tag]
    obtenerRecomendaciones(id_usuario: ID!, limit: Int, offset: Int): [PlatoRecomendado]
    chatearConBot(mensaje: String!): String
    
    obtenerFavoritos(id_usuario: ID!): [Restaurante]
    obtenerPlatosFavoritos(id_usuario: ID!): [Plato] 

    obtenerRestaurantesCercanos(latitud: Float!, longitud: Float!, radio_km: Float): [RestauranteConDistancia]
    
    buscarRestaurantes(termino: String!): [Restaurante]
    buscarPlatos(termino: String!): [Plato] 
    
    obtenerMisRestaurantes: [Restaurante]
    obtenerMiRestaurante: Restaurante
    obtenerPedidosVendedor(id_restaurante: ID!): [Pedido]
    
    obtenerPedidosCliente(id_usuario: ID!): [Pedido]
    obtenerUltimosPedidos(id_usuario: ID!): [Pedido]

    obtenerRestaurantePorId(id_restaurante: ID!): Restaurante 
    obtenerMejoresRestaurantes: [Restaurante]
    obtenerMenuRestaurante(id_restaurante: ID!): [Plato]
    obtenerMasVendidos(id_restaurante: ID!): [Plato]
    obtenerPlatosPorCategoria(categoria: String!): [Plato]
    obtenerRestaurantesSimilares(id_restaurante: ID!): [Restaurante]
    obtenerPerfilUsuario(id_usuario: ID!): Usuario
    obtenerPlatosDestacados: [Plato]
  }

  type Mutation {
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
    ): Pedido
    
    solicitarAviso(id_usuario: ID!, tipo: String!, id_referencia: ID!): String

    registrarNegocio(
      nombre: String!, 
      tipo: String!, 
      latitud: Float, 
      longitud: Float, 
      imagen_url: String,
      radio_cobertura_km: Float,
      telefono: String,
      direccion: String
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
    
    crearIntencionPago(monto: Float!): String
    actualizarPerfilUsuario(id_usuario: ID!, telefono: String, direccion: String): Usuario
  }

  type Subscription { nuevoPedido(id_restaurante: ID!): Pedido }
`;