// Suite automatizada de pruebas funcionales y de seguridad (caja gris) sobre la
// API de Atlas. Se ejecuta contra el sistema levantado con Docker:
//
//   node --test --test-reporter=spec ev3/automatizacion/api/
//   API_URL=http://localhost:4450 node --test ...
//
// Cada caso se identifica con un ID (FUN-xx funcional, SEC-xx seguridad), la
// categoria OWASP Top 10 2021 que verifica y la obligacion normativa asociada.
// Los datos de prueba se crean en cada ejecucion (dos empresas aisladas A y B)
// para que la suite sea repetible e independiente del estado previo de la BD.

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

const API = process.env.API_URL || "http://localhost:4450";
const RUN = Date.now().toString(36);
const PASS = "Atlas#Prueba2026";

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function registrarEmpresa(sufijo) {
  const nombre_usuario = `qa_${sufijo}_${RUN}`;
  const r = await call("POST", "/empresas", {
    body: {
      usuario: { nombre_usuario, contrasena_hash: PASS, correo: `${nombre_usuario}@qa.cl` },
      empresa: { nombre: `Empresa QA ${sufijo} ${RUN}`, correo: `empresa_${sufijo}_${RUN}@qa.cl`, telefono: "221234567" },
    },
  });
  assert.equal(r.status, 201, `registro empresa ${sufijo}: ${JSON.stringify(r.data)}`);
  const login = await call("POST", "/autenticacion/login", { body: { nombre_usuario, password: PASS } });
  assert.equal(login.status, 200);
  return { nombre_usuario, token: login.data.token, usuarioId: r.data.usuario.id, empresaId: r.data.empresa.id };
}

const ctx = {};

before(async () => {
  ctx.A = await registrarEmpresa("A");
  ctx.B = await registrarEmpresa("B");

  // Cliente perteneciente a la empresa B (objetivo de los intentos IDOR)
  const cli = await call("POST", "/clientes", {
    token: ctx.B.token,
    body: { nombre: "Cliente Privado B", correo: `cliente_b_${RUN}@qa.cl`, telefono: "987654321", direccion: "Santiago" },
  });
  assert.equal(cli.status, 201);
  ctx.clienteB = cli.data.id;

  // Usuario adicional de la empresa B (objetivo de modificacion / borrado cruzado)
  const eu = await call("POST", "/empresa-usuarios", {
    token: ctx.B.token,
    body: { rol_id: 2, nombre_usuario: `qa_Bvictima_${RUN}`, contrasena_hash: PASS, correo: `victima_${RUN}@qa.cl` },
  });
  assert.equal(eu.status, 201);
  ctx.usuarioVictimaB = eu.data.usuario_id;

  // Editor de la empresa A (para pruebas de autorizacion por rol)
  const ed = await call("POST", "/empresa-usuarios", {
    token: ctx.A.token,
    body: { rol_id: 2, nombre_usuario: `qa_Aeditor_${RUN}`, contrasena_hash: PASS, correo: `editor_${RUN}@qa.cl` },
  });
  assert.equal(ed.status, 201);
  const edLogin = await call("POST", "/autenticacion/login", { body: { nombre_usuario: `qa_Aeditor_${RUN}`, password: PASS } });
  ctx.editorA = edLogin.data.token;
});

describe("Pruebas funcionales (regresion de requerimientos)", () => {
  test("FUN-01 [RF-1.1] Login con credenciales validas entrega un JWT", async () => {
    const r = await call("POST", "/autenticacion/login", { body: { nombre_usuario: ctx.A.nombre_usuario, password: PASS } });
    assert.equal(r.status, 200);
    assert.match(r.data.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  test("FUN-02 [RF-3.1] Administrador crea un cliente en su empresa", async () => {
    const r = await call("POST", "/clientes", {
      token: ctx.A.token,
      body: { nombre: "Cliente A1", correo: `cliente_a_${RUN}@qa.cl`, telefono: "912345678", direccion: "Valparaiso" },
    });
    assert.equal(r.status, 201);
    ctx.clienteA = r.data.id;
  });

  test("FUN-03 [RF-3.2] El listado de clientes solo contiene clientes propios", async () => {
    const r = await call("GET", "/clientes", { token: ctx.A.token });
    assert.equal(r.status, 200);
    assert.ok(r.data.length >= 1);
    assert.ok(r.data.every((c) => c.id !== ctx.clienteB), "aparece un cliente de otra empresa");
  });

  test("FUN-04 [RF-4.1] Administrador crea un contrato para su propio cliente", async () => {
    const r = await call("POST", "/contratos", {
      token: ctx.A.token,
      body: { cliente_id: ctx.clienteA, titulo: "Contrato QA", fecha_inicio: "2026-01-01", fecha_fin: "2026-12-31" },
    });
    assert.equal(r.status, 201);
  });

  test("FUN-05 [RF-6.1] Dashboard entrega metricas numericas de la empresa", async () => {
    const r = await call("GET", "/contratos/dashboard", { token: ctx.A.token });
    assert.equal(r.status, 200);
    for (const k of ["totalUsuarios", "totalClientes", "contratosVencen30Dias"]) assert.equal(typeof r.data[k], "number");
  });

  test("FUN-06 [RF-5.1] Las acciones quedan registradas en auditoria", async () => {
    const r = await call("GET", "/auditoria", { token: ctx.A.token });
    assert.equal(r.status, 200);
    assert.ok(r.data.some((l) => l.usuario_id === ctx.A.nombre_usuario && /CLIENTES_CREAR/.test(l.accion)));
  });
});

describe("Pruebas de seguridad - Autenticacion (OWASP A07)", () => {
  test("SEC-01 Credenciales invalidas devuelven 401 con mensaje generico", async () => {
    const r = await call("POST", "/autenticacion/login", { body: { nombre_usuario: ctx.A.nombre_usuario, password: "incorrecta" } });
    assert.equal(r.status, 401);
    assert.equal(r.data.error, "Credenciales inválidas");
  });

  test("SEC-02 Inyeccion SQL en el login no permite el acceso (OWASP A03)", async () => {
    for (const payload of ["' OR '1'='1", "admin'--", "' OR 1=1;--"]) {
      const r = await call("POST", "/autenticacion/login", { body: { nombre_usuario: payload, password: payload } });
      assert.equal(r.status, 401, `payload ${payload}`);
    }
  });

  test("SEC-03 Endpoints protegidos rechazan peticiones sin token", async () => {
    for (const p of ["/clientes", "/contratos", "/usuarios", "/auditoria", "/empresa-usuarios"]) {
      const r = await call("GET", p);
      assert.equal(r.status, 401, p);
    }
  });

  test("SEC-04 Un JWT con firma alterada es rechazado", async () => {
    const [h, p] = ctx.A.token.split(".");
    const r = await call("GET", "/clientes", { token: `${h}.${p}.firmaFalsa` });
    assert.equal(r.status, 401);
  });

  test("SEC-05 El token queda revocado despues del logout", async () => {
    const l = await call("POST", "/autenticacion/login", { body: { nombre_usuario: ctx.A.nombre_usuario, password: PASS } });
    const tk = l.data.token;
    assert.equal((await call("POST", "/autenticacion/logout", { token: tk })).status, 200);
    assert.equal((await call("GET", "/clientes", { token: tk })).status, 401);
  });

  test("SEC-06 Bloqueo por fuerza bruta: el login se limita tras intentos fallidos", async () => {
    const usuario = `qa_fuerzabruta_${RUN}`;
    const estados = [];
    for (let i = 0; i < 8; i++) {
      const r = await call("POST", "/autenticacion/login", { body: { nombre_usuario: usuario, password: `clave${i}` } });
      estados.push(r.status);
    }
    assert.ok(estados.includes(429), `no hubo bloqueo; estados: ${estados.join(",")}`);
  });

  test("SEC-07 Politica de contrasena robusta en el registro (NFR-SEG, min. 12 caracteres)", async () => {
    const r = await call("POST", "/empresas", {
      body: {
        usuario: { nombre_usuario: `qa_debil_${RUN}`, contrasena_hash: "123", correo: `debil_${RUN}@qa.cl` },
        empresa: { nombre: `Debil ${RUN}`, correo: `debil_emp_${RUN}@qa.cl` },
      },
    });
    assert.equal(r.status, 400, `se acepto la contrasena '123' (status ${r.status})`);
  });
});

describe("Pruebas de seguridad - Control de acceso (OWASP A01)", () => {
  test("SEC-08 Rol editor no puede escribir (403)", async () => {
    const r = await call("POST", "/clientes", { token: ctx.editorA, body: { nombre: "X", correo: "x@x.cl" } });
    assert.equal(r.status, 403);
  });

  test("SEC-09 IDOR: no se puede leer un cliente de otra empresa", async () => {
    const r = await call("GET", `/clientes/${ctx.clienteB}`, { token: ctx.A.token });
    assert.equal(r.status, 404);
  });

  test("SEC-10 IDOR: no se puede crear un contrato sobre un cliente de otra empresa", async () => {
    const r = await call("POST", "/contratos", {
      token: ctx.A.token,
      body: { cliente_id: ctx.clienteB, titulo: "Contrato intruso", fecha_inicio: "2026-01-01", fecha_fin: "2026-12-31" },
    });
    assert.ok(r.status === 403 || r.status === 404, `contrato creado sobre cliente ajeno (status ${r.status})`);
  });

  test("SEC-11 IDOR: no se puede modificar un usuario de otra empresa", async () => {
    const r = await call("PUT", `/usuarios/${ctx.usuarioVictimaB}`, {
      token: ctx.A.token,
      body: { nombre_usuario: `qa_Bvictima_${RUN}`, contrasena_hash: "Hackeado#2026!", correo: `victima_${RUN}@qa.cl` },
    });
    assert.equal(r.status, 404, `usuario ajeno modificado (status ${r.status})`);
  });

  test("SEC-12 IDOR: no se puede eliminar un usuario de otra empresa", async () => {
    const r = await call("DELETE", `/usuarios/${ctx.usuarioVictimaB}`, { token: ctx.A.token });
    assert.equal(r.status, 404, `usuario ajeno eliminado (status ${r.status})`);
  });

  test("SEC-13 El registro de auditoria esta aislado por empresa (Ley 21.719)", async () => {
    const r = await call("GET", "/auditoria", { token: ctx.A.token });
    assert.equal(r.status, 200);
    const ajenos = r.data.filter((l) => l.usuario_id === ctx.B.nombre_usuario);
    assert.equal(ajenos.length, 0, `se exponen ${ajenos.length} registros de la empresa B`);
  });

  test("SEC-14 No se puede vincular a la empresa propia un usuario de otra empresa", async () => {
    const r = await call("POST", "/empresa-usuarios", { token: ctx.A.token, body: { usuario_id: ctx.B.usuarioId, rol_id: 1 } });
    assert.ok(r.status === 403 || r.status === 404 || r.status === 409, `vinculo cruzado creado (status ${r.status})`);
  });
});

describe("Pruebas de seguridad - Configuracion (OWASP A05)", () => {
  test("SEC-15 La API envia cabeceras de seguridad HTTP", async () => {
    const r = await call("GET", "/");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.ok(r.headers.get("x-frame-options"), "falta X-Frame-Options");
    assert.ok(r.headers.get("strict-transport-security"), "falta HSTS");
  });

  test("SEC-16 La API no revela la tecnologia del servidor (X-Powered-By)", async () => {
    const r = await call("GET", "/");
    assert.equal(r.headers.get("x-powered-by"), null);
  });

  test("SEC-17 Los errores no exponen detalles internos de la base de datos", async () => {
    const r = await call("GET", "/contratos/no-numerico", { token: ctx.A.token });
    const texto = JSON.stringify(r.data);
    assert.ok(!/syntax|bigint|postgres|relation|column/i.test(texto), `fuga de detalle interno: ${texto}`);
  });

  test("SEC-18 CORS no acepta origenes arbitrarios", async () => {
    const r = await call("GET", "/", { headers: { Origin: "https://sitio-malicioso.example" } });
    const acao = r.headers.get("access-control-allow-origin");
    assert.ok(acao !== "*" && acao !== "https://sitio-malicioso.example", `CORS permite: ${acao}`);
  });
});

describe("Pruebas de seguridad - Validacion e integridad (OWASP A03/A04)", () => {
  test("SEC-19 El backend rechaza datos de cliente invalidos (validacion server-side)", async () => {
    const r = await call("POST", "/clientes", {
      token: ctx.A.token,
      body: { nombre: "John Doe", correo: `<xsl:value-of select="${RUN}"/>`, telefono: "John Doe" },
    });
    assert.equal(r.status, 400, `se almaceno un correo invalido (status ${r.status})`);
  });

  test("SEC-21 Nadie puede insertar entradas arbitrarias en la auditoria (Ley 21.663)", async () => {
    const r = await call("POST", "/auditoria", { token: ctx.A.token, body: { accion: "LOGIN", detalles: "entrada falsificada" } });
    assert.ok(r.status === 403 || r.status === 405, `entrada de auditoria falsificada (status ${r.status})`);
  });

  test("SEC-20 Un administrador de empresa no puede alterar el catalogo global de roles", async () => {
    const r = await call("POST", "/roles", { token: ctx.A.token, body: { nombre: `rol_intruso_${RUN}` } });
    assert.equal(r.status, 403, `rol global creado por un tenant (status ${r.status})`);
  });
});
