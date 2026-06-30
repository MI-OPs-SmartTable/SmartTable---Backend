const db = require('../database/db');
const { ensureText, fetchById, newId } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM medios_pago_transferencia WHERE activo = 1 ORDER BY nombre').all();
}

function getById(id) {
  return fetchById(db, 'medios_pago_transferencia', id, 'Medio de pago por transferencia');
}

function create(data) {
  const nombre = ensureText(data.nombre, 'El nombre del medio de pago por transferencia');
  const duplicate = db.prepare('SELECT id FROM medios_pago_transferencia WHERE nombre = ?').get(nombre);

  if (duplicate) {
    throw new Error('Medio de pago por transferencia duplicado: ' + nombre);
  }

  const id = newId();
  db.prepare('INSERT INTO medios_pago_transferencia (id, nombre, activo) VALUES (?, ?, ?)').run(id, nombre, 1);

  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const nombre = data.nombre !== undefined ? ensureText(data.nombre, 'El nombre del medio de pago por transferencia') : current.nombre;
  const activo = data.activo !== undefined ? (data.activo ? 1 : 0) : current.activo;

  const duplicate = db.prepare('SELECT id FROM medios_pago_transferencia WHERE nombre = ? AND id <> ?').get(nombre, id);
  if (duplicate) {
    throw new Error('Medio de pago por transferencia duplicado: ' + nombre);
  }

  db.prepare('UPDATE medios_pago_transferencia SET nombre = ?, activo = ? WHERE id = ?').run(nombre, activo, id);
  return getById(id);
}

function deactivate(id) {
  const current = getById(id);
  db.prepare('UPDATE medios_pago_transferencia SET activo = 0 WHERE id = ?').run(id);
  return getById(id);
}

module.exports = { create, deactivate, getAll, getById, update };