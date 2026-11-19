const bcrypt = require("bcrypt");

// Costo 10: valor por defecto recomendado por OWASP, balancea resistencia
// a fuerza bruta con el umbral de rendimiento NFR-PERF-1 (<300ms).
const SALT_ROUNDS = 10;

// Formato bcrypt: $2a$/$2b$/$2y$ + costo + 53 caracteres de sal+hash
const BCRYPT_FORMAT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isBcryptHash(value) {
  return typeof value === "string" && BCRYPT_FORMAT.test(value);
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, storedHash) {
  if (!isBcryptHash(storedHash)) {
    // Compatibilidad con registros antiguos en texto plano no migrados
    return plainPassword === storedHash;
  }
  return bcrypt.compare(plainPassword, storedHash);
}

module.exports = { hashPassword, comparePassword, isBcryptHash, SALT_ROUNDS };
