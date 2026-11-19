const { Pool } = require("pg");
require("dotenv").config();

// Sin credenciales embebidas en el codigo (hallazgo SonarQube S2068 / CWE-798).
// La cadena de conexion se inyecta solo por variable de entorno o gestor de secretos.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no está definida. Configure la variable de entorno.");
}

const pool = new Pool({ connectionString });

module.exports = { pool };
