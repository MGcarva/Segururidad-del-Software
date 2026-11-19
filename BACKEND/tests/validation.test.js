const { isStrongPassword, isEmail, validarCliente } = require("../src/utils/validation");

// SEC-07: politica de contrasena robusta (NFR-SEG).
describe("isStrongPassword (SEC-07)", () => {
  test.each([
    ["123", false],
    ["contraseñalarga", false],          // sin mayuscula, numero ni simbolo
    ["Atlas2026Segura", false],          // sin simbolo
    ["Atl#2026", false],                 // menos de 12 caracteres
    ["Atlas#2026Seg", true],             // 13 caracteres, cumple todo
    ["Atlas#2026Se", true],              // limite exacto: 12
  ])("'%s' -> %s", (clave, esperado) => {
    expect(isStrongPassword(clave)).toBe(esperado);
  });
});

// SEC-19: validacion server-side de entradas.
describe("isEmail / validarCliente (SEC-19)", () => {
  test("acepta un correo valido", () => expect(isEmail("contacto@empresa.cl")).toBe(true));
  test("rechaza payloads de inyeccion en el correo", () => {
    expect(isEmail("<xsl:value-of select=\"system-property('xsl:vendor')\"/>")).toBe(false);
    expect(isEmail("any? Set-cookie: Tamper=1")).toBe(false);
  });
  test("rechaza cliente sin nombre", () => expect(validarCliente({ correo: "a@b.cl" })).not.toBeNull());
  test("rechaza telefono no numerico", () => expect(validarCliente({ nombre: "Ana", telefono: "John Doe" })).not.toBeNull());
  test("acepta cliente valido", () => expect(validarCliente({ nombre: "Ana Pérez", correo: "ana@x.cl", telefono: "912345678" })).toBeNull());
});
