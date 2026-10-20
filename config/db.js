import pg from 'pg';
import dotenv from 'dotenv';
import { SQL_COMPRAS } from '../graphql/migracionCompras.js';

// Carga las variables de entorno desde el archivo .env a process.env.
// Propósito: Evitar exponer contraseñas y datos sensibles en el código fuente.
dotenv.config();

const { Pool } = pg;

/**
 * CONFIGURACIÓN DE LA BASE DE DATOS
 * Se crea un "Pool" de conexiones utilizando las variables de entorno.
 * El Pool mantiene un grupo de conexiones abiertas que se reutilizan,
 * evitando el costo de abrir y cerrar la base de datos con cada petición.
 */
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

/**
 * COMPROBACIÓN DE CONEXIÓN (Health Check)
 * Se ejecuta una consulta muy ligera ('SELECT 1') justo al arrancar.
 * Propósito: Verificar inmediatamente si el servidor puede hablar con PostgreSQL.
 * Si falla, el error salta en la consola antes de que un usuario intente hacer algo.
 */
pool.query('SELECT 1')
    .then(() => console.log('✅ Conexión a PostgreSQL (restaurantes_ai) exitosa'))
    .catch(err => console.error('❌ Error al conectar:', err.stack));

// Se exporta la instancia del pool para que el resto de la aplicación (servicios/resolvers) la utilice.
export default pool;

/* ==========================================================================
   MIGRACIONES AUTOMÁTICAS (Idempotentes)
   Estas instrucciones preparan la base de datos estructurando tablas y columnas.
   Al usar "IF NOT EXISTS", garantizamos la "idempotencia": el código puede 
   ejecutarse 100 veces sin fallar, ya que solo crea los elementos si no existen.
   ========================================================================== */

// 1. Añade la columna 'horarios_recogida' a la tabla Restaurantes.
// Se usa JSONB porque permite guardar estructuras de datos flexibles (como arrays de horas y días)
// directamente en una sola columna, optimizando las consultas.
export const horariosRecogidaListos = pool.query(`
  ALTER TABLE Restaurantes ADD COLUMN IF NOT EXISTS horarios_recogida JSONB;
`);

// 2. Prepara la integración con la pasarela de pago.
// Se añade el identificador del cliente de Stripe para poder realizar cobros guardados.
export const clientesPagoListos = pool.query(`
  ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
`);

// 3. Creación de tabla intermedia para la relación "Menú -> Platos".
// Un menú contiene muchos platos, y un plato puede pertenecer a varios menús.
export const menusListos = pool.query(`
  CREATE TABLE IF NOT EXISTS Menu_Platos (
    id_menu INT NOT NULL REFERENCES Platos(id_plato) ON DELETE CASCADE,
    id_plato_incluido INT NOT NULL REFERENCES Platos(id_plato) ON DELETE CASCADE,
    PRIMARY KEY (id_menu, id_plato_incluido) -- Evita que un plato se duplique en el mismo menú
  );
`);

// 4. Ejecuta un script de migración SQL externo (importado arriba).
export const comprasListas = pool.query(SQL_COMPRAS);

// 5. Creación de tabla intermedia para "Platos Favoritos".
// Vincula un Usuario con un Plato. 'ON DELETE CASCADE' es crucial: si se elimina 
// un usuario o un plato del sistema, su registro de favorito se borra automáticamente 
// para evitar "datos huérfanos".
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