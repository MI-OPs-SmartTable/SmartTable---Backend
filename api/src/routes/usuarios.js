const router = require('express').Router();
const db = require('../database/db');
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const { hashPin } = require('../middlewares/hashPin');
const usuarios = require('../models/usuarios');

const isDev = process.env.NODE_ENV !== 'production';
const adminOnly = [auth, requireRol('admin')];
const allowedProductionRoles = new Set(['admin', 'cajero', 'mesero', 'inventario']);

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(500).json({ error: err.message });
}

function sanitizeUsuario(usuario) {
  if (!usuario) {
    return usuario;
  }

  const { pin_hash, rol_id, ...resto } = usuario;
  const rol = rol_id ? db.prepare('SELECT nombre FROM roles WHERE id = ?').get(rol_id) : null;

  return {
    ...resto,
    rol: rol ? rol.nombre : usuario.rol,
  };
}

function canAssignRoleInProduction(rolId) {
  const rol = db.prepare('SELECT nombre FROM roles WHERE id = ?').get(rolId);
  return rol ? allowedProductionRoles.has(rol.nombre) : false;
}

function hasDuplicateNombreCompleto(nombreCompleto, excludeId = null) {
  if (isMissing(nombreCompleto)) {
    return false;
  }

  if (excludeId) {
    const duplicate = db.prepare(`
      SELECT id
      FROM usuarios
      WHERE nombre_completo = ? AND activo = 1 AND id <> ?
      LIMIT 1
    `).get(String(nombreCompleto).trim(), excludeId);
    return Boolean(duplicate);
  }

  const duplicate = db.prepare(`
    SELECT id
    FROM usuarios
    WHERE nombre_completo = ? AND activo = 1
    LIMIT 1
  `).get(String(nombreCompleto).trim());
  return Boolean(duplicate);
}

function getAll(req, res) {
  try {
    return res.status(200).json(usuarios.getAll().map(sanitizeUsuario));
  } catch (err) {
    return handleError(res, err);
  }
}

function getById(req, res) {
  try {
    const usuario = usuarios.getById(req.params.id);
    if (usuario === null || usuario === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(sanitizeUsuario(usuario));
  } catch (err) {
    return handleError(res, err);
  }
}

function resolvePinHash(body) {
  if (!isMissing(body.pin)) {
    return hashPin(String(body.pin));
  }
  if (!isMissing(body.pin_hash)) {
    return String(body.pin_hash).trim();
  }
  return null;
}

function createUsuario(req, res) {
  try {
    if (isMissing(req.body.rol_id)) return res.status(400).json({ error: 'Campo rol_id requerido' });
    if (isMissing(req.body.nombre_completo)) return res.status(400).json({ error: 'Campo nombre_completo requerido' });
    if (isMissing(req.body.email)) return res.status(400).json({ error: 'Campo email requerido' });
    if (hasDuplicateNombreCompleto(req.body.nombre_completo)) {
      return res.status(409).json({ error: 'Ya existe un usuario activo con ese nombre_completo' });
    }

    const pinHash = resolvePinHash(req.body);
    if (!pinHash) return res.status(400).json({ error: 'Campo pin o pin_hash requerido' });

    if (!isDev && !canAssignRoleInProduction(req.body.rol_id)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }

    return res.status(201).json(sanitizeUsuario(usuarios.create({ ...req.body, pin_hash: pinHash })));
  } catch (err) {
    return handleError(res, err);
  }
}

function updateUsuario(req, res) {
  try {
    const body = { ...(req.body || {}) };
    if (!isMissing(body.nombre_completo) && hasDuplicateNombreCompleto(body.nombre_completo, req.params.id)) {
      return res.status(409).json({ error: 'Ya existe un usuario activo con ese nombre_completo' });
    }
    const pinHash = resolvePinHash(body);
    if (pinHash) {
      body.pin_hash = pinHash;
      delete body.pin;
    }
    return res.status(200).json(sanitizeUsuario(usuarios.update(req.params.id, body)));
  } catch (err) {
    return handleError(res, err);
  }
}

function deleteUsuario(req, res) {
  try {
    usuarios.deactivate(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
}

router.get('/', getAll);
router.get('/:id', ...adminOnly, getById);
router.post('/', ...(isDev ? [] : adminOnly), createUsuario);
router.put('/:id', ...adminOnly, updateUsuario);
router.delete('/:id', ...adminOnly, deleteUsuario);

module.exports = router;