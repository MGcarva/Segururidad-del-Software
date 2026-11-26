// Anexo A - CP-29 [RF-5.4] Estado del contrato en fechas limite
// Criterio de aceptacion: el estado coincide con la regla del ERS en cada limite.
//   fecha_fin = hoy-1  -> vencido (expirado)
//   fecha_fin = hoy    -> por_vencer
//   fecha_fin = hoy+30 -> por_vencer
//   fecha_fin = hoy+31 -> activo (no aparece en /contratos/estados)
//   inicio futuro      -> no aparece como por_vencer ni vencido
const request = require("supertest");

jest.mock("../src/db", () => ({ pool: { query: jest.fn() } }));
const { pool } = require("../src/db");
const contractsRouter = require("../src/routes/contracts");
const { montarRouter, tokenDePrueba } = require("./helpers/app");

const app = montarRouter("/contratos", contractsRouter);
const token = tokenDePrueba();

const HOY = "2026-06-15";
const contratos = [
  { id: 1, titulo: "fin hoy-1", fecha_inicio: "2026-01-01", fecha_fin: "2026-06-14" },
  { id: 2, titulo: "fin hoy", fecha_inicio: "2026-01-01", fecha_fin: "2026-06-15" },
  { id: 3, titulo: "fin hoy+30", fecha_inicio: "2026-01-01", fecha_fin: "2026-07-15" },
  { id: 4, titulo: "fin hoy+31", fecha_inicio: "2026-01-01", fecha_fin: "2026-07-16" },
  { id: 5, titulo: "inicio futuro", fecha_inicio: "2026-09-01", fecha_fin: "2026-12-31" },
];

// BD simulada: aplica en memoria el predicado SQL que el handler envia, de modo
// que se prueba la regla real del codigo (la clasificacion vive en la consulta).
function bdSimulada(sql, params) {
  const q = sql.replace(/\s+/g, " ");
  if (/c\.fecha_fin >= \$2 AND c\.fecha_fin <= \$3/.test(q)) {
    return { rows: contratos.filter((c) => c.fecha_fin >= params[1] && c.fecha_fin <= params[2]) };
  }
  if (/c\.fecha_fin < \$2/.test(q)) {
    return { rows: contratos.filter((c) => c.fecha_fin < params[1]) };
  }
  return { rows: [] };
}

describe("CP-29 Estado del contrato en fechas limite (hoy = 2026-06-15)", () => {
  beforeAll(() => {
    // Solo se falsea Date: el resto de timers reales evita colgar Supertest.
    jest.useFakeTimers({
      now: new Date(`${HOY}T12:00:00Z`),
      doNotFake: [
        "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
        "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback",
        "setImmediate", "clearImmediate", "setInterval", "clearInterval",
        "setTimeout", "clearTimeout",
      ],
    });
  });

  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockImplementation(async (sql, params) => bdSimulada(sql, params));
  });

  async function estadoDe(titulo) {
    const res = await request(app).get("/contratos/estados").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.find((c) => c.titulo === titulo)?.estado ?? "activo";
  }

  test("la consulta usa hoy y hoy+30 como limites de la ventana", async () => {
    await request(app).get("/contratos/estados").set("Authorization", `Bearer ${token}`);
    const [, paramsPorVencer] = pool.query.mock.calls[0];
    expect(paramsPorVencer.slice(1)).toEqual([HOY, "2026-07-15"]);
  });

  test("fecha_fin = hoy-1 -> vencido", async () => {
    expect(await estadoDe("fin hoy-1")).toBe("vencido");
  });

  test("fecha_fin = hoy -> por_vencer", async () => {
    expect(await estadoDe("fin hoy")).toBe("por_vencer");
  });

  test("fecha_fin = hoy+30 -> por_vencer", async () => {
    expect(await estadoDe("fin hoy+30")).toBe("por_vencer");
  });

  test("fecha_fin = hoy+31 -> activo (fuera de la ventana)", async () => {
    expect(await estadoDe("fin hoy+31")).toBe("activo");
  });

  test("contrato con inicio futuro no se reporta como por_vencer ni vencido", async () => {
    expect(await estadoDe("inicio futuro")).toBe("activo");
  });
});
