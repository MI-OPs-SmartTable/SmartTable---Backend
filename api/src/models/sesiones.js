const db = require('../database/db');
const { ensureCajaAbierta, ensureExists, ensureText, fetchById, newId } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM sesiones ORDER BY inicio_at DESC').all();
}

function getById(id) {
  return fetchById(db, 'sesiones', id, 'Sesión');
}

function create(data) {
  const usuarioId = ensureText(data.usuario_id, 'El usuario_id de la sesión');
  const cajaId = ensureText(data.caja_id, 'El caja_id de la sesión');

  ensureExists(db, 'usuarios', usuarioId, 'Usuario');
  ensureCajaAbierta(db, cajaId);

  const inicioAt = data.inicio_at ? String(data.inicio_at).trim() : null;
  const finAt = data.fin_at ? String(data.fin_at).trim() : null;

  const id = newId();
  db.prepare('INSERT INTO sesiones (id, usuario_id, caja_id, inicio_at, fin_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    usuarioId,
    cajaId,
    inicioAt || undefined,
    finAt || undefined
  );

  return getById(id);
}

function iniciar(data) {
  return create(data);
}

function update(id, data) {
  const current = getById(id);
  const usuarioId = data.usuario_id !== undefined ? ensureText(data.usuario_id, 'El usuario_id de la sesión') : current.usuario_id;
  const cajaId = data.caja_id !== undefined ? ensureText(data.caja_id, 'El caja_id de la sesión') : current.caja_id;

  if (data.usuario_id !== undefined) {
    ensureExists(db, 'usuarios', usuarioId, 'Usuario');
  }
  if (data.caja_id !== undefined) {
    ensureCajaAbierta(db, cajaId);
  }

  const inicioAt = data.inicio_at !== undefined ? String(data.inicio_at).trim() : current.inicio_at;
  const finAt = data.fin_at !== undefined ? String(data.fin_at).trim() : current.fin_at;

  db.prepare('UPDATE sesiones SET usuario_id = ?, caja_id = ?, inicio_at = ?, fin_at = ? WHERE id = ?').run(
    usuarioId,
    cajaId,
    inicioAt,
    finAt,
    id
  );

  return getById(id);
}

function close(id, data) {
  const current = getById(id);
  const finAt = data && data.fin_at !== undefined ? String(data.fin_at).trim() : new Date().toISOString();

  db.prepare('UPDATE sesiones SET fin_at = ? WHERE id = ?').run(finAt, id);
  return getById(id);
}

module.exports = { close, create, getAll, getById, iniciar, update };