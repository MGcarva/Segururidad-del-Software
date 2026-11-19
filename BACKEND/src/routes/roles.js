const express = require('express');
const { pool } = require('../db');
const { errorInterno } = require('../utils/validation');
const { requireWrite } = require('../middleware/authz');

const router = express.Router();

// Los roles son un catalogo GLOBAL compartido por todas las empresas
// (1=administrador, 2=editor). Un administrador de empresa no puede crearlos,
// modificarlos ni borrarlos, porque afectaria a todos los tenants (SEC-20).
function catalogoSoloLectura(req, res) {
  return res.status(403).json({ error: "Prohibido", glosa: "El catálogo de roles es de solo lectura." });
}
router.post('/', catalogoSoloLectura);
router.put('/:id', catalogoSoloLectura);
router.delete('/:id', catalogoSoloLectura);

// Crear rol
router.post('/', requireWrite, async (req, res) => {
  const { nombre } = req.body;
  try {
    const result = await pool.query('INSERT INTO roles (nombre) VALUES ($1) RETURNING *', [nombre]);

    await pool.query('INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)', [
      req.authUser.nombreUsuario,
      `ROLES_CREAR: creó rol ${nombre}`,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, 'Error al crear rol');
  }
});

// Listar roles
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    errorInterno(res, err, 'Error al listar roles');
  }
});

// Obtener rol por id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, 'Error al obtener rol');
  }
});

// Actualizar rol
router.put('/:id', requireWrite, async (req, res) => {
  const { nombre } = req.body;
  try {
    const result = await pool.query('UPDATE roles SET nombre=$1 WHERE id=$2 RETURNING *', [nombre, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

    await pool.query('INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)', [
      req.authUser.nombreUsuario,
      `ROLES_ACTUALIZAR: actualizó rol ID ${req.params.id}`,
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    errorInterno(res, err, 'Error al actualizar rol');
  }
});

// Eliminar rol
router.delete('/:id', requireWrite, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM roles WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

    await pool.query('INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)', [
      req.authUser.nombreUsuario,
      `ROLES_ELIMINAR: eliminó rol ID ${req.params.id}`,
    ]);

    res.json({ deleted: true });
  } catch (err) {
    errorInterno(res, err, 'Error al eliminar rol');
  }
});

module.exports = router;
