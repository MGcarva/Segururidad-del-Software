const express = require("express");
const { pool } = require("../db");
const { getAuthUser, requireWrite } = require("../middleware/authz");

const router = express.Router();

// Registrar log manualmente. Requiere rol con permiso de escritura para
// evitar que cualquier usuario autenticado inyecte entradas arbitrarias.
router.post("/", requireWrite, async (req, res) => {
  const { accion, detalles } = req.body;
  try {
    const authUser = req.authUser;
    const actionText = detalles ? `${accion}: ${detalles}` : accion;
    const result = await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2) RETURNING *",
      [authUser.nombreUsuario, actionText]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar log", glosa: err.message || err.toString() });
  }
});

// Listar logs. Requiere estar autenticado (antes era público sin token).
router.get("/", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "No autorizado", glosa: "Token inválido o ausente" });
  }
  try {
    const result = await pool.query("SELECT * FROM auditoria ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar logs", glosa: err.message || err.toString() });
  }
});

module.exports = router;
