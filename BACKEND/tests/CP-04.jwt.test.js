// Anexo A - CP-04 [RF-1.1, NFR-SEG-9] Emision y contenido del JWT (aislado)
// Criterio de aceptacion: los claims esperados estan presentes y la firma es
// valida con el secreto de prueba.
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/db", () => ({ pool: { query: jest.fn() } }));
const { pool } = require("../src/db");
const authRouter = require("../src/routes/auth");
const { montarRouter } = require("./helpers/app");

// El handler de login espera 4 s antes de responder (delay del codigo fuente).
jest.setTimeout(15000);

const app = montarRouter("/autenticacion", authRouter);

describe("CP-04 Emision y contenido del JWT", () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockImplementation(async (sql) => {
      if (/FROM usuarios/i.test(sql)) {
        return { rows: [{ id: 1, nombre_usuario: "admin_a", contrasena_hash: "ClaveSimulada#2026" }] };
      }
      if (/FROM empresa_usuarios/i.test(sql)) {
        return { rows: [{ id: 7, empresa_id: 3 }] };
      }
      return { rows: [] };
    });
  });

  test("POST /login entrega un JWT con usuarioId, nombreUsuario, empresaUsuarioId, empresaId y exp", async () => {
    const res = await request(app)
      .post("/autenticacion/login")
      .send({ nombre_usuario: "admin_a", password: "ClaveSimulada#2026" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");

    // Verifica la firma con el secreto de prueba (lanza si no es valida).
    const claims = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(claims).toMatchObject({
      usuarioId: 1,
      nombreUsuario: "admin_a",
      empresaUsuarioId: 7,
      empresaId: 3,
    });
    expect(typeof claims.exp).toBe("number");
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });
});
