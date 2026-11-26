// Anexo A - Integracion/API: contrato OpenAPI y validacion en servidor (CP-38, CP-39).
const openapi = require("../../src/openapi.json");
const { api, auth, cerrarDb, uid, registrarEmpresa, crearCliente, crearContrato, archivoSintetico, PASSWORD } = require("./helpers/api");

const NO_EXISTE = 999999999;
let T; // token de la empresa de prueba
let admin;

const call = (method, ruta, { token, body } = {}) => {
  let r = api()[method.toLowerCase()](ruta);
  if (token) r = r.set(auth(token));
  return body === undefined ? r : r.send(body);
};

// Recursos descartables: cada operacion destructiva o de modificacion usa uno propio.
const nuevoUsuario = async () => (await call("POST", "/usuarios", { body: { nombre_usuario: uid("u"), contrasena_hash: PASSWORD, correo: `${uid("m")}@qa.cl` } })).body;
const nuevaEmpresa = async () => (await call("POST", "/empresas", { token: T, body: { nombre: uid("Emp"), correo: `${uid("e")}@qa.cl` } })).body;
const nuevoRol = async () => (await call("POST", "/roles", { token: T, body: { nombre: uid("rol") } })).body;
const nuevoVinculo = async () => {
  const u = await nuevoUsuario();
  return (await call("POST", "/empresa-usuarios", { token: T, body: { usuario_id: u.id, rol_id: 2 } })).body;
};
const nuevoContrato = async () => (await crearContrato(T, { cliente_id: (await crearCliente(T)).id })).body;
const clienteBody = () => ({ nombre: uid("Cli"), correo: `${uid("c")}@test.cl`, telefono: "221234567", direccion: "Calle 1" });
const sinToken = (m, p) => () => call(m, p);

// Para cada operacion del OpenAPI: una solicitud valida (pos) y una invalida (neg).
const OPS = {
  "POST /autenticacion/login": { pos: () => call("POST", "/autenticacion/login", { body: { nombre_usuario: admin.nombre_usuario, password: PASSWORD } }), neg: () => call("POST", "/autenticacion/login", { body: {} }) },
  "GET /usuarios": { pos: () => call("GET", "/usuarios", { token: T }), neg: sinToken("GET", "/usuarios") },
  "POST /usuarios": { pos: () => call("POST", "/usuarios", { body: { nombre_usuario: uid("u"), contrasena_hash: PASSWORD, correo: `${uid("m")}@qa.cl` } }), neg: () => call("POST", "/usuarios", { body: {} }) },
  "GET /usuarios/{id}": { pos: async () => call("GET", `/usuarios/${(await nuevoUsuario()).id}`, { token: T }), neg: () => call("GET", `/usuarios/${NO_EXISTE}`, { token: T }) },
  "PUT /usuarios/{id}": { pos: async () => { const u = await nuevoUsuario(); return call("PUT", `/usuarios/${u.id}`, { token: T, body: { nombre_usuario: u.nombre_usuario, contrasena_hash: PASSWORD, correo: u.correo } }); }, neg: async () => call("PUT", `/usuarios/${(await nuevoUsuario()).id}`, { token: T, body: {} }) },
  "DELETE /usuarios/{id}": { pos: async () => call("DELETE", `/usuarios/${(await nuevoUsuario()).id}`, { token: T }), neg: () => call("DELETE", `/usuarios/${NO_EXISTE}`, { token: T }) },
  "GET /clientes": { pos: () => call("GET", "/clientes", { token: T }), neg: sinToken("GET", "/clientes") },
  "POST /clientes": { pos: () => call("POST", "/clientes", { token: T, body: clienteBody() }), neg: () => call("POST", "/clientes", { token: T, body: {} }) },
  "GET /clientes/search": { pos: () => call("GET", "/clientes/search?name=a", { token: T }), neg: sinToken("GET", "/clientes/search?name=a") },
  "GET /clientes/{id}": { pos: async () => call("GET", `/clientes/${(await crearCliente(T)).id}`, { token: T }), neg: () => call("GET", `/clientes/${NO_EXISTE}`, { token: T }) },
  "PUT /clientes/{id}": { pos: async () => call("PUT", `/clientes/${(await crearCliente(T)).id}`, { token: T, body: clienteBody() }), neg: async () => call("PUT", `/clientes/${(await crearCliente(T)).id}`, { token: T, body: {} }) },
  "DELETE /clientes/{id}": { pos: async () => call("DELETE", `/clientes/${(await crearCliente(T)).id}`, { token: T }), neg: () => call("DELETE", `/clientes/${NO_EXISTE}`, { token: T }) },
  "GET /contratos": { pos: () => call("GET", "/contratos", { token: T }), neg: sinToken("GET", "/contratos") },
  "POST /contratos": { pos: async () => crearContrato(T, { cliente_id: (await crearCliente(T)).id }), neg: () => call("POST", "/contratos", { token: T, body: {} }) },
  "GET /contratos/estados": { pos: () => call("GET", "/contratos/estados", { token: T }), neg: sinToken("GET", "/contratos/estados") },
  "GET /contratos/dashboard": { pos: () => call("GET", "/contratos/dashboard", { token: T }), neg: sinToken("GET", "/contratos/dashboard") },
  "GET /contratos/{id}": { pos: async () => call("GET", `/contratos/${(await nuevoContrato()).id}`, { token: T }), neg: () => call("GET", `/contratos/${NO_EXISTE}`, { token: T }) },
  "PUT /contratos/{id}": { pos: async () => call("PUT", `/contratos/${(await nuevoContrato()).id}`, { token: T, body: { titulo: uid("Editado") } }), neg: () => call("PUT", `/contratos/${NO_EXISTE}`, { token: T, body: { titulo: "x" } }) },
  "DELETE /contratos/{id}": { pos: async () => call("DELETE", `/contratos/${(await nuevoContrato()).id}`, { token: T }), neg: () => call("DELETE", `/contratos/${NO_EXISTE}`, { token: T }) },
  "GET /contratos/{id}/file": { pos: async () => { const f = archivoSintetico("a.pdf", "application/pdf", 2048, Buffer.from("%PDF-1.4\n")); const c = (await crearContrato(T, { cliente_id: (await crearCliente(T)).id, archivo: f })).body; return call("GET", `/contratos/${c.id}/file`, { token: T }); }, neg: () => call("GET", `/contratos/${NO_EXISTE}/file`, { token: T }) },
  "GET /auditoria": { pos: () => call("GET", "/auditoria", { token: T }), neg: sinToken("GET", "/auditoria") },
  "POST /auditoria": { pos: () => call("POST", "/auditoria", { token: T, body: { accion: "PRUEBA", detalles: "CP-38" } }), neg: () => call("POST", "/auditoria", { token: T, body: {} }) },
  "GET /empresas": { pos: () => call("GET", "/empresas", { token: T }), neg: sinToken("GET", "/empresas") },
  "POST /empresas": { pos: () => call("POST", "/empresas", { token: T, body: { nombre: uid("Emp"), correo: `${uid("e")}@qa.cl` } }), neg: () => call("POST", "/empresas", { body: {} }) },
  "GET /empresas/{id}": { pos: async () => call("GET", `/empresas/${(await nuevaEmpresa()).id}`, { token: T }), neg: () => call("GET", `/empresas/${NO_EXISTE}`, { token: T }) },
  "PUT /empresas/{id}": { pos: async () => call("PUT", `/empresas/${(await nuevaEmpresa()).id}`, { token: T, body: { nombre: uid("Emp"), correo: `${uid("e")}@qa.cl` } }), neg: async () => call("PUT", `/empresas/${(await nuevaEmpresa()).id}`, { token: T, body: {} }) },
  "DELETE /empresas/{id}": { pos: async () => call("DELETE", `/empresas/${(await nuevaEmpresa()).id}`, { token: T }), neg: () => call("DELETE", `/empresas/${NO_EXISTE}`, { token: T }) },
  "GET /roles": { pos: () => call("GET", "/roles", { token: T }), neg: sinToken("GET", "/roles") },
  "POST /roles": { pos: () => call("POST", "/roles", { token: T, body: { nombre: uid("rol") } }), neg: () => call("POST", "/roles", { token: T, body: {} }) },
  "GET /roles/{id}": { pos: async () => call("GET", `/roles/${(await nuevoRol()).id}`, { token: T }), neg: () => call("GET", `/roles/${NO_EXISTE}`, { token: T }) },
  "PUT /roles/{id}": { pos: async () => call("PUT", `/roles/${(await nuevoRol()).id}`, { token: T, body: { nombre: uid("rol") } }), neg: async () => call("PUT", `/roles/${(await nuevoRol()).id}`, { token: T, body: {} }) },
  "DELETE /roles/{id}": { pos: async () => call("DELETE", `/roles/${(await nuevoRol()).id}`, { token: T }), neg: () => call("DELETE", `/roles/${NO_EXISTE}`, { token: T }) },
  "GET /empresa-usuarios": { pos: () => call("GET", "/empresa-usuarios", { token: T }), neg: sinToken("GET", "/empresa-usuarios") },
  "POST /empresa-usuarios": { pos: async () => call("POST", "/empresa-usuarios", { token: T, body: { usuario_id: (await nuevoUsuario()).id, rol_id: 2 } }), neg: () => call("POST", "/empresa-usuarios", { token: T, body: {} }) },
  "GET /empresa-usuarios/{id}": { pos: async () => call("GET", `/empresa-usuarios/${(await nuevoVinculo()).id}`, { token: T }), neg: () => call("GET", `/empresa-usuarios/${NO_EXISTE}`, { token: T }) },
  "PUT /empresa-usuarios/{id}": { pos: async () => { const v = await nuevoVinculo(); return call("PUT", `/empresa-usuarios/${v.id}`, { token: T, body: { empresa_id: v.empresa_id, usuario_id: v.usuario_id, rol_id: 1 } }); }, neg: async () => call("PUT", `/empresa-usuarios/${(await nuevoVinculo()).id}`, { token: T, body: {} }) },
  "DELETE /empresa-usuarios/{id}": { pos: async () => call("DELETE", `/empresa-usuarios/${(await nuevoVinculo()).id}`, { token: T }), neg: () => call("DELETE", `/empresa-usuarios/${NO_EXISTE}`, { token: T }) },
  "GET /metricas": { pos: () => call("GET", "/metricas", { token: T }), neg: sinToken("GET", "/metricas") },
};

const operaciones = Object.entries(openapi.paths).flatMap(([ruta, metodos]) =>
  Object.entries(metodos).map(([metodo, def]) => ({
    clave: `${metodo.toUpperCase()} ${ruta}`,
    exito: Number(Object.keys(def.responses || { 200: {} }).find((c) => c.startsWith("2"))),
  }))
);

beforeAll(async () => {
  admin = await registrarEmpresa("oas");
  T = admin.token;
});
afterAll(cerrarDb);

describe("CP-38 Coleccion base de endpoints segun OpenAPI", () => {
  it("la coleccion cubre el 100 % de las operaciones de openapi.json", () => {
    const sinCaso = operaciones.map((o) => o.clave).filter((c) => !OPS[c]);
    expect(sinCaso).toEqual([]);
  });

  test.each(operaciones.map((o) => [o.clave, o.exito]))("%s: solicitud valida responde %i y la invalida responde 4xx", async (clave, exito) => {
    const op = OPS[clave];
    const pos = await op.pos();
    const neg = await op.neg();
    const hallazgos = [];
    if (pos.status !== exito) hallazgos.push(`valida: esperado ${exito}, obtenido ${pos.status}`);
    if (neg.status < 400 || neg.status >= 500) hallazgos.push(`invalida: esperado 4xx, obtenido ${neg.status}`);
    expect(hallazgos).toEqual([]);
  });
});

describe("CP-39 Validacion en servidor de todos los endpoints", () => {
  const ESCRITURA = [
    ["POST", "/autenticacion/login", null],
    ["POST", "/usuarios", null],
    ["PUT", "/usuarios/{id}", nuevoUsuario],
    ["POST", "/clientes", null],
    ["PUT", "/clientes/{id}", () => crearCliente(T)],
    ["POST", "/contratos", null],
    ["PUT", "/contratos/{id}", nuevoContrato],
    ["POST", "/auditoria", null],
    ["POST", "/empresas", null],
    ["PUT", "/empresas/{id}", nuevaEmpresa],
    ["POST", "/roles", null],
    ["PUT", "/roles/{id}", nuevoRol],
    ["POST", "/empresa-usuarios", null],
    ["PUT", "/empresa-usuarios/{id}", nuevoVinculo],
  ];
  const ENTRADAS = { "cuerpo vacio": {}, "tipo erroneo": { nombre: 123, correo: 123, titulo: 123, accion: 123 }, "campo desconocido": { campo_desconocido: "x" } };

  test.each(ESCRITURA.map(([m, r, f]) => [`${m} ${r}`, m, r, f]))("%s rechaza entradas invalidas con 4xx y nunca con 5xx", async (_c, metodo, ruta, fabrica) => {
    const hallazgos = [];
    for (const [nombre, body] of Object.entries(ENTRADAS)) {
      const recurso = fabrica ? await fabrica() : null;
      const url = ruta.replace("{id}", recurso ? recurso.id : "");
      const r = await call(metodo, url, { token: T, body });
      if (r.status < 400 || r.status >= 500) hallazgos.push(`${nombre}: ${r.status}`);
    }
    expect(hallazgos).toEqual([]);
  });
});
