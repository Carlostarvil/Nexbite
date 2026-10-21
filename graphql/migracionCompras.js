// Conserva los pedidos antiguos; las nuevas compras agrupan todas sus unidades.
// Este bloque de texto contiene instrucciones SQL (DDL - Data Definition Language) 
// que le dicen a PostgreSQL cómo fabricar o actualizar la estructura de las tablas.
export const SQL_COMPRAS = `
  -- 1. CREACIÓN DE LA TABLA PRINCIPAL (Idempotente)
  -- 'IF NOT EXISTS' asegura que si la tabla ya existe, no dará error al reiniciar el servidor.
  CREATE TABLE IF NOT EXISTS Compras (
    -- PRIMARY KEY: Identificador único e irrepetible de la compra.
    id_compra TEXT PRIMARY KEY,
    
    -- REFERENCES: Clave Foránea (Foreign Key). Obliga a que el ID pertenezca a un usuario real.
    id_usuario INT NOT NULL REFERENCES Usuarios(id_usuario),
    
    -- ON DELETE SET NULL: Es vital para la contabilidad. Si un restaurante se da de baja y 
    -- se borra de la BD, NO queremos que se borren los historiales de pagos de los clientes. 
    -- Por eso, si el restaurante desaparece, este campo se queda en blanco (NULL) pero el recibo de compra se conserva.
    id_restaurante INT REFERENCES Restaurantes(id_restaurante) ON DELETE SET NULL,
    
    -- JSONB: Guarda objetos de JavaScript complejos de forma nativa y binaria. 
    -- Permite guardar todo el carrito (solicitud) sin necesidad de crear 50 columnas diferentes.
    solicitud JSONB NOT NULL,
    resumen JSONB NOT NULL,
    
    -- CHECK: Regla de integridad matemática a nivel de disco duro. La base de datos rechazará 
    -- cualquier intento de guardar una compra con precio negativo, evitando bugs catastróficos.
    total_centimos INT NOT NULL CHECK (total_centimos >= 0),
    
    -- DEFAULT: Si el código Node.js no especifica un estado al crear la fila, 
    -- PostgreSQL le escribirá 'BORRADOR' automáticamente.
    estado TEXT NOT NULL DEFAULT 'BORRADOR',
    
    -- UNIQUE: Regla antifraude. Impide matemáticamente que dos compras distintas 
    -- estén asociadas al mismo pago o al mismo reembolso de Stripe.
    payment_intent_id TEXT UNIQUE,
    refund_id TEXT UNIQUE,
    
    -- TIMESTAMPTZ: Guarda la fecha y la hora exacta incluyendo la Zona Horaria (Time Zone), 
    -- fundamental para evitar desfases con los cambios de horario de verano/invierno.
    autorizacion_hasta TIMESTAMPTZ,
    motivo TEXT,
    creada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notificada BOOLEAN NOT NULL DEFAULT FALSE
  );
  
  -- 2. EVOLUCIÓN DEL ESQUEMA (Migraciones Seguras)
  -- Estos comandos ALTER actualizan tablas antiguas de tu proyecto añadiendo nuevas columnas sin perder datos. 
  -- Si la columna ya se añadió en el pasado, el 'IF NOT EXISTS' hace que se ignore silenciosamente.
  ALTER TABLE Compras ADD COLUMN IF NOT EXISTS refund_id TEXT;
  
  -- Vincula la tabla antigua de "Pedidos individuales" con la nueva tabla madre de "Compras agrupadas".
  ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS id_compra TEXT REFERENCES Compras(id_compra);
  
  -- REGLA DE NEGOCIO (Historial inmutable): Se guarda el precio y nombre del producto en la tabla Pedidos.
  -- ¿Por qué? Si mañana el restaurante cambia el nombre de su "Pizza" y la sube de 10€ a 12€, 
  -- el ticket antiguo del cliente debe seguir mostrando "Pizza" a 10€. Estos campos actúan como una "fotografía" del momento.
  ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS precio_centimos INT;
  ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS nombre_producto TEXT;
  
  -- 3. OPTIMIZACIÓN DE RENDIMIENTO (Índices)
  -- Acelera drásticamente las consultas del tipo "Busca todos los pedidos que pertenecen a la compra X".
  CREATE INDEX IF NOT EXISTS pedidos_compra_idx ON Pedidos(id_compra);
  
  -- ÍNDICE COMPUESTO: Como hay un proceso (Worker) que revisa continuamente la base de datos 
  -- buscando compras atascadas usando tanto el 'estado' como la fecha 'actualizada', 
  -- este índice doble crea un árbol de búsqueda optimizado para que el servidor lo encuentre en milisegundos.
  CREATE INDEX IF NOT EXISTS compras_pendientes_idx ON Compras(estado, actualizada);
`;