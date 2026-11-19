const express = require("express");
const { pool } = require("../db");
const { errorInterno, isStrongPassword, isEmail, PASSWORD_GLOSA } = require("../utils/validation");
const { getAuthUser, requireWrite } = require("../middleware/authz");
const { hashPassword } = require("../utils/security");

const router = express.Router();

// Verifica explícitamente la unicidad del correo de empresa antes de
// insertar, para poder devolver un mensaje de negocio claro en vez del
// error crudo de PostgreSQL (CP-186 / CP-188).
async function correoEmpresaYaExiste(correo) {
  const result = await pool.query("SELECT 1 FROM empresas WHERE correo = $1", [correo]);
  return result.rows.length > 0;
}

// Crear empresa (con usuario y relación) — flujo público de registro
router.post("/", async (req, res) => {
  // Verificar si viene el formato nuevo con usuario y empresa
  if (req.body.usuario && req.body.empresa) {
    const { usuario, empresa } = req.body;
    const { nombre_usuario, contrasena_hash, correo: correoUsuario } = usuario;
    const { nombre, direccion = null, telefono = null, correo } = empresa;

    if (!nombre_usuario || !isStrongPassword(contrasena_hash)) {
      return res.status(400).json({ error: "Datos inválidos", glosa: PASSWORD_GLOSA });
    }
    if (!isEmail(correoUsuario) || !isEmail(correo) || !nombre) {
      return res.status(400).json({ error: "Datos inválidos", glosa: "Nombre de empresa y correos válidos son obligatorios." });
    }
    try {
      if (await correoEmpresaYaExiste(correo)) {
        return res.status(409).json({
          error: "Correo en uso",
          glosa: "El correo de la empresa ya está registrado. Usa otro correo.",
        });
      }

      // 1. Crear usuario (contraseña hasheada con bcrypt)
      const hashedPassword = await hashPassword(contrasena_hash);
      const usuarioResult = await pool.query(
        "INSERT INTO usuarios (nombre_usuario, contrasena_hash, correo) VALUES ($1, $2, $3) RETURNING id, nombre_usuario, correo, created_at",
        [nombre_usuario, hashedPassword, correoUsuario]
      );
      const usuarioId = usuarioResult.rows[0].id;

      // 2. Crear empresa
      const empresaResult = await pool.query(
        "INSERT INTO empresas (nombre, direccion, telefono, correo) VALUES ($1, $2, $3, $4) RETURNING *",
        [nombre, direccion, telefono, correo]
      );
      const empresaId = empresaResult.rows[0].id;

      // 3. Crear relación empresa-usuario con rol administrador (ID 1)
      await pool.query(
        "INSERT INTO empresa_usuarios (empresa_id, usuario_id, rol_id) VALUES ($1, $2, $3) RETURNING *",
        [empresaId, usuarioId, 1]
      );

      res.status(201).json({
        usuario: usuarioResult.rows[0],
        empresa: empresaResult.rows[0],
      });
    } catch (err) {
      errorInterno(res, err, "Error al crear empresa con usuario");
    }
  } else {
    // Formato anterior: solo crear empresa (requiere sesión con permiso de escritura)
    return requireWrite(req, res, async () => {
      const { nombre, direccion = null, telefono = null, correo } = req.body;
      try {
        if (await correoEmpresaYaExiste(correo)) {
          return res.status(409).json({
            error: "Correo en uso",
            glosa: "El correo de la empresa ya está registrado. Usa otro correo.",
          });
        }
        const result = await pool.query(
          "INSERT INTO empresas (nombre, direccion, telefono, correo) VALUES ($1, $2, $3, $4) RETURNING *",
          [nombre, direccion, telefono, correo]
        );

        await pool.query(
          "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
          [req.authUser.nombreUsuario, `EMPRESAS_CREAR: creó empresa ${nombre}`]
        );

        res.status(201).json(result.rows[0]);
      } catch (err) {
        errorInterno(res, err, "Error al crear empresa");
      }
    });
  }
});

// Listar empresas — solo la propia empresa del token (antes exponía todas)
router.get("/", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || !authUser.empresaId) {
    return res.status(401).json({ error: "No autorizado", glosa: "Token inválido o sin empresa asociada" });
  }
  try {
    const result = await pool.query("SELECT * FROM empresas WHERE id=$1", [authUser.empresaId]);
    res.json(result.rows);
  } catch (err) {
    errorInterno(res, err, "Error al listar empresas");
  }
});

// Obtener empresa por id — solo si es la propia empresa del token
router.get("/:id", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || !authUser.empresaId) {
    return res.status(401).json({ error: "No autorizado", glosa: "Token inválido o sin empresa asociada" });
  }
  if (String(authUser.empresaId) !== String(req.params.id)) {
    return res.status(404).json({ error: "No encontrado" });
  }
  try {
    const result = await pool.query("SELECT * FROM empresas WHERE id=$1", [
      req.params.id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al obtener empresa");
  }
});

// Actualizar empresa
router.put("/:id", requireWrite, async (req, res) => {
  if (String(req.authUser.empresaId) !== String(req.params.id)) {
    return res.status(404).json({ error: "No encontrado" });
  }
  const { nombre, direccion = null, telefono = null, correo } = req.body;
  try {
    const result = await pool.query(
      "UPDATE empresas SET nombre=$1, direccion=$2, telefono=$3, correo=$4 WHERE id=$5 RETURNING *",
      [nombre, direccion, telefono, correo, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        req.authUser.nombreUsuario,
        `EMPRESAS_ACTUALIZAR: actualizó empresa ID ${req.params.id}`,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al actualizar empresa");
  }
});

// Eliminar empresa
router.delete("/:id", requireWrite, async (req, res) => {
  if (String(req.authUser.empresaId) !== String(req.params.id)) {
    return res.status(404).json({ error: "No encontrado" });
  }
  try {
    const result = await pool.query(
      "DELETE FROM empresas WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        req.authUser.nombreUsuario,
        `EMPRESAS_ELIMINAR: eliminó empresa ID ${req.params.id}`,
      ]
    );

    res.json({ deleted: true });
  } catch (err) {
    errorInterno(res, err, "Error al eliminar empresa");
  }
});

module.exports = router;
