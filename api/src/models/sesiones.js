const db = require('../database/db');
const { ensureCajaAbierta, ensureExists, ensureText, fetchById, newId, nowLocalSql } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM sesiones ORDER BY inicio_at DESC').all();
}

function getById(id) {
  return fetchById(db, 'sesiones', id, 'Sesión');
}

function getActivaByUsuario(usuarioId) {
  const usuarioIdText = ensureText(usuarioId, 'El usuario_id de la sesión');

  return db.prepare(
    'SELECT * FROM sesiones WHERE usuario_id = ? AND fin_at IS NULL ORDER BY inicio_at DESC LIMIT 1'
  ).get(usuarioIdText) || null;
}

function getActivasByCaja(cajaId) {
  const cajaIdText = ensureText(cajaId, 'El caja_id de la sesión');

  return db.prepare(
    'SELECT * FROM sesiones WHERE caja_id = ? AND fin_at IS NULL ORDER BY inicio_at DESC'
  ).all(cajaIdText);
}

function getColaboradoresActivosByCaja(cajaId) {
  const cajaIdText = ensureText(cajaId, 'El caja_id de la sesión');

  return db.prepare(`
    SELECT
      s.id AS sesion_id,
      s.usuario_id,
      s.caja_id,
      s.rol_sesion,
      s.inicio_at,
      s.fin_at,
      u.nombre_completo,
      u.email,
      r.nombre AS rol
    FROM sesiones s
    INNER JOIN usuarios u ON u.id = s.usuario_id
    INNER JOIN roles r ON r.id = u.rol_id
    WHERE s.caja_id = ?
      AND s.fin_at IS NULL
      AND s.rol_sesion = 'colaborador'
    ORDER BY s.inicio_at ASC
  `).all(cajaIdText);
}

function usuarioPuedeOperarCaja(usuarioId, cajaId) {
  const sesionActiva = getActivaByUsuario(usuarioId);

  if (!sesionActiva) {
    return false;
  }

  return sesionActiva.caja_id === ensureText(cajaId, 'El caja_id de la sesión');
}

function ensureUsuarioSinSesionActiva(usuarioId) {
  const sesionActiva = getActivaByUsuario(usuarioId);

  if (sesionActiva) {
    throw new Error('El usuario ya tiene una sesión activa');
  }

  return true;
}

function abrirTitular(data) {
  const usuarioId = ensureText(data.usuario_id, 'El usuario_id de la sesión');
  const cajaId = ensureText(data.caja_id, 'El caja_id de la sesión');
  const inicioAt = data.inicio_at ? String(data.inicio_at).trim() : nowLocalSql();

  ensureExists(db, 'usuarios', usuarioId, 'Usuario');
  ensureCajaAbierta(db, cajaId);
  ensureUsuarioSinSesionActiva(usuarioId);

  const id = newId();
  db.prepare(
    'INSERT INTO sesiones (id, usuario_id, caja_id, rol_sesion, inicio_at, fin_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    usuarioId,
    cajaId,
    'titular',
    inicioAt,
    null
  );

  return getById(id);
}

function agregarColaborador(cajaId, usuarioId, data) {
  const cajaIdText = ensureText(cajaId, 'El caja_id de la sesión');
  const usuarioIdText = ensureText(usuarioId, 'El usuario_id de la sesión');
  const inicioAt = data && data.inicio_at ? String(data.inicio_at).trim() : nowLocalSql();

  ensureExists(db, 'usuarios', usuarioIdText, 'Usuario');
  ensureCajaAbierta(db, cajaIdText);
  ensureUsuarioSinSesionActiva(usuarioIdText);

  const id = newId();
  db.prepare(
    'INSERT INTO sesiones (id, usuario_id, caja_id, rol_sesion, inicio_at, fin_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    usuarioIdText,
    cajaIdText,
    'colaborador',
    inicioAt,
    null
  );

  return getById(id);
}

function cerrarSesion(id, data) {
  const current = getById(id);
  const finAt = data && data.fin_at !== undefined ? String(data.fin_at).trim() : nowLocalSql();

  db.prepare('UPDATE sesiones SET fin_at = ? WHERE id = ?').run(finAt, id);
  return getById(id);
}

function cerrarPorCaja(cajaId, finAt) {
  const cajaIdText = ensureText(cajaId, 'El caja_id de la sesión');
  const cierreAt = finAt !== undefined && finAt !== null ? String(finAt).trim() : nowLocalSql();

  db.prepare('UPDATE sesiones SET fin_at = ? WHERE caja_id = ? AND fin_at IS NULL').run(cierreAt, cajaIdText);
  return getActivasByCaja(cajaIdText);
}

module.exports = {
  abrirTitular,
  agregarColaborador,
  cerrarPorCaja,
  cerrarSesion,
  getActivaByUsuario,
  getActivasByCaja,
  getColaboradoresActivosByCaja,
  getAll,
  getById,
  usuarioPuedeOperarCaja,
};