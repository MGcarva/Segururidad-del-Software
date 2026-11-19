const { hashPassword, comparePassword, isBcryptHash } = require("../src/utils/security");

// CP-001: Validar la función interna que compara el hash de la contraseña
// ingresada contra el hash almacenado.
describe("hashPassword / comparePassword (CP-001)", () => {
  test("genera un hash con formato bcrypt, distinto de la contraseña original", async () => {
    const hash = await hashPassword("Atlas#2026Segura");
    expect(isBcryptHash(hash)).toBe(true);
    expect(hash).not.toBe("Atlas#2026Segura");
  });

  test("retorna verdadero cuando la contraseña ingresada coincide con el hash", async () => {
    const hash = await hashPassword("Atlas#2026Segura");
    await expect(comparePassword("Atlas#2026Segura", hash)).resolves.toBe(true);
  });

  test("retorna falso cuando la contraseña ingresada NO coincide con el hash", async () => {
    const hash = await hashPassword("Atlas#2026Segura");
    await expect(comparePassword("otraClave123", hash)).resolves.toBe(false);
  });

  test("dos hashes de la misma contraseña son distintos entre sí (sal aleatoria)", async () => {
    const hash1 = await hashPassword("MismaClave#1");
    const hash2 = await hashPassword("MismaClave#1");
    expect(hash1).not.toBe(hash2);
  });
});
