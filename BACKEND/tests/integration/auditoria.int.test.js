// Anexo A - Integracion/API: auditoria (CP-35, CP-36).
const { api, auth, cerrarDb, registrarEmpresa, clienteValido, crearCliente, crearContrato, archivoSintetico, parseBinario, uid, PASSWORD, auditoriaDe } = require("./helpers/api");

let admin;

beforeAll(async () => {
  admin = await registrarEmpresa("aud");
});
afterAll(cerrarDb);

const buscar = (registros, ...fragmentos) => registros.filter((a) => fragmentos.every((f) => a.accion.includes(f)));

describe("CP-35 Auditoria de operaciones sobre clientes", () => {
  let id;
  let nombre;

  beforeAll(async () => {
    const datos = clienteValido();
    nombre = datos.nombre;
    const c = await api().post("/clientes").set(auth(admin.token)).send(datos);
    id = c.body.id;
    await api().put(`/clientes/${id}`).set(auth(admin.token)).send({ ...datos, telefono: "+56 9 8765 4321" });
    await api().delete(`/clientes/${id}`).set(auth(admin.token));
  });

  it("existe un registro de creacion con usuario y fecha_hora", async () => {
    const r = buscar(await auditoriaDe(admin.nombre_usuario), "CLIENTES_CREAR", nombre);
    expect(r).toHaveLength(1);
    expect(r[0].fecha_hora).toBeTruthy();
  });

  it("existe un registro de edicion con usuario y fecha_hora", async () => {
    const r = buscar(await auditoriaDe(admin.nombre_usuario), "CLIENTES_ACTUALIZAR", `ID ${id}`);
    expect(r).toHaveLength(1);
    expect(r[0].fecha_hora).toBeTruthy();
  });

  it("existe un registro de eliminacion con usuario y fecha_hora", async () => {
    const r = buscar(await auditoriaDe(admin.nombre_usuario), "CLIENTES_ELIMINAR", `ID ${id}`);
    expect(r).toHaveLength(1);
    expect(r[0].fecha_hora).toBeTruthy();
  });
});

describe("CP-36 Auditoria de contratos, usuarios y documentos", () => {
  let contratoId;
  let usuarioId;
  let registros;

  beforeAll(async () => {
    const cliente = await crearCliente(admin.token);
    const pdf = archivoSintetico("doc.pdf", "application/pdf", 20 * 1024, Buffer.from("%PDF-1.4\n"));
    const c = await crearContrato(admin.token, { cliente_id: cliente.id, titulo: uid("AudCtr"), archivo: pdf });
    contratoId = c.body.id;
    await api().put(`/contratos/${contratoId}`).set(auth(admin.token)).send({ titulo: "Titulo editado" });
    await api().get(`/contratos/${contratoId}/file`).set(auth(admin.token)).buffer(true).parse(parseBinario);
    await api().delete(`/contratos/${contratoId}`).set(auth(admin.token));

    const nombre = uid("aud_usr");
    const u = await api().post("/usuarios").set(auth(admin.token)).send({ nombre_usuario: nombre, contrasena_hash: PASSWORD, correo: `${nombre}@qa.cl` });
    usuarioId = u.body.id;
    await api().put(`/usuarios/${usuarioId}`).set(auth(admin.token)).send({ nombre_usuario: nombre, contrasena_hash: PASSWORD, correo: `${nombre}_m@qa.cl` });
    registros = await auditoriaDe(admin.nombre_usuario);
  });

  it("registra la creacion, edicion y eliminacion del contrato", () => {
    expect(buscar(registros, "CONTRATOS_CREAR")).toHaveLength(1);
    expect(buscar(registros, "CONTRATOS_ACTUALIZAR", `ID ${contratoId}`)).toHaveLength(1);
    expect(buscar(registros, "CONTRATOS_ELIMINAR", `ID ${contratoId}`)).toHaveLength(1);
  });

  it("registra la creacion del usuario", () => {
    expect(buscar(registros, "USUARIOS_CREAR")).toHaveLength(1);
  });

  it("registra la modificacion del usuario", () => {
    expect(buscar(registros, "USUARIOS_ACTUALIZAR", `ID ${usuarioId}`)).toHaveLength(1);
  });

  it("registra la subida del documento", () => {
    expect(registros.some((a) => /documento|archivo|DOCUMENTOS?_/i.test(a.accion) && /subi|carg|CREAR|SUBIR/i.test(a.accion))).toBe(true);
  });

  it("registra la descarga del documento", () => {
    expect(registros.some((a) => /DESCARG/i.test(a.accion))).toBe(true);
  });
});
