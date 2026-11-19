const { loginLimiter, registrarFallo, registrarExito } = require("../src/middleware/loginLimiter");

// SEC-06: bloqueo por fuerza bruta (LOGIN_MAX_FALLOS=3 en setup-env.js).
function req(usuario, ip = "10.0.0.1") { return { ip, body: { nombre_usuario: usuario } }; }
function res() {
  const r = { code: 200, headers: {}, set(k, v) { r.headers[k] = v; return r; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
  return r;
}

describe("loginLimiter (SEC-06)", () => {
  test("permite intentos mientras no se supere el maximo", () => {
    const next = jest.fn();
    registrarFallo(req("ana")); registrarFallo(req("ana"));
    loginLimiter(req("ana"), res(), next);
    expect(next).toHaveBeenCalled();
  });

  test("bloquea con 429 y Retry-After tras 3 fallos", () => {
    const next = jest.fn(); const r = res();
    for (let i = 0; i < 3; i++) registrarFallo(req("pedro"));
    loginLimiter(req("pedro"), r, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.code).toBe(429);
    expect(Number(r.headers["Retry-After"])).toBeGreaterThan(0);
  });

  test("el bloqueo es por usuario+IP: otro usuario no se ve afectado", () => {
    const next = jest.fn();
    loginLimiter(req("maria"), res(), next);
    expect(next).toHaveBeenCalled();
  });

  test("un login exitoso reinicia el contador", () => {
    const next = jest.fn();
    for (let i = 0; i < 2; i++) registrarFallo(req("luis"));
    registrarExito(req("luis"));
    registrarFallo(req("luis")); registrarFallo(req("luis"));
    loginLimiter(req("luis"), res(), next);
    expect(next).toHaveBeenCalled();
  });
});
