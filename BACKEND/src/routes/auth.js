const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { pool } = require("../db");
const { comparePassword, hashPassword, isBcryptHash } = require("../utils/security");
const { getAuthUser, revokeJti, JWT_SECRET } = require("../middleware/authz");
const { loginLimiter, registrarFallo, registrarExito } = require("../middleware/loginLimiter");
const { errorInterno } = require("../utils/validation");

const router = express.Router();


// Login: contraseña verificada con bcrypt (con compatibilidad de migración
// automática para registros antiguos que aún estén en texto plano).
router.post("/login", loginLimiter, async (req, res) => {
  const { nombre_usuario, password } = req.body;
  try {
    const result = await pool.query(
      "SELECT id, nombre_usuario, contrasena_hash FROM usuarios WHERE nombre_usuario = $1",
      [nombre_usuario]
    );
    if (result.rows.length === 0) {
      registrarFallo(req);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const user = result.rows[0];
    const passwordOk = await comparePassword(String(password || ""), user.contrasena_hash);
    if (!passwordOk) {
      registrarFallo(req);
      await pool.query(
        "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
        [user.nombre_usuario, "LOGIN_FALLIDO: contraseña incorrecta"]
      );
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    registrarExito(req);

    // Migración perezosa: si el registro aún estaba en texto plano, se
    // re-hashea con bcrypt ahora que conocemos la contraseña en claro.
    if (!isBcryptHash(user.contrasena_hash)) {
      const newHash = await hashPassword(password);
      await pool.query("UPDATE usuarios SET contrasena_hash = $1 WHERE id = $2", [newHash, user.id]);
    }

    // Obtener el empresa_usuario id, empresa_id y rol más reciente para este usuario
    const empresaUsuarioResult = await pool.query(
      `SELECT eu.id, eu.empresa_id, r.nombre AS rol
       FROM empresa_usuarios eu
       LEFT JOIN roles r ON r.id = eu.rol_id
       WHERE eu.usuario_id = $1
       ORDER BY eu.id DESC LIMIT 1`,
      [user.id]
    );
    const empresaUsuarioId = empresaUsuarioResult.rows.length > 0
      ? empresaUsuarioResult.rows[0].id
      : null;
    const empresaId = empresaUsuarioResult.rows.length > 0
      ? empresaUsuarioResult.rows[0].empresa_id
      : null;
    const rol = empresaUsuarioResult.rows.length > 0
      ? empresaUsuarioResult.rows[0].rol
      : null;

    const token = jwt.sign(
      {
        usuarioId: user.id,
        nombreUsuario: user.nombre_usuario,
        empresaUsuarioId: empresaUsuarioId,
        empresaId: empresaId,
        rol: rol,
        jti: crypto.randomUUID()
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    // Registrar en auditoría
    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [user.nombre_usuario, "LOGIN: usuario inició sesión"]
    );

    res.json({ token });
  } catch (err) {
    errorInterno(res, err, "Error en login");
  }
});

// Logout: revoca el token actual (RF-1.2 / NFR-SEG-9). El token deja de
// ser aceptado por cualquier endpoint protegido de inmediato.
router.post("/logout", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "No autorizado", glosa: "Token inválido o ya revocado" });
  }
  revokeJti(authUser.jti);
  await pool.query(
    "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
    [authUser.nombreUsuario, "LOGOUT: usuario cerró sesión"]
  );
  res.json({ loggedOut: true });
});

module.exports = router;
