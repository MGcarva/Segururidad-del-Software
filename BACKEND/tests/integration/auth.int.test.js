// Anexo A - Integracion/API: autenticacion (CP-01, CP-02, CP-05).
const { api, auth, cerrarDb, registrarEmpresa, decodificar, auditoriaDe, PASSWORD, uid } = require("./helpers/api");

let admin;

beforeAll(async () => {
  admin = await registrarEmpresa("auth");
});
afterAll(cerrarDb);

describe("CP-01 Login valido de administrador", () => {
  let res;
  beforeAll(async () => {
    res = await api().post("/autenticacion/login").send({ nombre_usuario: admin.nombre_usuario, password: PASSWORD });
  });

  it("responde 200 con un token JWT", () => {
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.split(".")).toHaveLength(3);
  });

  it("el token incluye usuarioId, empresaId y fecha de expiracion", () => {
    const claims = decodificar(res.body.token);
    expect(claims.usuarioId).toBe(admin.usuarioId);
    expect(claims.empresaId).toBe(admin.empresaId);
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("el token permite GET /clientes con 200", async () => {
    const r = await api().get("/clientes").set(auth(res.body.token));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it("la accion de login queda registrada en auditoria", async () => {
    const registros = await auditoriaDe(admin.nombre_usuario);
    expect(registros.some((a) => /LOGIN/i.test(a.accion))).toBe(true);
  });
});

describe("CP-02 Login con credenciales invalidas", () => {
  it("clave erronea y usuario inexistente: 401, sin token y con el mismo mensaje", async () => {
    const claveMala = await api().post("/autenticacion/login").send({ nombre_usuario: admin.nombre_usuario, password: "ClaveErronea#1" });
    const noExiste = await api().post("/autenticacion/login").send({ nombre_usuario: uid("no_existe"), password: PASSWORD });
    expect(claveMala.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(claveMala.body.token).toBeUndefined();
    expect(noExiste.body.token).toBeUndefined();
    expect(claveMala.body).toEqual(noExiste.body);
  });

  it("cuerpo vacio: 400 o 401, sin token y sin error 500", async () => {
    const r = await api().post("/autenticacion/login").send({});
    expect([400, 401]).toContain(r.status);
    expect(r.body.token).toBeUndefined();
  });
});

describe("CP-05 Cierre de sesion y revocacion del token", () => {
  it("existe un endpoint de logout que responde 2xx", async () => {
    const candidatos = ["/autenticacion/logout", "/autenticacion/cerrar-sesion"];
    const respuestas = [];
    for (const ruta of candidatos) {
      const r = await api().post(ruta).set(auth(admin.token));
      respuestas.push(`${ruta} -> ${r.status}`);
      if (r.status >= 200 && r.status < 300) return;
    }
    throw new Error(`No existe un endpoint de logout: ${respuestas.join("; ")}`);
  });

  it("tras el logout el mismo token es rechazado con 401", async () => {
    const r = await api().get("/clientes").set(auth(admin.token));
    expect(r.status).toBe(401);
  });
});
