const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const { pool } = require("./db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const clientRoutes = require("./routes/clients");
const contractRoutes = require("./routes/contracts");
const auditRoutes = require("./routes/audit");
const empresasRoutes = require("./routes/empresas");
const rolesRoutes = require("./routes/roles");
const empresaUsuariosRoutes = require("./routes/empresa_usuarios");
const metricasRoutes = require("./routes/metricas");

const app = express();

// Cabeceras de seguridad HTTP (SEC-15/16): nosniff, X-Frame-Options, HSTS,
// CSP restrictiva para una API JSON y eliminacion de X-Powered-By.
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
}));

// CORS restringido al origen del frontend (SEC-18). Se configura por entorno.
const ORIGENES = (process.env.CORS_ORIGINS || "http://localhost:3350")
  .split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: ORIGENES, credentials: false }));
app.use(express.json({ limit: "100kb" }));

// Rechaza bytes nulos en query y body: PostgreSQL no los acepta en texto y
// provocaban errores 500 (hallazgo ZAP "Server Error" con payload %00).
app.use((req, res, next) => {
  const tieneNulo = (v) => typeof v === "string" ? v.includes("\u0000")
    : v && typeof v === "object" ? Object.values(v).some(tieneNulo) : false;
  if (tieneNulo(req.query) || tieneNulo(req.body) || req.path.includes("\u0000")) {
    return res.status(400).json({ error: "Datos inválidos", glosa: "La solicitud contiene caracteres no permitidos." });
  }
  next();
});
app.use(morgan("dev"));

const uploadsDir = path.join(__dirname, "..", "uploads", "contracts");
fs.mkdirSync(uploadsDir, { recursive: true });

app.use("/autenticacion", authRoutes);
app.use("/usuarios", userRoutes);
app.use("/clientes", clientRoutes);
app.use("/contratos", contractRoutes);
app.use("/auditoria", auditRoutes);
app.use("/empresas", empresasRoutes);
app.use("/roles", rolesRoutes);
app.use("/empresa-usuarios", empresaUsuariosRoutes);
app.use("/metricas", metricasRoutes);

const openapi = require("./openapi.json");
// Swagger UI necesita scripts/estilos propios: se relaja la CSP solo en /docs
// y solo fuera de produccion (no se publica la superficie de la API).
if (process.env.NODE_ENV !== "production") {
  app.use("/docs", helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapi));
}
app.get("/openapi.json", (req, res) => {
  res.json(openapi);
});

// Eliminado: app.use("/files/contracts", express.static(uploadsDir)) exponia
// archivos sin autenticacion. Los documentos se sirven solo via
// GET /contratos/:id/file, que valida token y empresa.

app.get("/", (req, res) => {
  res.json({ name: "Atlas", status: "ok" });
});

// Manejador global de errores: JSON mal formado, multipart invalido o archivo
// demasiado grande responden 4xx en JSON; cualquier otro error, 500 generico
// sin stack trace (antes Express devolvia su pagina HTML por defecto).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Datos inválidos", glosa: "JSON mal formado." });
  }
  if (err.type === "entity.too.large" || err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Solicitud demasiado grande" });
  }
  if (err.name === "MulterError" || /multipart|end of form|boundary|part header/i.test(err.message || "")) {
    return res.status(400).json({ error: "Archivo inválido", glosa: "Formulario o archivo mal formado." });
  }
  const id = require("crypto").randomUUID();
  console.error(`[${id}]`, err);
  res.status(500).json({ error: "Error interno", glosa: `Referencia: ${id}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Atlas API escuchando en puerto ${PORT}`);
});
