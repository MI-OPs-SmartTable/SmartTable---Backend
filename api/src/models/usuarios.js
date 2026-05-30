const db = require('../database/db');
const { ensureExists, ensureText, fetchById, newId, normalizeText } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM usuarios WHERE activo = 1 ORDER BY nombre_completo').all();
}

function getById(id) {
  return fetchById(db, 'usuarios', id, 'Usuario');
}

function create(data) {
  const rolId = ensureText(data.rol_id, 'El rol_id del usuario');
  ensureExists(db, 'roles', rolId, 'Rol');

  const nombreCompleto = ensureText(data.nombre_completo, 'El nombre completo del usuario');
  const email = ensureText(data.email, 'El email del usuario');
  const pinHash = ensureText(data.pin_hash, 'El pin_hash del usuario');

  const duplicate = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (duplicate) {
    throw new Error('Usuario duplicado por email: ' + email);
  }

  const id = newId();
  db.prepare(
    'INSERT INTO usuarios (id, rol_id, nombre_completo, email, pin_hash, activo) VALUES (?, ?, ?, ?, ?, 1)'
  ).run(id, rolId, nombreCompleto, email, pinHash);

  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const rolId = data.rol_id !== undefined ? ensureText(data.rol_id, 'El rol_id del usuario') : current.rol_id;
  if (data.rol_id !== undefined) {
    ensureExists(db, 'roles', rolId, 'Rol');
  }

  const nombreCompleto = data.nombre_completo !== undefined
    ? ensureText(data.nombre_completo, 'El nombre completo del usuario')
    : current.nombre_completo;
  const email = data.email !== undefined ? ensureText(data.email, 'El email del usuario') : current.email;
  const pinHash = data.pin_hash !== undefined ? ensureText(data.pin_hash, 'El pin_hash del usuario') : current.pin_hash;

  const duplicate = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id <> ?').get(email, id);
  if (duplicate) {
    throw new Error('Usuario duplicado por email: ' + email);
  }

  db.prepare(
    'UPDATE usuarios SET rol_id = ?, nombre_completo = ?, email = ?, pin_hash = ? WHERE id = ?'
  ).run(rolId, nombreCompleto, email, pinHash, id);

  return getById(id);
}

function deactivate(id) {
  const current = getById(id);
  if (current.activo === 0) {
    return current;
  }

  db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(id);
  return getById(id);
}

module.exports = { create, deactivate, getAll, getById, update };