// Conserva los pedidos antiguos; las nuevas compras agrupan todas sus unidades.
export const SQL_COMPRAS = `
  CREATE TABLE IF NOT EXISTS Compras (
    id_compra TEXT PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES Usuarios(id_usuario),
    id_restaurante INT REFERENCES Restaurantes(id_restaurante) ON DELETE SET NULL,
    solicitud JSONB NOT NULL,
    resumen JSONB NOT NULL,
    total_centimos INT NOT NULL CHECK (total_centimos >= 0),
    estado TEXT NOT NULL DEFAULT 'BORRADOR',
    payment_intent_id TEXT UNIQUE,
    refund_id TEXT UNIQUE,
    autorizacion_hasta TIMESTAMPTZ,
    motivo TEXT,
    creada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notificada BOOLEAN NOT NULL DEFAULT FALSE
  );
  ALTER TABLE Compras ADD COLUMN IF NOT EXISTS refund_id TEXT;
  ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS id_compra TEXT REFERENCES Compras(id_compra);
  ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS precio_centimos INT;
  ALTER TABLE Pedidos ADD COLUMN IF NOT EXISTS nombre_producto TEXT;
  CREATE INDEX IF NOT EXISTS pedidos_compra_idx ON Pedidos(id_compra);
  CREATE INDEX IF NOT EXISTS compras_pendientes_idx ON Compras(estado, actualizada);
`;
