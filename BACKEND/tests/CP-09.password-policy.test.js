// Anexo A - CP-09 [RF-2.1, ERS 2.4] Rechazo de contrasena que incumple la politica
// Politica: minimo 12 caracteres con mayuscula, minuscula, numero y simbolo.
// Criterio de aceptacion: solo las contrasenas que cumplen la politica son aceptadas.
const request = require("supertest");

jest.mock("../src/db", () => ({ pool: { query: jest.fn() } }));
const { pool } = require("../src/db");
const empresasRouter = require("../src/routes/empresas");
const { montarRouter } = require("./helpers/app");

const app = montarRouter("/empresas", empresasRouter);

// DP-01 del Anexo A (hoja Datos_de_Prueba) con la contrasena como variable.
const registro = (contrasena) => ({
  usuario: { nombre_usuario: "nuevo_a", contrasena_hash: contrasena, correo: "nuevo_a@test.cl" },
  empresa: {
    nombre: "Empresa Prueba SpA",
    direccion: "Av. Prueba 123, Santiago",
    telefono: "+56 2 2345 6789",
    correo: "contacto@empresaprueba.test",
  },
});

describe("CP-09 Politica de contrasenas en el registro", () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockResolvedValue({ rows: [{ id: 1, nombre_usuario: "nuevo_a", correo: "nuevo_a@test.cl" }] });
  });

  test.each([
    ["11 caracteres", "Corta1!Aa"],
    ["sin mayuscula", "sinmayuscula1!"],
    ["sin numero", "SinNumero!!Aa"],
    ["sin simbolo", "SinSimbolo12Aa"],
  ])("rechaza la contrasena %s (%s) con HTTP 400 y mensaje claro", async (_motivo, contrasena) => {
    const res = await request(app).post("/empresas").send(registro(contrasena));

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    // Un rechazo correcto no debe haber persistido el usuario.
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("acepta la contrasena valida de 12 caracteres (HTTP 201)", async () => {
    const res = await request(app).post("/empresas").send(registro("ValidaClave#2026"));

    expect(res.status).toBe(201);
  });
});
