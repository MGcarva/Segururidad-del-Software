// Limitador de intentos de login (mitiga SEC-06, fuerza bruta - OWASP A07).
// Cuenta solo intentos FALLIDOS por combinacion IP + nombre de usuario; tras
// MAX_FALLOS dentro de la ventana responde 429 hasta que la ventana expire.
// En memoria: suficiente para una sola instancia; con varias replicas se
// reemplaza por un almacen compartido (Redis), ver plan de mantenimiento.

const MAX_FALLOS = Number(process.env.LOGIN_MAX_FALLOS || 5);
const VENTANA_MS = Number(process.env.LOGIN_VENTANA_MS || 15 * 60 * 1000);
const intentos = new Map();

function clave(req) {
  const usuario = String((req.body && req.body.nombre_usuario) || "").toLowerCase().slice(0, 100);
  return `${req.ip}|${usuario}`;
}

function vigente(k) {
  const e = intentos.get(k);
  if (e && Date.now() - e.inicio > VENTANA_MS) {
    intentos.delete(k);
    return null;
  }
  return e || null;
}

function loginLimiter(req, res, next) {
  const e = vigente(clave(req));
  if (e && e.fallos >= MAX_FALLOS) {
    const reintentar = Math.ceil((e.inicio + VENTANA_MS - Date.now()) / 1000);
    res.set("Retry-After", String(reintentar));
    return res.status(429).json({
      error: "Demasiados intentos",
      glosa: "Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.",
    });
  }
  next();
}

function registrarFallo(req) {
  const k = clave(req);
  const e = vigente(k) || { fallos: 0, inicio: Date.now() };
  e.fallos += 1;
  intentos.set(k, e);
}

function registrarExito(req) {
  intentos.delete(clave(req));
}

module.exports = { loginLimiter, registrarFallo, registrarExito, MAX_FALLOS };
