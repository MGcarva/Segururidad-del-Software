const express = require("express");
const multer = require("multer");
const { pool } = require("../db");
const { errorInterno } = require("../utils/validation");
const { getAuthUser, requireWrite } = require("../middleware/authz");

const router = express.Router();

// Subida restringida: maximo 5 MB, un archivo, y solo PDF verificado por su
// firma binaria (%PDF-), no por la extension ni el Content-Type declarado
// (mitiga hallazgo Semgrep express_xss / CWE-434 y DoS por archivos grandes).
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

function esPdf(file) {
  return !file || (file.buffer && file.buffer.subarray(0, 5).toString("latin1") === "%PDF-");
}

// El cliente indicado debe pertenecer a la empresa del token (mitiga IDOR SEC-10).
async function clienteDeEmpresa(clienteId, empresaId) {
  if (!Number.isInteger(Number(clienteId))) return false;
  const r = await pool.query("SELECT 1 FROM clientes WHERE id = $1 AND empresa_id = $2", [Number(clienteId), empresaId]);
  return r.rows.length > 0;
}

// Crear contrato con archivo PDF (guardado en DB como bytea)
router.post("/", requireWrite, upload.single("file"), async (req, res) => {
  const {
    cliente_id,
    titulo,
    descripcion = null,
    fecha_inicio,
    fecha_fin,
  } = req.body;
  if (!titulo || !fecha_inicio || !fecha_fin || fecha_fin < fecha_inicio) {
    return res.status(400).json({ error: "Datos inválidos", glosa: "Título y fechas válidas son obligatorios (fin >= inicio)." });
  }
  if (!esPdf(req.file)) {
    return res.status(400).json({ error: "Archivo inválido", glosa: "Solo se aceptan documentos PDF." });
  }
  try {
    if (!(await clienteDeEmpresa(cliente_id, req.authUser.empresaId))) {
      return res.status(404).json({ error: "No encontrado", glosa: "Cliente no encontrado o no pertenece a tu empresa" });
    }
    const clientIdNum = Number(cliente_id);
    const contractInsert = await pool.query(
      "INSERT INTO contratos (cliente_id, titulo, descripcion, fecha_inicio, fecha_fin) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [clientIdNum, titulo, descripcion, fecha_inicio, fecha_fin]
    );

    if (req.file && req.file.buffer) {
      await pool.query(
        "INSERT INTO documentos_contrato (contract_id, document) VALUES ($1, $2)",
        [contractInsert.rows[0].id, req.file.buffer]
      );
    }

    const result = contractInsert;
    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        req.authUser.nombreUsuario,
        `CONTRATOS_CREAR: creó contrato ${titulo} para cliente ${cliente_id}`,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al crear contrato");
  }
});

// Listar contratos
router.get("/", async (req, res) => {
  try {
    const authUser = getAuthUser(req);

    if (!authUser || !authUser.empresaId) {
      return res.status(401).json({
        error: "No autorizado",
        glosa: "Token inválido o sin empresa asociada",
      });
    }
    const empresaId = authUser.empresaId;
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.titulo,
        c.descripcion,
        c.fecha_inicio,
        c.fecha_fin,
        c.created_at,
        cl.nombre AS cliente_nombre
      FROM contratos c
      INNER JOIN clientes cl ON cl.id = c.cliente_id
      WHERE cl.empresa_id = $1
      ORDER BY c.id DESC
    `,
      [empresaId]
    );
    res.json(result.rows);
  } catch (err) {
    errorInterno(res, err, "Error al listar contratos");
  }
});

// Servicio 1: Contratos por estado (por_vencer y vencido)
router.get("/estados", async (req, res) => {
  try {
    const authUser = getAuthUser(req);

    // Validar token y empresaId
    if (!authUser || !authUser.empresaId) {
      return res.status(401).json({
        error: "No autorizado",
        glosa: "Token inválido o sin empresa asociada",
      });
    }

    const empresaId = authUser.empresaId;
    const hoy = new Date();
    const hoyFormateado = hoy.toISOString().split("T")[0]; // YYYY-MM-DD
    const fecha30Dias = new Date(hoy);
    fecha30Dias.setDate(fecha30Dias.getDate() + 30);
    const fecha30DiasFormateada = fecha30Dias.toISOString().split("T")[0];

    // Contratos por vencer (fecha_fin entre hoy y 30 días)
    const porVencer = await pool.query(
      `SELECT c.id, c.cliente_id, c.titulo, c.descripcion, c.fecha_inicio, c.fecha_fin, c.created_at
       FROM contratos c
       INNER JOIN clientes cl ON cl.id = c.cliente_id
       WHERE cl.empresa_id = $1
         AND c.fecha_fin >= $2
         AND c.fecha_fin <= $3
       ORDER BY c.fecha_fin ASC
       LIMIT 3`,
      [empresaId, hoyFormateado, fecha30DiasFormateada]
    );

    // Contratos vencidos (fecha_fin ya pasó)
    const vencidos = await pool.query(
      `SELECT c.id, c.cliente_id, c.titulo, c.descripcion, c.fecha_inicio, c.fecha_fin, c.created_at
       FROM contratos c
       INNER JOIN clientes cl ON cl.id = c.cliente_id
       WHERE cl.empresa_id = $1
         AND c.fecha_fin < $2
       ORDER BY c.fecha_fin DESC
       LIMIT 3`,
      [empresaId, hoyFormateado]
    );

    // Agregar estado a cada contrato
    const porVencerConEstado = porVencer.rows.map((contrato) => ({
      ...contrato,
      estado: "por_vencer",
    }));

    const vencidosConEstado = vencidos.rows.map((contrato) => ({
      ...contrato,
      estado: "vencido",
    }));

    res.json([...porVencerConEstado, ...vencidosConEstado]);
  } catch (err) {
    errorInterno(res, err, "Error al obtener contratos por estado");
  }
});

// Servicio 2: Dashboard con estadísticas de la empresa
router.get("/dashboard", async (req, res) => {
  try {
    const authUser = getAuthUser(req);

    // Validar token y empresaId
    if (!authUser || !authUser.empresaId) {
      return res.status(401).json({
        error: "No autorizado",
        glosa: "Token inválido o sin empresa asociada",
      });
    }

    const empresaId = authUser.empresaId;
    const hoy = new Date();
    const hoyFormateado = hoy.toISOString().split("T")[0];

    // Fechas para los próximos 7, 15 y 30 días
    const fecha7Dias = new Date(hoy);
    fecha7Dias.setDate(fecha7Dias.getDate() + 7);
    const fecha7DiasFormateada = fecha7Dias.toISOString().split("T")[0];

    const fecha15Dias = new Date(hoy);
    fecha15Dias.setDate(fecha15Dias.getDate() + 15);
    const fecha15DiasFormateada = fecha15Dias.toISOString().split("T")[0];

    const fecha30Dias = new Date(hoy);
    fecha30Dias.setDate(fecha30Dias.getDate() + 30);
    const fecha30DiasFormateada = fecha30Dias.toISOString().split("T")[0];

    // Total de usuarios de la empresa
    const totalUsuariosResult = await pool.query(
      "SELECT COUNT(*) as total FROM empresa_usuarios WHERE empresa_id = $1",
      [empresaId]
    );
    const totalUsuarios = parseInt(totalUsuariosResult.rows[0].total);

    // Total de clientes asociados a la empresa
    const totalClientesResult = await pool.query(
      "SELECT COUNT(*) as total FROM clientes WHERE empresa_id = $1",
      [empresaId]
    );
    const totalClientes = parseInt(totalClientesResult.rows[0].total);

    // Total de contratos que vencen en los próximos 7 días
    const contratos7DiasResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM contratos c
       INNER JOIN clientes cl ON cl.id = c.cliente_id
       WHERE cl.empresa_id = $1
         AND c.fecha_fin >= $2
         AND c.fecha_fin <= $3`,
      [empresaId, hoyFormateado, fecha7DiasFormateada]
    );
    const contratos7Dias = parseInt(contratos7DiasResult.rows[0].total);

    // Total de contratos que vencen en los próximos 15 días
    const contratos15DiasResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM contratos c
       INNER JOIN clientes cl ON cl.id = c.cliente_id
       WHERE cl.empresa_id = $1
         AND c.fecha_fin >= $2
         AND c.fecha_fin <= $3`,
      [empresaId, hoyFormateado, fecha15DiasFormateada]
    );
    const contratos15Dias = parseInt(contratos15DiasResult.rows[0].total);

    // Total de contratos que vencen en los próximos 30 días
    const contratos30DiasResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM contratos c
       INNER JOIN clientes cl ON cl.id = c.cliente_id
       WHERE cl.empresa_id = $1
         AND c.fecha_fin >= $2
         AND c.fecha_fin <= $3`,
      [empresaId, hoyFormateado, fecha30DiasFormateada]
    );
    const contratos30Dias = parseInt(contratos30DiasResult.rows[0].total);

    res.json({
      totalUsuarios,
      totalClientes,
      contratosVencen7Dias: contratos7Dias,
      contratosVencen15Dias: contratos15Dias,
      contratosVencen30Dias: contratos30Dias,
    });
  } catch (err) {
    errorInterno(res, err, "Error al obtener estadísticas");
  }
});

// Obtener contrato por id (validando que pertenezca a la empresa del token)
router.get("/:id", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || !authUser.empresaId) {
    return res.status(401).json({ error: "No autorizado", glosa: "Token inválido o sin empresa asociada" });
  }
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: "No encontrado" });
  try {
    const result = await pool.query(
      `SELECT c.id, c.cliente_id, c.titulo, c.descripcion, c.fecha_inicio, c.fecha_fin, c.created_at
       FROM contratos c
       INNER JOIN clientes cl ON cl.id = c.cliente_id
       WHERE c.id=$1 AND cl.empresa_id=$2`,
      [req.params.id, authUser.empresaId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al obtener contrato");
  }
});

// Actualizar contrato
router.put("/:id", requireWrite, upload.single("file"), async (req, res) => {
  try {
    const authUser = req.authUser;
    const empresaId = authUser.empresaId;
    const contratoId = req.params.id;

    // Verificar que el contrato pertenezca a la empresa del token
    const contratoExistente = await pool.query(
      `SELECT c.id, c.cliente_id, c.titulo
       FROM contratos c
       INNER JOIN clientes cl ON cl.id = c.cliente_id
       WHERE c.id = $1 AND cl.empresa_id = $2`,
      [contratoId, empresaId]
    );

    if (contratoExistente.rows.length === 0) {
      return res.status(404).json({
        error: "No encontrado",
        glosa: "Contrato no encontrado o no pertenece a tu empresa",
      });
    }

    const { cliente_id, titulo, descripcion, fecha_inicio, fecha_fin } =
      req.body;

    if (cliente_id !== undefined && !(await clienteDeEmpresa(cliente_id, empresaId))) {
      return res.status(404).json({ error: "No encontrado", glosa: "Cliente no encontrado o no pertenece a tu empresa" });
    }
    if (!esPdf(req.file)) {
      return res.status(400).json({ error: "Archivo inválido", glosa: "Solo se aceptan documentos PDF." });
    }

    // Construir la consulta dinámicamente solo con los campos que se envían
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (cliente_id !== undefined) {
      updates.push(`cliente_id = $${paramIndex}`);
      values.push(Number(cliente_id));
      paramIndex++;
    }

    if (titulo !== undefined) {
      updates.push(`titulo = $${paramIndex}`);
      values.push(titulo);
      paramIndex++;
    }

    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex}`);
      values.push(descripcion);
      paramIndex++;
    }

    if (fecha_inicio !== undefined) {
      updates.push(`fecha_inicio = $${paramIndex}`);
      values.push(fecha_inicio);
      paramIndex++;
    }

    if (fecha_fin !== undefined) {
      updates.push(`fecha_fin = $${paramIndex}`);
      values.push(fecha_fin);
      paramIndex++;
    }

    // Si no hay campos de texto para actualizar pero SI viene un archivo,
    // igual debe procesarse el archivo (antes se perdía silenciosamente).
    let result;
    if (updates.length === 0) {
      const contratoActual = await pool.query(
        "SELECT * FROM contratos WHERE id = $1",
        [contratoId]
      );
      result = contratoActual;
    } else {
      // Agregar el ID del contrato al final
      values.push(contratoId);
      result = await pool.query(
        `UPDATE contratos
         SET ${updates.join(", ")}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );
    }

    // Si se envía un nuevo archivo, actualizarlo (independiente de si
    // también se enviaron campos de texto)
    if (req.file && req.file.buffer) {
      await pool.query(
        "INSERT INTO documentos_contrato (contract_id, document) VALUES ($1, $2)",
        [contratoId, req.file.buffer]
      );
    }

    // Registrar en auditoría
    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        authUser.nombreUsuario,
        `CONTRATOS_ACTUALIZAR: actualizó contrato ID ${contratoId} - ${
          titulo || contratoExistente.rows[0].titulo
        }`,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, "Error al actualizar contrato");
  }
});

// Descargar/visualizar el último documento asociado al contrato
// (requiere pertenecer a la empresa del contrato; antes era público)
router.get("/:id/file", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser || !authUser.empresaId) {
    return res.status(401).json({ error: "No autorizado", glosa: "Token inválido o sin empresa asociada" });
  }
  try {
    const contrato = await pool.query(
      `SELECT c.id FROM contratos c
       INNER JOIN clientes cl ON cl.id = c.cliente_id
       WHERE c.id = $1 AND cl.empresa_id = $2`,
      [req.params.id, authUser.empresaId]
    );
    if (contrato.rows.length === 0) {
      return res.status(404).json({ error: "No encontrado" });
    }
    // nosemgrep: ajinabraham.njsscan.xss.xss_node.express_xss
    const doc = await pool.query(
      "SELECT document FROM documentos_contrato WHERE contract_id=$1 ORDER BY id DESC LIMIT 1",
      [req.params.id]
    );
    if (doc.rows.length === 0)
      return res.status(404).json({ error: "Documento no encontrado" });
    const buffer = doc.rows[0].document;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="contrato.pdf"');
    // Riesgo XSS mitigado: el archivo se valido como PDF por su firma binaria al
    // subirlo, el Content-Type es fijo (application/pdf) y helmet envia nosniff.
    res.send(buffer);
  } catch (err) {
    errorInterno(res, err, "Error al obtener archivo");
  }
});

// Eliminar contrato y su archivo (validando que pertenezca a la empresa del token)
router.delete("/:id", requireWrite, async (req, res) => {
  try {
    const empresaId = req.authUser.empresaId;
    const pertenece = await pool.query(
      `SELECT c.id FROM contratos c
       INNER JOIN clientes cl ON cl.id = c.cliente_id
       WHERE c.id = $1 AND cl.empresa_id = $2`,
      [req.params.id, empresaId]
    );
    if (pertenece.rows.length === 0) {
      return res.status(404).json({ error: "No encontrado" });
    }

    await pool.query("DELETE FROM documentos_contrato WHERE contract_id=$1", [
      req.params.id,
    ]);
    const result = await pool.query(
      "DELETE FROM contratos WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        req.authUser.nombreUsuario,
        `CONTRATOS_ELIMINAR: eliminó contrato ID ${req.params.id}`,
      ]
    );

    res.json({ deleted: true });
  } catch (err) {
    errorInterno(res, err, "Error al eliminar contrato");
  }
});

module.exports = router;
