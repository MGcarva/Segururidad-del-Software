// Anexo A - Integracion/API: registro, empresas y usuarios (CP-08, CP-10, CP-11, CP-12, CP-14).
const { api, auth, db, cerrarDb, uid, registrarEmpresa, login, auditoriaDe, filtraMotor, PASSWORD } = require("./helpers/api");

let admin;

beforeAll(async () => {
  admin = await registrarEmpresa("usr");
});
afterAll(cerrarDb);

describe("CP-08 Creacion de empresa con usuario por API", () => {
  const nombre_usuario = uid("cp08");
  let res;

  beforeAll(async () => {
    res = await api()
      .post("/empresas")
      .send({
        usuario: { nombre_usuario, contrasena_hash: PASSWORD, correo: `${nombre_usuario}@qa.cl` },
        empresa: { nombre: `Empresa ${nombre_usuario}`, direccion: "Calle 1", telefono: "221234567", correo: `emp_${nombre_usuario}@qa.cl` },
      });
  });

  it("responde 201 con usuario y empresa", () => {
    expect(res.status).toBe(201);
    expect(res.body.usuario).toBeDefined();
    expect(res.body.empresa).toBeDefined();
  });

  it("ambos registros existen en BD con created_at", async () => {
    const u = await db().query("SELECT created_at FROM usuarios WHERE nombre_usuario=$1", [nombre_usuario]);
    const e = await db().query("SELECT created_at FROM empresas WHERE id=$1", [res.body.empresa.id]);
    expect(u.rows).toHaveLength(1);
    expect(u.rows[0].created_at).not.toBeNull();
    expect(e.rows).toHaveLength(1);
    expect(e.rows[0].created_at).not.toBeNull();
  });

  it("la respuesta no devuelve la contrasena", () => {
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    expect(res.body.usuario.contrasena_hash).toBeUndefined();
  });
});

describe("CP-10 Correo duplicado en registro", () => {
  const base = uid("cp10");
  const correo = `${base}@dup.cl`;
  const correoEmpresa = `emp_${base}@dup.cl`;

  beforeAll(async () => {
    const r = await api()
      .post("/empresas")
      .send({
        usuario: { nombre_usuario: base, contrasena_hash: PASSWORD, correo },
        empresa: { nombre: `Empresa ${base}`, correo: correoEmpresa },
      });
    expect(r.status).toBe(201);
  });

  it("usuario con correo ya registrado: rechazo 4xx controlado, sin mensaje del motor", async () => {
    const r = await api()
      .post("/empresas")
      .send({
        usuario: { nombre_usuario: `${base}_2`, contrasena_hash: PASSWORD, correo },
        empresa: { nombre: `Otra ${base}`, correo: `otra_${base}@dup.cl` },
      });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect(filtraMotor(r.body)).toBe(false);
    const n = await db().query("SELECT count(*)::int AS n FROM usuarios WHERE correo=$1", [correo]);
    expect(n.rows[0].n).toBe(1);
  });

  it("empresa con correo ya registrado: rechazo 4xx controlado, sin mensaje del motor", async () => {
    const r = await api()
      .post("/empresas")
      .send({
        usuario: { nombre_usuario: `${base}_3`, contrasena_hash: PASSWORD, correo: `${base}_3@dup.cl` },
        empresa: { nombre: `Otra ${base}`, correo: correoEmpresa },
      });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect(filtraMotor(r.body)).toBe(false);
    const n = await db().query("SELECT count(*)::int AS n FROM empresas WHERE correo=$1", [correoEmpresa]);
    expect(n.rows[0].n).toBe(1);
  });
});

describe("CP-11 Primer usuario de la empresa es administrador", () => {
  it("GET /empresa-usuarios muestra al usuario con rol_id 1 (administrador)", async () => {
    const r = await api().get("/empresa-usuarios").set(auth(admin.token));
    expect(r.status).toBe(200);
    const yo = r.body.find((u) => u.id === admin.usuarioId);
    expect(yo).toBeDefined();
    expect(Number(yo.rol_id)).toBe(1);
    expect(String(yo.rol_nombre).toLowerCase()).toBe("administrador");
  });
});

describe("CP-12 Administrador crea usuario con rol editor", () => {
  const nombre = uid("editor_nuevo");
  let res;

  beforeAll(async () => {
    res = await api()
      .post("/empresa-usuarios")
      .set(auth(admin.token))
      .send({ nombre_usuario: nombre, contrasena_hash: PASSWORD, correo: `${nombre}@qa.cl`, rol_id: 2 });
  });

  it("responde 201 y vincula el usuario a la empresa con rol 2", () => {
    expect(res.status).toBe(201);
    expect(res.body.empresa_id).toBe(admin.empresaId);
    expect(Number(res.body.rol_id)).toBe(2);
  });

  it("el usuario es visible en el listado de la empresa con rol editor", async () => {
    const r = await api().get("/empresa-usuarios").set(auth(admin.token));
    const u = r.body.find((x) => x.nombre_usuario === nombre);
    expect(u).toBeDefined();
    expect(Number(u.rol_id)).toBe(2);
    expect(String(u.rol_nombre).toLowerCase()).toBe("editor");
  });
});

describe("CP-14 Administrador modifica y elimina usuarios de la empresa", () => {
  const nombre = uid("editor_mod");
  let usuarioId;
  let vinculoId;

  beforeAll(async () => {
    const r = await api()
      .post("/empresa-usuarios")
      .set(auth(admin.token))
      .send({ nombre_usuario: nombre, contrasena_hash: PASSWORD, correo: `${nombre}@qa.cl`, rol_id: 2 });
    expect(r.status).toBe(201);
    vinculoId = r.body.id;
    usuarioId = r.body.usuario_id;
  });

  it("PUT /usuarios/:id cambia el correo y el cambio se refleja", async () => {
    const nuevo = `${nombre}_nuevo@qa.cl`;
    const r = await api().put(`/usuarios/${usuarioId}`).set(auth(admin.token)).send({ nombre_usuario: nombre, contrasena_hash: PASSWORD, correo: nuevo });
    expect(r.status).toBe(200);
    const lista = await api().get("/empresa-usuarios").set(auth(admin.token));
    expect(lista.body.find((u) => u.id === usuarioId).correo).toBe(nuevo);
  });

  it("DELETE /empresa-usuarios/:id elimina al usuario de la empresa", async () => {
    const r = await api().delete(`/empresa-usuarios/${vinculoId}`).set(auth(admin.token));
    expect(r.status).toBe(200);
    const lista = await api().get("/empresa-usuarios").set(auth(admin.token));
    expect(lista.body.some((u) => u.id === usuarioId)).toBe(false);
  });

  it("las operaciones quedan en auditoria con el usuario correcto", async () => {
    const registros = await auditoriaDe(admin.nombre_usuario);
    expect(registros.some((a) => a.accion.includes(`USUARIOS_ACTUALIZAR`) && a.accion.includes(`ID ${usuarioId}`))).toBe(true);
    expect(registros.some((a) => a.accion.includes("EMPRESA_USUARIOS_ELIMINAR") && a.accion.includes(`ID ${vinculoId}`))).toBe(true);
  });

  it("el usuario eliminado no puede operar en la empresa (401 en /clientes)", async () => {
    const token = await login(nombre);
    const r = await api().get("/clientes").set(auth(token));
    expect(r.status).toBe(401);
  });
});
