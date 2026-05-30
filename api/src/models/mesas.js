const db = require('../database/db');
const { ensureExists, ensureText, fetchById, newId } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM mesas ORDER BY nombre').all();
}

function getById(id) {
  return fetchById(db, 'mesas', id, 'Mesa');
}

function getByUbicacion(ubicacionId) {
  ensureExists(db, 'ubicaciones', ubicacionId, 'Ubicación');
  return db.prepare('SELECT * FROM mesas WHERE ubicacion_id = ? ORDER BY nombre').all(ubicacionId);
}

function create(data) {
  const ubicacionId = ensureText(data.ubicacion_id, 'La ubicacion_id de la mesa');
  ensureExists(db, 'ubicaciones', ubicacionId, 'Ubicación');

  const nombre = ensureText(data.nombre, 'El nombre de la mesa');
  const estado = data.estado !== undefined ? ensureText(data.estado, 'El estado de la mesa') : 'libre';

  if (!['libre', 'ocupada', 'reservada'].includes(estado)) {
    throw new Error('Estado de mesa inválido: ' + estado);
  }

  const id = newId();
  db.prepare('INSERT INTO mesas (id, ubicacion_id, nombre, estado) VALUES (?, ?, ?, ?)').run(id, ubicacionId, nombre, estado);
  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const ubicacionId = data.ubicacion_id !== undefined ? ensureText(data.ubicacion_id, 'La ubicacion_id de la mesa') : current.ubicacion_id;
  if (data.ubicacion_id !== undefined) {
    ensureExists(db, 'ubicaciones', ubicacionId, 'Ubicación');
  }

  const nombre = data.nombre !== undefined ? ensureText(data.nombre, 'El nombre de la mesa') : current.nombre;
  const estado = data.estado !== undefined ? ensureText(data.estado, 'El estado de la mesa') : current.estado;

  if (!['libre', 'ocupada', 'reservada'].includes(estado)) {
    throw new Error('Estado de mesa inválido: ' + estado);
  }

  db.prepare('UPDATE mesas SET ubicacion_id = ?, nombre = ?, estado = ? WHERE id = ?').run(ubicacionId, nombre, estado, id);
  return getById(id);
}

function updateEstado(id, estado) {
  const mesa = getById(id);
  const nuevoEstado = ensureText(estado, 'El estado de la mesa');

  if (!['libre', 'ocupada', 'reservada'].includes(nuevoEstado)) {
    throw new Error('Estado de mesa inválido: ' + nuevoEstado);
  }

  db.prepare('UPDATE mesas SET estado = ? WHERE id = ?').run(nuevoEstado, id);
  return getById(id);
}

module.exports = { create, getAll, getById, getByUbicacion, update, updateEstado };