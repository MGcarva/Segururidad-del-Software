// Utilidades de las pruebas de integracion del Anexo A (Jest + Supertest).
// Se prueba la API real levantada con Docker Compose; cada corrida crea sus
// propias empresas/usuarios con sufijo unico para ser repetible.
const path = require("path");
const crypto = require("crypto");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", "..", ".env") });

const API_URL = process.env.API_URL || "http://localhost:4450";
const PASSWORD = "Atlas#Prueba2026";
const RUN = Date.now().toString(36);
let seq = 0;

const api = () => request(API_URL);
const uid = (prefijo) => `${prefijo}_${RUN}_${++seq}`;

let pool;
function db() {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.TEST_DATABASE_URL ||
        `postgres://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD || "postgres"}@localhost:${process.env.PORT_POSTGRES || 15432}/${process.env.POSTGRES_DB || "atlas"}`,
    });
  }
  return pool;
}
const cerrarDb = () => (pool ? pool.end() : Promise.resolve());

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Crea usuario + empresa (el primer usuario queda como administrador) y hace login.
async function registrarEmpresa(sufijo = "A") {
  const nombre_usuario = uid(`qa_${sufijo}`);
  const correo = `${nombre_usuario}@qa.cl`;
  const reg = await api()
    .post("/empresas")
    .send({
      usuario: { nombre_usuario, contrasena_hash: PASSWORD, correo },
      empresa: { nombre: `Empresa QA ${nombre_usuario}`, direccion: "Santiago", telefono: "221234567", correo: `empresa_${nombre_usuario}@qa.cl` },
    });
  if (reg.status !== 201) throw new Error(`registro de empresa fallo: ${reg.status} ${JSON.stringify(reg.body)}`);
  const token = await login(nombre_usuario, PASSWORD);
  return { nombre_usuario, correo, token, usuarioId: reg.body.usuario.id, empresaId: reg.body.empresa.id };
}

async function login(nombre_usuario, password = PASSWORD) {
  const r = await api().post("/autenticacion/login").send({ nombre_usuario, password });
  if (r.status !== 200) throw new Error(`login fallo: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}

const decodificar = (token) => jwt.decode(token);

function clienteValido(extra = {}) {
  const n = uid("cli");
  return {
    nombre: `Cliente Prueba ${n}`,
    correo: `${n}@test.cl`,
    telefono: "+56 9 1234 5678",
    direccion: "Av. Providencia 123",
    es_empresa: false,
    rut: "12.345.678-5",
    ...extra,
  };
}

async function crearCliente(token, extra = {}) {
  const r = await api().post("/clientes").set(auth(token)).send(clienteValido(extra));
  if (r.status !== 201) throw new Error(`crear cliente fallo: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

// Crea un contrato (multipart) y devuelve la respuesta completa de Supertest.
function crearContrato(token, { cliente_id, titulo, fecha_inicio = "2026-01-01", fecha_fin = "2026-12-31", archivo } = {}) {
  let req = api()
    .post("/contratos")
    .set(auth(token))
    .field("cliente_id", String(cliente_id))
    .field("titulo", titulo || uid("Contrato"))
    .field("descripcion", "Contrato de prueba de integracion")
    .field("fecha_inicio", fecha_inicio)
    .field("fecha_fin", fecha_fin);
  if (archivo) req = req.attach("file", archivo.buffer, { filename: archivo.nombre, contentType: archivo.tipo });
  return req;
}

// Archivo sintetico del tamano pedido con la cabecera (magic bytes) del formato.
function archivoSintetico(nombre, tipo, bytes, cabecera = Buffer.alloc(0)) {
  const buffer = Buffer.concat([cabecera, crypto.randomBytes(Math.max(bytes - cabecera.length, 0))]);
  return { nombre, tipo, buffer, sha256: sha256(buffer) };
}
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// Parser binario para descargas (Supertest solo conoce JSON/texto por defecto).
const parseBinario = (res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

const auditoriaDe = async (nombre_usuario) => {
  const r = await api().get("/auditoria");
  return (Array.isArray(r.body) ? r.body : []).filter((a) => a.usuario_id === nombre_usuario);
};

// Evita que una cadena de error exponga la respuesta completa con datos sensibles.
const filtraMotor = (body) => /duplicate key|violates|unique constraint|syntax error|invalid input|column|relation "|pg_/i.test(JSON.stringify(body));

module.exports = {
  API_URL, PASSWORD, api, auth, db, cerrarDb, uid, registrarEmpresa, login, decodificar,
  clienteValido, crearCliente, crearContrato, archivoSintetico, sha256, parseBinario, auditoriaDe, filtraMotor,
};
