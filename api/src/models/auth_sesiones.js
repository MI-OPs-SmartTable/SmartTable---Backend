const db = require('../database/db');
const { ensureExists, ensureText, newId, nowLocalSql } = require('./_utils');

function getActivaByUsuario(usuarioId) {
  const usuarioIdText = ensureText(usuarioId, 'El usuario_id de la sesión de auth');
  const now = nowLocalSql();

  return db.prepare(`
    SELECT *
    FROM auth_sesiones
    WHERE usuario_id = ?
      AND revoked_at IS NULL
      AND expires_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(usuarioIdText, now) || null;
}

function getById(id) {
  return db.prepare('SELECT * FROM auth_sesiones WHERE id = ?').get(id) || null;
}

function isActiva(id) {
  if (!id) return false;
  const now = nowLocalSql();
  const row = db.prepare(`
    SELECT id
    FROM auth_sesiones
    WHERE id = ?
      AND revoked_at IS NULL
      AND expires_at > ?
    LIMIT 1
  `).get(id, now);
  return Boolean(row);
}

function crear({ usuarioId, expiresInSeconds, deviceLabel }) {
  const usuarioIdText = ensureText(usuarioId, 'El usuario_id de la sesión de auth');
  ensureExists(db, 'usuarios', usuarioIdText, 'Usuario');

  const seconds = Math.max(60, Number(expiresInSeconds) || 28800);
  const expiresAtDate = new Date(Date.now() + seconds * 1000);
  const id = newId();
  const createdAt = nowLocalSql();
  const expiresAt = nowLocalSql(expiresAtDate);

  db.prepare(`
    INSERT INTO auth_sesiones (id, usuario_id, created_at, expires_at, revoked_at, device_label)
    VALUES (?, ?, ?, ?, NULL, ?)
  `).run(id, usuarioIdText, createdAt, expiresAt, deviceLabel ? String(deviceLabel).slice(0, 200) : null);

  return getById(id);
}

function revocar(id) {
  const sessionId = ensureText(id, 'El id de la sesión de auth');
  db.prepare(`
    UPDATE auth_sesiones
    SET revoked_at = ?
    WHERE id = ? AND revoked_at IS NULL
  `).run(nowLocalSql(), sessionId);
  return getById(sessionId);
}

function revocarActivasPorUsuario(usuarioId) {
  const usuarioIdText = ensureText(usuarioId, 'El usuario_id de la sesión de auth');
  db.prepare(`
    UPDATE auth_sesiones
    SET revoked_at = ?
    WHERE usuario_id = ? AND revoked_at IS NULL
  `).run(nowLocalSql(), usuarioIdText);
}

module.exports = {
  crear,
  getActivaByUsuario,
  getById,
  isActiva,
  revocar,
  revocarActivasPorUsuario,
};
