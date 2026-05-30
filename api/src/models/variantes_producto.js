const db = require('../database/db');
const { ensureActive, ensureExists, ensureNonNegative, ensureText, fetchById, newId, normalizeText } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM variantes_producto WHERE activo = 1 ORDER BY nombre').all();
}

function getById(id) {
  return fetchById(db, 'variantes_producto', id, 'Variante de producto');
}

function getByProducto(productoId) {
  ensureExists(db, 'productos', productoId, 'Producto');
  return db.prepare('SELECT * FROM variantes_producto WHERE producto_id = ? AND activo = 1 ORDER BY nombre').all(productoId);
}

function create(data) {
  const productoId = ensureText(data.producto_id, 'El producto_id de la variante');
  ensureExists(db, 'productos', productoId, 'Producto');

  const nombre = ensureText(data.nombre, 'El nombre de la variante');
  const precio = ensureNonNegative(data.precio, 'El precio de la variante');

  const id = newId();
  db.prepare('INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, 1)').run(
    id,
    productoId,
    nombre,
    precio
  );

  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const productoId = data.producto_id !== undefined ? ensureText(data.producto_id, 'El producto_id de la variante') : current.producto_id;
  if (data.producto_id !== undefined) {
    ensureExists(db, 'productos', productoId, 'Producto');
  }

  const nombre = data.nombre !== undefined ? ensureText(data.nombre, 'El nombre de la variante') : current.nombre;
  const precio = data.precio !== undefined ? ensureNonNegative(data.precio, 'El precio de la variante') : current.precio;

  db.prepare('UPDATE variantes_producto SET producto_id = ?, nombre = ?, precio = ? WHERE id = ?').run(
    productoId,
    nombre,
    precio,
    id
  );

  return getById(id);
}

function deactivate(id) {
  const current = getById(id);
  if (current.activo === 0) {
    return current;
  }

  db.prepare('UPDATE variantes_producto SET activo = 0 WHERE id = ?').run(id);
  return getById(id);
}

module.exports = { create, deactivate, getAll, getById, getByProducto, update };