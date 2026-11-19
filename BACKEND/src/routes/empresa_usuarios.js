const express = require("express");
const { pool } = require("../db");
const { errorInterno, isStrongPassword, isEmail, PASSWORD_GLOSA } = require("../utils/validation");
const { getAuthUser, requireWrite } = require("../middleware/authz");
const { hashPassword } = require("../utils/security");

const router = express.Router();

const ROLES_VALIDOS = [1, 2]; // 1=administrador, 2=editor

// Crear relación empresa-usuario con rol (crea usuario si no existe)
router.post("/", requireWrite, async (req, res) => {
  try {
    const empresaId = req.authUser.empresaId;
    let usuarioId;
    const { usuario_id, rol_id, nombre_usuario, contrasena_hash, correo } =
      req.body;

    if (!ROLES_VALIDOS.includes(Number(rol_id))) {
      return res.status(400).json({
        error: "Datos inválidos",
        glosa: `rol_id debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
      });
    }

    // Si viene usuario_id, usar ese (compatibilidad con formato anterior)
    // Si vienen datos del usuario, crear el usuario primero
    if (usuario_id) {
      // Un usuario ya vinculado a otra empresa no puede ser "capturado" (SEC-14):
      // el login toma el vinculo mas reciente, por lo que esto permitia secuestrar cuentas.
      const otro = await pool.query(
        "SELECT 1 FROM empresa_usuarios WHERE usuario_id = $1 AND empresa_id <> $2",
        [usuario_id, empresaId]
      );
      if (otro.rows.length > 0) {
        return res.status(409).json({ error: "Conflicto", glosa: "El usuario pertenece a otra empresa." });
      }
      usuarioId = usuario_id;
    } else if (nombre_usuario && contrasena_hash && correo) {
      if (!isStrongPassword(contrasena_hash)) {
        return res.status(400).json({ error: "Datos inválidos", glosa: PASSWORD_GLOSA });
      }
      if (!isEmail(correo)) {
        return res.status(400).json({ error: "Datos inválidos", glosa: "El correo no tiene un formato válido." });
      }
      // Crear usuario primero (contraseña hasheada con bcrypt)
      const hashedPassword = await hashPassword(contrasena_hash);
      const usuarioResult = await pool.query(
        "INSERT INTO usuarios (nombre_usuario, contrasena_hash, correo) VALUES ($1, $2, $3) RETURNING id, nombre_usuario, correo, created_at",
        [nombre_usuario, hashedPassword, correo]
      );
      usuarioId = usuarioResult.rows[0].id;
    } else {
      return res.status(400).json({
        error: "Datos inválidos",
        glosa:
          "Debe proporcionar usuario_id o los datos del usuario (nombre_usuario, contrasena_hash, correo)",
      });
    }

    // Crear relación empresa-usuario
    const result = await pool.query(
      "INSERT INTO empresa_usuarios (empresa_id, usuario_id, rol_id) VALUES ($1, $2, $3) RETURNING *",
      [empresaId, usuarioId, rol_id]
    );

    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        req.authUser.nombreUsuario,
        `EMPRESA_USUARIOS_CREAR: vinculó usuario ${usuarioId} a empresa ${empresaId} con rol ${rol_id}`,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al crear vínculo");
  }
});

// Listar usuarios de la empresa (filtrado por empresa del token)
router.get("/", async (req, res) => {
  try {
    const authUser = getAuthUser(req);

    if (!authUser || !authUser.empresaId) {
      return res.status(401).json({
        error: "No autorizado",
        glosa: "Token inválido o sin empresa asociada",
      });
    }

    const empresaId = authUser.empresaId;

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.nombre_usuario,
        u.correo,
        eu.created_at,
        eu.rol_id,
        r.nombre AS rol_nombre
      FROM empresa_usuarios eu
      INNER JOIN usuarios u ON u.id = eu.usuario_id
      LEFT JOIN roles r ON r.id = eu.rol_id
      WHERE eu.empresa_id = $1
      ORDER BY eu.created_at DESC
    `,
      [empresaId]
    );

    res.json(result.rows);
  } catch (err) {
    errorInterno(res, err, "Error al listar usuarios");
  }
});

// Obtener vínculo por id (solo si pertenece a la empresa del token)
router.get("/:id", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || !authUser.empresaId) {
    return res.status(401).json({ error: "No autorizado", glosa: "Token inválido o sin empresa asociada" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM empresa_usuarios WHERE id=$1 AND empresa_id=$2",
      [req.params.id, authUser.empresaId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al obtener vínculo");
  }
});

// Actualizar vínculo — requiere permiso de escritura; el rol_id solo puede
// cambiarlo un administrador de la MISMA empresa del vínculo (evita que un
// usuario se auto-escale su propio rol).
router.put("/:id", requireWrite, async (req, res) => {
  const { empresa_id, usuario_id, rol_id } = req.body;

  if (rol_id !== undefined && !ROLES_VALIDOS.includes(Number(rol_id))) {
    return res.status(400).json({
      error: "Datos inválidos",
      glosa: `rol_id debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
    });
  }

  try {
    const existente = await pool.query(
      "SELECT empresa_id FROM empresa_usuarios WHERE id=$1",
      [req.params.id]
    );
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: "No encontrado" });
    }
    if (String(existente.rows[0].empresa_id) !== String(req.authUser.empresaId)) {
      return res.status(404).json({ error: "No encontrado" });
    }

    const result = await pool.query(
      "UPDATE empresa_usuarios SET empresa_id=$1, usuario_id=$2, rol_id=$3 WHERE id=$4 RETURNING *",
      [empresa_id, usuario_id, rol_id, req.params.id]
    );

    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        req.authUser.nombreUsuario,
        `EMPRESA_USUARIOS_ACTUALIZAR: actualizó vínculo ID ${req.params.id}`,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al actualizar vínculo");
  }
});

// Eliminar vínculo (solo dentro de la propia empresa)
router.delete("/:id", requireWrite, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM empresa_usuarios WHERE id=$1 AND empresa_id=$2 RETURNING *",
      [req.params.id, req.authUser.empresaId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        req.authUser.nombreUsuario,
        `EMPRESA_USUARIOS_ELIMINAR: eliminó vínculo ID ${req.params.id}`,
      ]
    );

    res.json({ deleted: true });
  } catch (err) {
    errorInterno(res, err, "Error al eliminar vínculo");
  }
});

module.exports = router;
