const db = require('../database/db');
const { ensureText, fetchById, newId } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM roles ORDER BY nombre').all();
}

function getById(id) {
  return fetchById(db, 'roles', id, 'Rol');
}

function create(data) {
  const nombre = ensureText(data.nombre, 'El nombre del rol');
  const descripcion = data.descripcion === undefined ? null : String(data.descripcion).trim();

  const duplicate = db.prepare('SELECT id FROM roles WHERE nombre = ?').get(nombre);
  if (duplicate) {
    throw new Error('Rol duplicado: ' + nombre);
  }

  const id = newId();
  db.prepare('INSERT INTO roles (id, nombre, descripcion) VALUES (?, ?, ?)').run(id, nombre, descripcion || null);
  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const nombre = ensureText(data.nombre !== undefined ? data.nombre : current.nombre, 'El nombre del rol');
  const descripcion = data.descripcion !== undefined ? String(data.descripcion).trim() : current.descripcion;

  const duplicate = db.prepare('SELECT id FROM roles WHERE nombre = ? AND id <> ?').get(nombre, id);
  if (duplicate) {
    throw new Error('Rol duplicado: ' + nombre);
  }

  db.prepare('UPDATE roles SET nombre = ?, descripcion = ? WHERE id = ?').run(nombre, descripcion || null, id);
  return getById(id);
}

module.exports = { create, getAll, getById, update };