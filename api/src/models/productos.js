const db = require('../database/db');
const { ensureActive, ensureExists, ensureText, fetchById, newId, normalizeText } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM productos WHERE activo = 1 ORDER BY nombre').all();
}

function getById(id) {
  const producto = fetchById(db, 'productos', id, 'Producto');
  const variantes = db.prepare('SELECT * FROM variantes_producto WHERE producto_id = ? AND activo = 1 ORDER BY nombre').all(id);
  return { ...producto, variantes };
}

function create(data) {
  const categoriaId = ensureText(data.categoria_id, 'La categoria_id del producto');
  ensureExists(db, 'categorias', categoriaId, 'Categoría');

  const nombre = ensureText(data.nombre, 'El nombre del producto');
  const descripcion = normalizeText(data.descripcion);

  const id = newId();
  db.prepare('INSERT INTO productos (id, categoria_id, nombre, descripcion, activo) VALUES (?, ?, ?, ?, 1)').run(
    id,
    categoriaId,
    nombre,
    descripcion
  );

  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const categoriaId = data.categoria_id !== undefined ? ensureText(data.categoria_id, 'La categoria_id del producto') : current.categoria_id;
  if (data.categoria_id !== undefined) {
    ensureExists(db, 'categorias', categoriaId, 'Categoría');
  }

  const nombre = data.nombre !== undefined ? ensureText(data.nombre, 'El nombre del producto') : current.nombre;
  const descripcion = data.descripcion !== undefined ? normalizeText(data.descripcion) : current.descripcion;

  db.prepare('UPDATE productos SET categoria_id = ?, nombre = ?, descripcion = ? WHERE id = ?').run(
    categoriaId,
    nombre,
    descripcion,
    id
  );

  return getById(id);
}

function deactivate(id) {
  const current = getById(id);
  if (current.activo === 0) {
    return current;
  }

  db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(id);
  return getById(id);
}

module.exports = { create, deactivate, getAll, getById, update };