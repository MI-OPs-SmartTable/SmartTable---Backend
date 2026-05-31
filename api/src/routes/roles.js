const router = require('express').Router();
const db = require('../database/db');
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const roles = require('../models/roles');

const isDev = process.env.NODE_ENV !== 'production';
const devOrAuth = isDev ? [] : [auth, requireRol('admin')];

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(500).json({ error: err.message });
}

function getAll(req, res) {
  try {
    return res.status(200).json(roles.getAll());
  } catch (err) {
    return handleError(res, err);
  }
}

function getById(req, res) {
  try {
    const role = roles.getById(req.params.id);
    if (role === null || role === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(role);
  } catch (err) {
    return handleError(res, err);
  }
}

function createRole(req, res) {
  try {
    if (isMissing(req.body.nombre)) {
      return res.status(400).json({ error: 'Campo nombre requerido' });
    }

    return res.status(201).json(roles.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
}

function updateRole(req, res) {
  try {
    return res.status(200).json(roles.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
}

function deleteRole(req, res) {
  try {
    const result = db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
}

function blockedInProduction(req, res) {
  return res.status(405).json({ error: 'No permitido en producción. Use el seed para gestionar roles.' });
}

router.get('/', ...devOrAuth, getAll);
router.get('/:id', ...devOrAuth, getById);
router.post('/', isDev ? createRole : blockedInProduction);
router.put('/:id', isDev ? updateRole : blockedInProduction);
router.delete('/:id', isDev ? deleteRole : blockedInProduction);

module.exports = router;