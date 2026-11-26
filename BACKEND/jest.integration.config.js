// Pruebas de integracion/API del Anexo A: Jest + Supertest contra el stack real
// (Docker Compose: API en :4450 y PostgreSQL en :15432). No usan mocks.
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/integration/**/*.int.test.js"],
  testTimeout: 60000,
  maxWorkers: 1,
};
