// Anexo A - Integracion/API: clientes (CP-16, CP-18, CP-19, CP-23).
const { api, auth, cerrarDb, registrarEmpresa, clienteValido, crearCliente, uid, filtraMotor } = require("./helpers/api");

let admin;

beforeAll(async () => {
  admin = await registrarEmpresa("cli");
});
afterAll(cerrarDb);

describe("CP-16 Crear cliente con datos validos", () => {
  const datos = clienteValido({
    nombre_fantasia: "Fantasia SpA",
    giro_actividad_economica: "Servicios",
    nombre_representante: "Rep Prueba",
    correo_representante: "rep@test.cl",
    direccion_ciudad: "Santiago",
    metodo_pago: "transferencia",
    moneda: "CLP",
  });
  let creado;

  it("POST /clientes responde 201 con el cliente asociado a la empresa del token", async () => {
    const r = await api().post("/clientes").set(auth(admin.token)).send(datos);
    expect(r.status).toBe(201);
    expect(r.body.empresa_id).toBe(admin.empresaId);
    expect(r.body.nombre).toBe(datos.nombre);
    creado = r.body;
  });

  it("GET /clientes/:id devuelve el cliente persistido y aparece en el listado", async () => {
    const uno = await api().get(`/clientes/${creado.id}`).set(auth(admin.token));
    expect(uno.status).toBe(200);
    expect(uno.body.correo).toBe(datos.correo);
    expect(uno.body.empresa_id).toBe(admin.empresaId);
    const lista = await api().get("/clientes").set(auth(admin.token));
    expect(lista.body.some((c) => c.id === creado.id)).toBe(true);
  });
});

describe("CP-18 Listar clientes con paginacion y filtro por nombre", () => {
  beforeAll(async () => {
    for (let i = 1; i <= 25; i++) {
      await crearCliente(admin.token, { nombre: `Prueba Paginacion ${String(i).padStart(2, "0")}` });
    }
    await crearCliente(admin.token, { nombre: "Otro Nombre Distinto" });
  });

  it("la primera pagina respeta el tamano solicitado (page=1&limit=10)", async () => {
    const r = await api().get("/clientes").query({ page: 1, limit: 10 }).set(auth(admin.token));
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(10);
  });

  it("la pagina siguiente no repite registros de la primera", async () => {
    const p1 = await api().get("/clientes").query({ page: 1, limit: 10 }).set(auth(admin.token));
    const p2 = await api().get("/clientes").query({ page: 2, limit: 10 }).set(auth(admin.token));
    const ids1 = new Set(p1.body.map((c) => c.id));
    expect(p2.body.length).toBeGreaterThan(0);
    expect(p2.body.every((c) => !ids1.has(c.id))).toBe(true);
  });

  it("GET /clientes/search?name=Prueba devuelve solo coincidencias de la empresa", async () => {
    const r = await api().get("/clientes/search").query({ name: "Prueba" }).set(auth(admin.token));
    expect(r.status).toBe(200);
    expect(r.body.every((c) => /prueba/i.test(c.nombre) && c.empresa_id === admin.empresaId)).toBe(true);
    expect(r.body.filter((c) => c.nombre.startsWith("Prueba Paginacion"))).toHaveLength(25);
    expect(r.body.some((c) => c.nombre === "Otro Nombre Distinto")).toBe(false);
  });
});

describe("CP-19 Editar cliente", () => {
  let original;
  let editado;

  beforeAll(async () => {
    original = await crearCliente(admin.token, { nombre_fantasia: "Fantasia Original", giro_actividad_economica: "Comercio" });
    const cuerpo = { ...original, telefono: "+56 9 1234 5678", direccion: "Nueva Direccion 456" };
    ["id", "empresa_id", "created_at"].forEach((k) => delete cuerpo[k]);
    editado = await api().put(`/clientes/${original.id}`).set(auth(admin.token)).send(cuerpo);
  });

  it("PUT /clientes/:id responde 200", () => {
    expect(editado.status).toBe(200);
  });

  it("GET /clientes/:id refleja telefono y direccion y no altera el resto de los campos", async () => {
    const r = await api().get(`/clientes/${original.id}`).set(auth(admin.token));
    expect(r.body.telefono).toBe("+56 9 1234 5678");
    expect(r.body.direccion).toBe("Nueva Direccion 456");
    expect(r.body.nombre).toBe(original.nombre);
    expect(r.body.correo).toBe(original.correo);
    expect(r.body.rut).toBe(original.rut);
    expect(r.body.nombre_fantasia).toBe("Fantasia Original");
    expect(r.body.giro_actividad_economica).toBe("Comercio");
  });
});

describe("CP-23 Unicidad de correo en clientes", () => {
  it("un segundo cliente con el mismo correo recibe 4xx sin mensaje del motor y no se duplica", async () => {
    const correo = `${uid("c1")}@test.cl`;
    await crearCliente(admin.token, { correo });
    const r = await api().post("/clientes").set(auth(admin.token)).send(clienteValido({ correo }));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect(filtraMotor(r.body)).toBe(false);
    const lista = await api().get("/clientes").set(auth(admin.token));
    expect(lista.body.filter((c) => c.correo === correo)).toHaveLength(1);
  });
});
