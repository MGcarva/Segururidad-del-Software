// Anexo A - Integracion/API: contratos y documentos (CP-24 a CP-28, CP-31, CP-32).
const { api, auth, db, cerrarDb, registrarEmpresa, crearCliente, crearContrato, archivoSintetico, sha256, parseBinario, uid } = require("./helpers/api");

let admin;
let cliente;
const creados = [];

const recordar = (r) => {
  if (r.status === 201) creados.push(r.body.id);
  return r;
};

beforeAll(async () => {
  admin = await registrarEmpresa("ctr");
  cliente = await crearCliente(admin.token);
});

afterAll(async () => {
  for (const id of creados) await api().delete(`/contratos/${id}`).set(auth(admin.token));
  await cerrarDb();
});

const FORMATOS = [
  archivoSintetico("contrato.pdf", "application/pdf", 100 * 1024, Buffer.from("%PDF-1.4\n")),
  archivoSintetico("contrato.doc", "application/msword", 100 * 1024, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  archivoSintetico("contrato.ppt", "application/vnd.ms-powerpoint", 100 * 1024, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  archivoSintetico("contrato.jpg", "image/jpeg", 100 * 1024, Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
  archivoSintetico("contrato.png", "image/png", 100 * 1024, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
];

describe("CP-24 Crear contratos asociados a un cliente", () => {
  const titulos = [uid("Contrato A"), uid("Contrato B")];
  const respuestas = [];

  beforeAll(async () => {
    for (const titulo of titulos) respuestas.push(recordar(await crearContrato(admin.token, { cliente_id: cliente.id, titulo })));
  });

  it("ambos POST /contratos responden 201", () => {
    respuestas.forEach((r) => expect(r.status).toBe(201));
  });

  it("GET /contratos lista ambos contratos asociados al cliente", async () => {
    const r = await api().get("/contratos").set(auth(admin.token));
    expect(r.status).toBe(200);
    const mios = r.body.filter((c) => titulos.includes(c.titulo));
    expect(mios).toHaveLength(2);
    expect(mios.every((c) => c.cliente_nombre === cliente.nombre)).toBe(true);
  });
});

describe("CP-25 Contrato con fechas inconsistentes", () => {
  it("fecha_fin anterior a fecha_inicio: rechazo 4xx y no se persiste", async () => {
    const titulo = uid("FechasInvertidas");
    const r = recordar(await crearContrato(admin.token, { cliente_id: cliente.id, titulo, fecha_inicio: "2026-12-31", fecha_fin: "2026-01-01" }));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    const n = await db().query("SELECT count(*)::int AS n FROM contratos WHERE titulo=$1", [titulo]);
    expect(n.rows[0].n).toBe(0);
  });

  it("fecha invalida 2026-13-45: rechazo 4xx con mensaje claro (no 500)", async () => {
    const titulo = uid("FechaInvalida");
    const r = recordar(await crearContrato(admin.token, { cliente_id: cliente.id, titulo, fecha_inicio: "2026-13-45", fecha_fin: "2026-12-31" }));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    const n = await db().query("SELECT count(*)::int AS n FROM contratos WHERE titulo=$1", [titulo]);
    expect(n.rows[0].n).toBe(0);
  });
});

describe("CP-26 Adjuntar documento en los formatos permitidos", () => {
  test.each(FORMATOS.map((f) => [f.nombre, f]))("%s se almacena y se descarga integro (hash SHA-256)", async (_n, f) => {
    const c = recordar(await crearContrato(admin.token, { cliente_id: cliente.id, archivo: f }));
    expect(c.status).toBe(201);
    const d = await api().get(`/contratos/${c.body.id}/file`).set(auth(admin.token)).buffer(true).parse(parseBinario);
    expect(d.status).toBe(200);
    expect(Buffer.isBuffer(d.body)).toBe(true);
    expect(sha256(d.body)).toBe(f.sha256);
  });
});

describe("CP-27 Rechazo de formato no permitido y de archivo sobredimensionado", () => {
  it("archivo.exe es rechazado con 4xx", async () => {
    const f = archivoSintetico("archivo.exe", "application/x-msdownload", 10 * 1024, Buffer.from("MZ"));
    const r = recordar(await crearContrato(admin.token, { cliente_id: cliente.id, archivo: f }));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  it("script.sh es rechazado con 4xx", async () => {
    const f = archivoSintetico("script.sh", "application/x-sh", 1024, Buffer.from("#!/bin/sh\n"));
    const r = recordar(await crearContrato(admin.token, { cliente_id: cliente.id, archivo: f }));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  it("un PDF de 50 MB es rechazado con 4xx", async () => {
    const f = archivoSintetico("grande.pdf", "application/pdf", 50 * 1024 * 1024, Buffer.from("%PDF-1.4\n"));
    const r = recordar(await crearContrato(admin.token, { cliente_id: cliente.id, archivo: f }));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  it("no queda almacenado ningun documento de los archivos rechazados", async () => {
    const n = await db().query(
      `SELECT count(*)::int AS n FROM documentos_contrato d JOIN contratos c ON c.id = d.contract_id WHERE c.cliente_id=$1 AND octet_length(d.document) IN ($2, $3, $4)`,
      [cliente.id, 10 * 1024, 1024, 50 * 1024 * 1024]
    );
    expect(n.rows[0].n).toBe(0);
  });
});

describe("CP-28 Documento almacenado en storage interno y referenciado en BD", () => {
  let contrato;
  const pdf = FORMATOS[0];

  beforeAll(async () => {
    contrato = recordar(await crearContrato(admin.token, { cliente_id: cliente.id, archivo: pdf }));
  });

  it("documentos_contrato tiene una referencia al contrato con el contenido completo", async () => {
    expect(contrato.status).toBe(201);
    const r = await db().query("SELECT id, octet_length(document) AS bytes FROM documentos_contrato WHERE contract_id=$1", [contrato.body.id]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].bytes).toBe(pdf.buffer.length);
  });

  it("el almacenamiento es interno (columna bytea en la BD, sin servicio externo)", async () => {
    const r = await db().query("SELECT data_type FROM information_schema.columns WHERE table_name='documentos_contrato' AND column_name='document'");
    expect(r.rows[0].data_type).toBe("bytea");
  });
});

describe("CP-31 Generar enlace para compartir documento y su acceso", () => {
  it("existe un mecanismo de enlace compartible para el documento de un contrato", async () => {
    const c = recordar(await crearContrato(admin.token, { cliente_id: cliente.id, archivo: FORMATOS[0] }));
    expect(c.status).toBe(201);
    const rutas = ["enlace", "share", "compartir", "link"].map((s) => `/contratos/${c.body.id}/${s}`);
    const resultados = [];
    let ok = false;
    for (const ruta of rutas) {
      const r = await api().post(ruta).set(auth(admin.token)).send({});
      resultados.push(`POST ${ruta} -> ${r.status}`);
      if (r.status >= 200 && r.status < 300) ok = true;
    }
    if (!ok) throw new Error(`No existe un endpoint para generar enlaces compartibles: ${resultados.join("; ")}`);
  });
});

describe("CP-32 Un contrato pertenece a un unico cliente", () => {
  let c2;
  let contrato;

  beforeAll(async () => {
    c2 = await crearCliente(admin.token);
    contrato = recordar(await crearContrato(admin.token, { cliente_id: cliente.id }));
  });

  it("el modelo tiene una sola clave foranea cliente_id en contratos", async () => {
    const r = await db().query(
      `SELECT kcu.column_name FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
        WHERE tc.table_name='contratos' AND tc.constraint_type='FOREIGN KEY'`
    );
    expect(r.rows.map((x) => x.column_name)).toEqual(["cliente_id"]);
  });

  it("PUT /contratos/:id cambia el cliente y el contrato queda con exactamente uno", async () => {
    const r = await api().put(`/contratos/${contrato.body.id}`).set(auth(admin.token)).send({ cliente_id: c2.id });
    expect(r.status).toBe(200);
    const g = await api().get(`/contratos/${contrato.body.id}`).set(auth(admin.token));
    expect(g.body.cliente_id).toBe(c2.id);
  });

  it("no es posible asociar un segundo cliente al mismo contrato", async () => {
    await api().put(`/contratos/${contrato.body.id}`).set(auth(admin.token)).send({ cliente_id: [cliente.id, c2.id] });
    const g = await api().get(`/contratos/${contrato.body.id}`).set(auth(admin.token));
    expect(Array.isArray(g.body.cliente_id)).toBe(false);
    expect([c2.id, cliente.id].map(Number)).toContain(Number(g.body.cliente_id));
  });
});
