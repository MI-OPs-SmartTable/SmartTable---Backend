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

module.exports = { create, getAll, getById };