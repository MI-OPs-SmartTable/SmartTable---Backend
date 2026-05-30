const db = require('../database/db');
const { ensureText, fetchById, newId } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM ubicaciones WHERE activo = 1 ORDER BY nombre').all();
}

function getById(id) {
  return fetchById(db, 'ubicaciones', id, 'Ubicación');
}

function create(data) {
  const nombre = ensureText(data.nombre, 'El nombre de la ubicación');

  const duplicate = db.prepare('SELECT id FROM ubicaciones WHERE nombre = ?').get(nombre);
  if (duplicate) {
    throw new Error('Ubicación duplicada: ' + nombre);
  }

  const id = newId();
  db.prepare('INSERT INTO ubicaciones (id, nombre, activo) VALUES (?, ?, 1)').run(id, nombre);
  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const nombre = data.nombre !== undefined ? ensureText(data.nombre, 'El nombre de la ubicación') : current.nombre;

  const duplicate = db.prepare('SELECT id FROM ubicaciones WHERE nombre = ? AND id <> ?').get(nombre, id);
  if (duplicate) {
    throw new Error('Ubicación duplicada: ' + nombre);
  }

  db.prepare('UPDATE ubicaciones SET nombre = ? WHERE id = ?').run(nombre, id);
  return getById(id);
}

function deactivate(id) {
  const current = getById(id);
  if (current.activo === 0) {
    return current;
  }

  db.prepare('UPDATE ubicaciones SET activo = 0 WHERE id = ?').run(id);
  return getById(id);
}

module.exports = { create, deactivate, getAll, getById, update };