const db = require('../database/db');
const { ensureExists, ensureNonNegative, ensureText, fetchById, newId } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM cajas ORDER BY apertura_at DESC').all();
}

function getAbiertas() {
  return db.prepare('SELECT * FROM cajas WHERE estado = ? ORDER BY apertura_at DESC').all('abierta');
}

function getById(id) {
  return fetchById(db, 'cajas', id, 'Caja');
}

function getCajaAbierta(usuarioId) {
  ensureExists(db, 'usuarios', usuarioId, 'Usuario');
  return db.prepare('SELECT * FROM cajas WHERE usuario_id = ? AND estado = ? ORDER BY apertura_at DESC LIMIT 1').get(usuarioId, 'abierta');
}

function create(data) {
  const usuarioId = ensureText(data.usuario_id, 'El usuario_id de la caja');
  ensureExists(db, 'usuarios', usuarioId, 'Usuario');

  const montoApertura = ensureNonNegative(data.monto_apertura ?? 0, 'El monto de apertura');
  const montoCierre = ensureNonNegative(data.monto_cierre ?? 0, 'El monto de cierre');
  const aperturaAt = data.apertura_at ? String(data.apertura_at).trim() : new Date().toISOString().replace('T', ' ').replace('Z', '');
  const cierreAt = data.cierre_at ? String(data.cierre_at).trim() : null;
  const estado = data.estado !== undefined ? ensureText(data.estado, 'El estado de la caja') : 'abierta';

  if (!['abierta', 'cerrada'].includes(estado)) {
    throw new Error('Estado de caja inválido: ' + estado);
  }

  const id = newId();
  db.prepare(
    'INSERT INTO cajas (id, usuario_id, monto_apertura, monto_cierre, apertura_at, cierre_at, estado) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, usuarioId, montoApertura, montoCierre, aperturaAt || undefined, cierreAt || undefined, estado);

  return getById(id);
}

function getMontoCierreAutomatico(cajaId) {
  const caja = getById(cajaId);
  const ventas = db.prepare(
    'SELECT COALESCE(SUM(total), 0) AS total FROM ventas WHERE caja_id = ?'
  ).get(cajaId);

  return Number(caja.monto_apertura || 0) + Number(ventas.total || 0);
}

function abrir(data) {
  const usuarioId = ensureText(data.usuario_id, 'El usuario_id de la caja');
  const abierta = getAbiertas()[0];
  if (abierta) {
    if (abierta.usuario_id === usuarioId) {
      throw new Error('Ya existe una caja abierta para el usuario: ' + usuarioId);
    }
    const titular = db.prepare(
      'SELECT nombre_completo FROM usuarios WHERE id = ?'
    ).get(abierta.usuario_id);
    const nombre = titular?.nombre_completo || 'otro usuario';
    throw new Error(
      `Hay una caja abierta por ${nombre}. Debe iniciar sesión y cerrar la caja antes de abrir una nueva.`
    );
  }

  return create(data);
}

function update(id, data) {
  const current = getById(id);
  const usuarioId = data.usuario_id !== undefined ? ensureText(data.usuario_id, 'El usuario_id de la caja') : current.usuario_id;
  if (data.usuario_id !== undefined) {
    ensureExists(db, 'usuarios', usuarioId, 'Usuario');
  }

  const montoApertura = data.monto_apertura !== undefined ? ensureNonNegative(data.monto_apertura, 'El monto de apertura') : current.monto_apertura;
  const montoCierre = data.monto_cierre !== undefined ? ensureNonNegative(data.monto_cierre, 'El monto de cierre') : current.monto_cierre;
  const aperturaAt = data.apertura_at !== undefined ? String(data.apertura_at).trim() : current.apertura_at;
  const cierreAt = data.cierre_at !== undefined ? String(data.cierre_at).trim() : current.cierre_at;
  const estado = data.estado !== undefined ? ensureText(data.estado, 'El estado de la caja') : current.estado;

  if (!['abierta', 'cerrada'].includes(estado)) {
    throw new Error('Estado de caja inválido: ' + estado);
  }

  db.prepare(
    'UPDATE cajas SET usuario_id = ?, monto_apertura = ?, monto_cierre = ?, apertura_at = ?, cierre_at = ?, estado = ? WHERE id = ?'
  ).run(usuarioId, montoApertura, montoCierre, aperturaAt, cierreAt, estado, id);

  return getById(id);
}

function close(id, data) {
  const current = getById(id);
  if (current.estado === 'cerrada') {
    return current;
  }

  const montoCierre = getMontoCierreAutomatico(id);
  const cierreAt = new Date().toISOString().replace('T', ' ').replace('Z', '');

  db.prepare("UPDATE cajas SET monto_cierre = ?, cierre_at = ?, estado = 'cerrada' WHERE id = ?").run(montoCierre, cierreAt, id);
  return getById(id);
}

function cerrar(id, data) {
  return close(id, data);
}

function open(id) {
  const current = getById(id);
  if (current.estado === 'abierta') {
    return current;
  }

  db.prepare("UPDATE cajas SET estado = 'abierta' WHERE id = ?").run(id);
  return getById(id);
}

module.exports = { abrir, close, cerrar, create, getAbiertas, getAll, getById, getCajaAbierta, open, update };