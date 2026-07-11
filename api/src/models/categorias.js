const db = require('../database/db');
const { ensureText, fetchById, newId, normalizeText } = require('./_utils');

const DEFAULT_EMOJI = '📦';

function normalizeEmoji(value) {
  const emoji = normalizeText(value);
  return emoji || DEFAULT_EMOJI;
}

function getAll() {
  return db.prepare('SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre').all();
}

function getById(id) {
  return fetchById(db, 'categorias', id, 'Categoría');
}

function create(data) {
  const nombre = ensureText(data.nombre, 'El nombre de la categoría');
  const emoji = normalizeEmoji(data.emoji);

  const duplicate = db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre);
  if (duplicate) {
    throw new Error('Categoría duplicada: ' + nombre);
  }

  const id = newId();
  db.prepare('INSERT INTO categorias (id, nombre, emoji, activo) VALUES (?, ?, ?, 1)').run(id, nombre, emoji);
  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const nombre = data.nombre !== undefined ? ensureText(data.nombre, 'El nombre de la categoría') : current.nombre;
  const emoji = data.emoji !== undefined ? normalizeEmoji(data.emoji) : (current.emoji || DEFAULT_EMOJI);

  const duplicate = db.prepare('SELECT id FROM categorias WHERE nombre = ? AND id <> ?').get(nombre, id);
  if (duplicate) {
    throw new Error('Categoría duplicada: ' + nombre);
  }

  db.prepare('UPDATE categorias SET nombre = ?, emoji = ? WHERE id = ?').run(nombre, emoji, id);
  return getById(id);
}

function deactivate(id) {
  const current = getById(id);
  if (current.activo === 0) {
    return current;
  }

  db.prepare('UPDATE categorias SET activo = 0 WHERE id = ?').run(id);
  return getById(id);
}

module.exports = { create, deactivate, getAll, getById, update };
