const express = require("express");
const { pool } = require("../db");
const { errorInterno, isStrongPassword, isEmail, PASSWORD_GLOSA } = require("../utils/validation");

// El usuario objetivo debe pertenecer a la empresa del token (mitiga IDOR SEC-11/12).
async function perteneceAEmpresa(usuarioId, empresaId) {
  const r = await pool.query(
    "SELECT 1 FROM empresa_usuarios WHERE usuario_id = $1 AND empresa_id = $2",
    [usuarioId, empresaId]
  );
  return r.rows.length > 0;
}
const { getAuthUser, requireWrite } = require("../middleware/authz");
const { hashPassword } = require("../utils/security");

const router = express.Router();

// Crear usuario (requiere sesión con permiso de escritura)
router.post("/", requireWrite, async (req, res) => {
  const { nombre_usuario, contrasena_hash, correo } = req.body;
  if (!isStrongPassword(contrasena_hash)) {
    return res.status(400).json({ error: "Datos inválidos", glosa: PASSWORD_GLOSA });
  }
  if (!isEmail(correo)) {
    return res.status(400).json({ error: "Datos inválidos", glosa: "El correo no tiene un formato válido." });
  }
  try {
    const hashedPassword = await hashPassword(contrasena_hash);
    const result = await pool.query(
      "INSERT INTO usuarios (nombre_usuario, contrasena_hash, correo) VALUES ($1, $2, $3) RETURNING id, nombre_usuario, correo, created_at",
      [nombre_usuario, hashedPassword, correo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al crear usuario");
  }
});

// Listar usuarios filtrados por empresa del token
router.get("/", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    // Si no hay token o no hay empresaId, retornar error
    if (!authUser || !authUser.empresaId) {
      return res.status(401).json({
        error: "No autorizado",
        glosa: "Token inválido o sin empresa asociada",
      });
    }

    // Filtrar usuarios que pertenecen a la empresa del token
    const result = await pool.query(
      `SELECT DISTINCT u.id, u.nombre_usuario, u.correo, u.created_at
       FROM usuarios u
       INNER JOIN empresa_usuarios eu ON eu.usuario_id = u.id
       WHERE eu.empresa_id = $1
       ORDER BY u.id DESC`,
      [authUser.empresaId]
    );

    res.json(result.rows);
  } catch (err) {
    errorInterno(res, err, "Error al listar usuarios");
  }
});

// Obtener usuario por id (solo si pertenece a la empresa del token)
router.get("/:id", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || !authUser.empresaId) {
    return res.status(401).json({ error: "No autorizado", glosa: "Token inválido o sin empresa asociada" });
  }
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre_usuario, u.correo, u.created_at
       FROM usuarios u
       INNER JOIN empresa_usuarios eu ON eu.usuario_id = u.id
       WHERE u.id = $1 AND eu.empresa_id = $2`,
      [req.params.id, authUser.empresaId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al obtener usuario");
  }
});

// Actualizar usuario (contraseña hasheada con bcrypt si se envía)
router.put("/:id", requireWrite, async (req, res) => {
  const { nombre_usuario, contrasena_hash, correo } = req.body;
  if (contrasena_hash !== undefined && contrasena_hash !== "" && !isStrongPassword(contrasena_hash)) {
    return res.status(400).json({ error: "Datos inválidos", glosa: PASSWORD_GLOSA });
  }
  if (correo !== undefined && !isEmail(correo)) {
    return res.status(400).json({ error: "Datos inválidos", glosa: "El correo no tiene un formato válido." });
  }
  try {
    if (!(await perteneceAEmpresa(req.params.id, req.authUser.empresaId))) {
      return res.status(404).json({ error: "No encontrado" });
    }
    // La contraseña solo se actualiza si se envía (antes se re-hasheaba undefined).
    const hashedPassword = contrasena_hash ? await hashPassword(contrasena_hash) : null;
    const result = await pool.query(
      `UPDATE usuarios SET
         nombre_usuario = COALESCE($1, nombre_usuario),
         contrasena_hash = COALESCE($2, contrasena_hash),
         correo = COALESCE($3, correo)
       WHERE id = $4 RETURNING id, nombre_usuario, correo, created_at`,
      [nombre_usuario ?? null, hashedPassword, correo ?? null, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        req.authUser.nombreUsuario,
        `USUARIOS_ACTUALIZAR: actualizó usuario ID ${req.params.id}`,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al actualizar usuario");
  }
});

// Eliminar usuario
router.delete("/:id", requireWrite, async (req, res) => {
  try {
    if (!(await perteneceAEmpresa(req.params.id, req.authUser.empresaId))) {
      return res.status(404).json({ error: "No encontrado" });
    }
    const result = await pool.query(
      "DELETE FROM usuarios WHERE id=$1 RETURNING id",
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        req.authUser.nombreUsuario,
        `USUARIOS_ELIMINAR: eliminó usuario ID ${req.params.id}`,
      ]
    );

    res.json({ deleted: true });
  } catch (err) {
    errorInterno(res, err, "Error al eliminar usuario");
  }
});

module.exports = router;
