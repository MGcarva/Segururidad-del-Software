const express = require("express");
const { pool } = require("../db");
const { errorInterno } = require("../utils/validation");
const { getAuthUser } = require("../middleware/authz");

const router = express.Router();

// La bitacora es de solo-anexion y la escribe exclusivamente el sistema.
// Antes existia POST /auditoria, que permitia a cualquier administrador
// insertar entradas arbitrarias (falsificacion del registro, detectado con
// OWASP ZAP; contrario a la trazabilidad exigida por la Ley 21.663). El
// frontend no lo utilizaba, por lo que se deshabilita (SEC-21).
router.post("/", (req, res) =>
  res.status(405).json({ error: "Método no permitido", glosa: "La auditoría solo la registra el sistema." })
);

// Listar logs. Requiere estar autenticado (antes era público sin token).
router.get("/", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || !authUser.empresaId) {
    return res.status(401).json({ error: "No autorizado", glosa: "Token inválido o ausente" });
  }
  try {
    // Solo registros generados por usuarios de la misma empresa (SEC-13,
    // Ley 21.719: los datos de una empresa no se exponen a otra).
    const result = await pool.query(
      `SELECT a.* FROM auditoria a
       WHERE a.usuario_id IN (
         SELECT u.nombre_usuario FROM usuarios u
         INNER JOIN empresa_usuarios eu ON eu.usuario_id = u.id
         WHERE eu.empresa_id = $1)
       ORDER BY a.id DESC LIMIT 1000`,
      [authUser.empresaId]
    );
    res.json(result.rows);
  } catch (err) {
    errorInterno(res, err, "Error al listar logs");
  }
});

module.exports = router;
