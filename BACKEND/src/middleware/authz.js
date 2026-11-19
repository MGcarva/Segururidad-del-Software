const jwt = require("jsonwebtoken");

// Sin secreto por defecto: si falta o es debil, el servicio no arranca
// (antes caia a "inseguro", lo que permitia forjar tokens - CWE-798/CWE-321).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET ausente o menor a 32 caracteres.");
}

// Roles reconocidos por el sistema y sus permisos. Unica fuente de verdad
// para decidir que puede hacer cada rol (CP-031: "funcion que determina
// los permisos segun el rol del usuario").
const PERMISSIONS_BY_ROLE = {
  administrador: { read: true, write: true },
  editor: { read: true, write: false },
};

function getPermissionsForRole(rolNombre) {
  return PERMISSIONS_BY_ROLE[rolNombre] || { read: false, write: false };
}

// Lista de revocacion de tokens en memoria (CP-006). Vive mientras el
// proceso del backend este arriba; suficiente para una unica instancia
// como la de este proyecto. Se limpia sola cuando el JWT expira de todas
// formas (2h), asi que el set nunca crece sin limite.
const revokedJtis = new Set();

function revokeJti(jti) {
  if (jti) revokedJtis.add(jti);
}

function isRevoked(jti) {
  return !!jti && revokedJtis.has(jti);
}

function getAuthUser(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const token = auth.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (isRevoked(decoded.jti)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// Middleware autocontenido: no depende de que otro middleware haya corrido
// antes. Rechaza con 403 si el rol del usuario autenticado no tiene
// permiso de escritura, y con 401 si no hay sesion valida.
function requireWrite(req, res, next) {
  const authUser = getAuthUser(req);
  if (!authUser || !authUser.empresaId) {
    return res.status(401).json({
      error: "No autorizado",
      glosa: "Token inválido, revocado o sin empresa asociada",
    });
  }
  const perms = getPermissionsForRole(authUser.rol);
  if (!perms.write) {
    return res.status(403).json({
      error: "Prohibido",
      glosa: `El rol '${authUser.rol || "desconocido"}' no tiene permisos de escritura`,
    });
  }
  req.authUser = authUser;
  next();
}

module.exports = { getAuthUser, requireWrite, getPermissionsForRole, PERMISSIONS_BY_ROLE, revokeJti, isRevoked, JWT_SECRET };
