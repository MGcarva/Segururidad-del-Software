const { getPermissionsForRole } = require("../src/middleware/authz");

// CP-031: Validar la función que determina los permisos según el rol del usuario.
describe("getPermissionsForRole (CP-031)", () => {
  test("el rol 'editor' NO tiene permiso de escritura", () => {
    const perms = getPermissionsForRole("editor");
    expect(perms.write).toBe(false);
  });

  test("el rol 'editor' SI tiene permiso de lectura", () => {
    const perms = getPermissionsForRole("editor");
    expect(perms.read).toBe(true);
  });

  test("el rol 'administrador' tiene permiso de lectura y escritura", () => {
    const perms = getPermissionsForRole("administrador");
    expect(perms.read).toBe(true);
    expect(perms.write).toBe(true);
  });

  test("un rol desconocido o nulo no tiene ningún permiso", () => {
    expect(getPermissionsForRole("supervisor")).toEqual({ read: false, write: false });
    expect(getPermissionsForRole(null)).toEqual({ read: false, write: false });
    expect(getPermissionsForRole(undefined)).toEqual({ read: false, write: false });
  });
});
