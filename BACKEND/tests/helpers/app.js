// Utilidades compartidas por los tests unitarios del Anexo A.
// El router bajo prueba se monta en una app Express aislada; la base de datos
// se simula en cada test con jest.mock("../src/db").
const express = require("express");
const jwt = require("jsonwebtoken");

function montarRouter(ruta, router) {
  const app = express();
  app.use(express.json());
  app.use(ruta, router);
  return app;
}

// Token firmado con el mismo secreto que lee el codigo bajo prueba (setup-env.js).
function tokenDePrueba(claims = {}) {
  return jwt.sign(
    { usuarioId: 1, nombreUsuario: "admin_a", empresaUsuarioId: 1, empresaId: 1, ...claims },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

module.exports = { montarRouter, tokenDePrueba };
