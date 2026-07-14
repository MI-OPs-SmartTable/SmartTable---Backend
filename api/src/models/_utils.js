const { randomUUID } = require('crypto');

function newId() {
  return randomUUID().replace(/-/g, '').toLowerCase();
}

/** Fecha/hora local del sistema en formato SQLite: YYYY-MM-DD HH:MM:SS */
function nowLocalSql(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function entityNotFound(entityName, id) {
  return new Error(entityName + ' no encontrado: ' + id);
}

function fetchById(db, table, id, entityName) {
  const row = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(id);

  if (!row) {
    throw entityNotFound(entityName || table, id);
  }

  return row;
}

function fetchActiveById(db, table, id, entityName) {
  const row = db.prepare('SELECT * FROM ' + table + ' WHERE id = ? AND activo = 1').get(id);

  if (!row) {
    throw entityNotFound(entityName || table, id);
  }

  return row;
}

function ensureExists(db, table, id, entityName) {
  const row = db.prepare('SELECT id FROM ' + table + ' WHERE id = ?').get(id);

  if (!row) {
    throw entityNotFound(entityName || table, id);
  }

  return row;
}

function ensureActive(db, table, id, entityName) {
  const row = db.prepare('SELECT id FROM ' + table + ' WHERE id = ? AND activo = 1').get(id);

  if (!row) {
    throw entityNotFound(entityName || table, id);
  }

  return row;
}

function ensureText(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(fieldName + ' es obligatorio');
  }

  return String(value).trim();
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text === '' ? null : text;
}

function ensureNonNegative(value, fieldName) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(fieldName + ' debe ser un número mayor o igual a 0');
  }

  return numberValue;
}

function ensurePositive(value, fieldName) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(fieldName + ' debe ser un número mayor a 0');
  }

  return numberValue;
}

function ensureCajaAbierta(db, cajaId) {
  const caja = db.prepare('SELECT * FROM cajas WHERE id = ?').get(cajaId);

  if (!caja) {
    throw new Error('Caja no encontrada: ' + cajaId);
  }

  if (caja.estado !== 'abierta') {
    throw new Error('Caja cerrada: ' + cajaId);
  }

  return caja;
}

module.exports = {
  ensureActive,
  ensureCajaAbierta,
  ensureExists,
  ensureNonNegative,
  ensurePositive,
  ensureText,
  fetchActiveById,
  fetchById,
  newId,
  normalizeText,
  nowLocalSql,
};