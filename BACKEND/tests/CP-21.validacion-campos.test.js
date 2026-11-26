// Anexo A - CP-21 [RF-4.3, ERS 3.1.2] Validacion de campos: particion de equivalencia
// y valores limite sobre RUT, correo, telefono y campos alfanumericos.
// Criterio de aceptacion: el servidor valida cada campo y no depende de la
// validacion de la interfaz (invalidos -> HTTP 400 con mensaje del campo).
const request = require("supertest");

jest.mock("../src/db", () => ({ pool: { query: jest.fn() } }));
const { pool } = require("../src/db");
const clientsRouter = require("../src/routes/clients");
const { montarRouter, tokenDePrueba } = require("./helpers/app");

const app = montarRouter("/clientes", clientsRouter);
const token = tokenDePrueba();

// DP-02 del Anexo A (cliente valido).
const clienteValido = {
  nombre: "Cliente Prueba Ltda",
  correo: "cliente1@test.cl",
  telefono: "+56 9 1234 5678",
  direccion: "Calle Falsa 456",
  es_empresa: true,
  rut: "12.345.678-5",
  nombre_representante: "Ana Pérez",
  correo_representante: "ana@test.cl",
  nombre_banco: "Banco de Prueba",
  numero_cuenta: "000123456789",
  titular_cuenta: "Cliente Prueba Ltda",
  metodo_pago: "transferencia",
  dia_pago: "5",
  moneda: "CLP",
};

const crear = (cambios) =>
  request(app).post("/clientes").set("Authorization", `Bearer ${token}`).send({ ...clienteValido, ...cambios });

describe("CP-21 Validacion de campos del cliente en el servidor", () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockResolvedValue({ rows: [{ id: 1, nombre: "Cliente Prueba Ltda" }] });
  });

  describe("valores validos (clase de equivalencia valida)", () => {
    test("datos DP-02 completos son aceptados (HTTP 201)", async () => {
      const res = await crear({});
      expect(res.status).toBe(201);
    });

    test("nombre de 255 caracteres (limite superior) es aceptado", async () => {
      const res = await crear({ nombre: "N".repeat(255) });
      expect(res.status).toBe(201);
    });
  });

  describe("valores invalidos y limites (clases de equivalencia invalidas)", () => {
    test.each([
      ["RUT con digito verificador incorrecto", { rut: "12.345.678-9" }],
      ["correo sin @", { correo: "cliente1.test.cl" }],
      ["telefono con letras", { telefono: "+56 9 ABCD EFGH" }],
      ["nombre vacio", { nombre: "" }],
      ["nombre de 256 caracteres (maximo + 1)", { nombre: "N".repeat(256) }],
    ])("rechaza %s con HTTP 400 y mensaje del campo", async (_caso, cambios) => {
      const res = await crear(cambios);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(pool.query).not.toHaveBeenCalled();
    });
  });
});
