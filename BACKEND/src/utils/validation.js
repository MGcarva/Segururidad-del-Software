// Validaciones server-side y utilidades de seguridad compartidas (EV3).
// Mitigan: SEC-07 (politica de contrasena), SEC-17 (fuga de errores internos)
// y SEC-19 (datos invalidos persistidos por falta de validacion).

// Politica NFR-SEG: minimo 12 caracteres con mayuscula, minuscula, numero y simbolo.
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;
const EMAIL = /^[^\s@<>"'()]{1,64}@[^\s@<>"'()]{1,190}\.[A-Za-z]{2,}$/;
const PHONE = /^\+?[0-9 ]{8,15}$/;

function isStrongPassword(value) {
  return typeof value === "string" && PASSWORD_POLICY.test(value);
}

function isEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL.test(value);
}

function isPhone(value) {
  return typeof value === "string" && PHONE.test(value);
}

// Texto de ayuda de la politica, no una credencial (falso positivo revisado).
const PASSWORD_GLOSA = // nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_password
  "La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.";

// Valida los campos basicos de un cliente. Retorna un mensaje de error o null.
function validarCliente(body) {
  const { nombre, correo, telefono } = body || {};
  if (typeof nombre !== "string" || nombre.trim().length < 2 || nombre.length > 150) {
    return "El nombre es obligatorio (2 a 150 caracteres).";
  }
  if (correo != null && correo !== "" && !isEmail(correo)) return "El correo no tiene un formato válido.";
  if (telefono != null && telefono !== "" && !isPhone(telefono)) return "El teléfono no tiene un formato válido.";
  return null;
}

// Respuesta 500 generica: el detalle tecnico queda solo en el log del servidor
// (correlacionado por un id) y nunca se envia al cliente (OWASP A05 / CWE-209).
function errorInterno(res, err, mensaje = "Error interno") {
  const id = require("crypto").randomUUID();
  console.error(`[${id}]`, err);
  return res.status(500).json({ error: mensaje, glosa: `Ocurrió un error interno. Referencia: ${id}` });
}

module.exports = { isStrongPassword, isEmail, isPhone, validarCliente, errorInterno, PASSWORD_GLOSA };
