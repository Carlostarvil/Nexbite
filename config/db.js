import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

// Propósito: Centralizar la conexión a PostgreSQL.
// Por qué el cambio: Si en el futuro necesitas conectarte a la base de datos desde otro archivo (por ejemplo, una tarea programada para limpiar registros), solo importas este archivo en lugar de reescribir las credenciales.
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect()
    .then(() => console.log('✅ Conexión a PostgreSQL (restaurantes_ai) exitosa'))
    .catch(err => console.error('❌ Error al conectar:', err.stack));

export default pool;

// Migración idempotente: no modifica los horarios de los locales existentes.
// Se espera antes de aceptar peticiones para evitar consultas a una columna aún no creada.
export const horariosRecogidaListos = pool.query(`
  ALTER TABLE Restaurantes ADD COLUMN IF NOT EXISTS horarios_recogida JSONB;
`);

// Conserva la relación con Stripe para reutilizar las tarjetas de cada cuenta.
export const clientesPagoListos = pool.query(`
  ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
`);

export const menusListos = pool.query(`
  CREATE TABLE IF NOT EXISTS Menu_Platos (
    id_menu INT NOT NULL REFERENCES Platos(id_plato) ON DELETE CASCADE,
    id_plato_incluido INT NOT NULL REFERENCES Platos(id_plato) ON DELETE CASCADE,
    PRIMARY KEY (id_menu, id_plato_incluido)
  );
`);

// Esto fuerza a Node a crear la tabla en la base de datos correcta si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS Platos_Favoritos (
      id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
      id_plato INT REFERENCES Platos(id_plato) ON DELETE CASCADE,
      PRIMARY KEY (id_usuario, id_plato)
  );
`).then(() => {
  console.log("✅ Tabla Platos_Favoritos verificada en la base de datos correcta.");
}).catch(err => {
  console.error("❌ Error verificando tabla:", err.message);
});
