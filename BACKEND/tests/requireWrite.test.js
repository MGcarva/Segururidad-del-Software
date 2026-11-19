const jwt = require("jsonwebtoken");
const { requireWrite, revokeJti, getAuthUser, JWT_SECRET } = require("../src/middleware/authz");

// SEC-03/04/05/08: autenticacion y autorizacion del middleware de escritura.
const firmar = (payload, secreto = JWT_SECRET) => jwt.sign({ jti: Math.random().toString(36), ...payload }, secreto);
const req = (token) => ({ headers: token ? { authorization: `Bearer ${token}` } : {} });
const res = () => { const r = { code: 200, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };

describe("requireWrite / getAuthUser", () => {
  test("SEC-03 sin token responde 401", () => {
    const r = res(); const next = jest.fn();
    requireWrite(req(), r, next);
    expect(r.code).toBe(401); expect(next).not.toHaveBeenCalled();
  });
  test("SEC-04 token firmado con otro secreto es rechazado", () => {
    expect(getAuthUser(req(firmar({ empresaId: 1, rol: "administrador" }, "otro-secreto")))).toBeNull();
  });
  test("SEC-04b token con algoritmo 'none' es rechazado", () => {
    const sinFirma = jwt.sign({ empresaId: 1, rol: "administrador" }, null, { algorithm: "none" });
    expect(getAuthUser(req(sinFirma))).toBeNull();
  });
  test("SEC-08 rol editor responde 403", () => {
    const r = res(); const next = jest.fn();
    requireWrite(req(firmar({ empresaId: 1, rol: "editor" })), r, next);
    expect(r.code).toBe(403);
  });
  test("administrador con empresa pasa y queda en req.authUser", () => {
    const rq = req(firmar({ empresaId: 7, rol: "administrador" })); const next = jest.fn();
    requireWrite(rq, res(), next);
    expect(next).toHaveBeenCalled(); expect(rq.authUser.empresaId).toBe(7);
  });
  test("SEC-05 token revocado deja de ser valido", () => {
    const token = firmar({ empresaId: 1, rol: "administrador" });
    revokeJti(jwt.decode(token).jti);
    expect(getAuthUser(req(token))).toBeNull();
  });
});
