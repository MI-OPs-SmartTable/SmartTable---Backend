const db = require('../database/db');
const { ensureCajaAbierta, ensureExists, ensureNonNegative, ensureText, fetchById, newId, nowLocalSql } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM gastos_caja ORDER BY created_at DESC').all();
}

function getById(id) {
  return fetchById(db, 'gastos_caja', id, 'Gasto de caja');
}

function getByCaja(cajaId) {
  ensureExists(db, 'cajas', cajaId, 'Caja');
  return db.prepare('SELECT * FROM gastos_caja WHERE caja_id = ? ORDER BY created_at DESC').all(cajaId);
}

function create(data) {
  const cajaId = ensureText(data.caja_id, 'El caja_id del gasto');
  const usuarioId = ensureText(data.usuario_id, 'El usuario_id del gasto');
  ensureCajaAbierta(db, cajaId);
  ensureExists(db, 'usuarios', usuarioId, 'Usuario');

  const monto = ensureNonNegative(data.monto, 'El monto del gasto');
  const descripcion = ensureText(data.descripcion, 'La descripción del gasto');
  const categoria = ensureText(data.categoria, 'La categoría del gasto');

  const id = newId();
  db.prepare('INSERT INTO gastos_caja (id, caja_id, usuario_id, monto, descripcion, categoria, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id,
    cajaId,
    usuarioId,
    monto,
    descripcion,
    categoria,
    nowLocalSql()
  );

  return getById(id);
}

module.exports = { create, getAll, getByCaja, getById };