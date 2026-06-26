const db = require('../database/db');
const {
  ensureActive,
  ensureExists,
  ensureNonNegative,
  ensureText,
  fetchById,
  newId,
  normalizeText,
} = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM insumos WHERE activo = 1 ORDER BY nombre').all();
}

function getById(id) {
  return fetchById(db, 'insumos', id, 'Insumo');
}

function getDefaultProveedorId() {
  const row = db.prepare('SELECT id FROM proveedores WHERE activo = 1 ORDER BY nombre LIMIT 1').get();
  if (!row) {
    throw new Error('No hay proveedores registrados. Cree un proveedor antes de agregar insumos.');
  }
  return row.id;
}

function create(data) {
  const proveedorId = data.proveedor_id !== undefined && data.proveedor_id !== null && String(data.proveedor_id).trim() !== ''
    ? ensureText(data.proveedor_id, 'El proveedor_id del insumo')
    : getDefaultProveedorId();
  ensureExists(db, 'proveedores', proveedorId, 'Proveedor');

  const nombre = ensureText(data.nombre, 'El nombre del insumo');
  const unidad = ensureText(data.unidad, 'La unidad del insumo');
  const cantidadActual = ensureNonNegative(data.cantidad_actual ?? 0, 'La cantidad actual');
  const stockMinimo = ensureNonNegative(data.stock_minimo ?? 0, 'El stock mínimo');
  const costoUnitario = ensureNonNegative(data.costo_unitario ?? 0, 'El costo unitario');

  const id = newId();
  db.prepare(
    'INSERT INTO insumos (id, proveedor_id, nombre, unidad, cantidad_actual, stock_minimo, costo_unitario, activo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  ).run(id, proveedorId, nombre, unidad, cantidadActual, stockMinimo, costoUnitario);

  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const proveedorId = data.proveedor_id !== undefined ? ensureText(data.proveedor_id, 'El proveedor_id del insumo') : current.proveedor_id;
  if (data.proveedor_id !== undefined) {
    ensureExists(db, 'proveedores', proveedorId, 'Proveedor');
  }

  const nombre = data.nombre !== undefined ? ensureText(data.nombre, 'El nombre del insumo') : current.nombre;
  const unidad = data.unidad !== undefined ? ensureText(data.unidad, 'La unidad del insumo') : current.unidad;
  const cantidadActual = data.cantidad_actual !== undefined ? ensureNonNegative(data.cantidad_actual, 'La cantidad actual') : current.cantidad_actual;
  const stockMinimo = data.stock_minimo !== undefined ? ensureNonNegative(data.stock_minimo, 'El stock mínimo') : current.stock_minimo;
  const costoUnitario = data.costo_unitario !== undefined ? ensureNonNegative(data.costo_unitario, 'El costo unitario') : current.costo_unitario;

  db.prepare(
    'UPDATE insumos SET proveedor_id = ?, nombre = ?, unidad = ?, cantidad_actual = ?, stock_minimo = ?, costo_unitario = ? WHERE id = ?'
  ).run(proveedorId, nombre, unidad, cantidadActual, stockMinimo, costoUnitario, id);

  return getById(id);
}

function deactivate(id) {
  const current = getById(id);
  if (current.activo === 0) {
    return current;
  }

  db.prepare('UPDATE insumos SET activo = 0 WHERE id = ?').run(id);
  return getById(id);
}

function getInsumosConStockBajo() {
  return db.prepare(
    'SELECT * FROM insumos WHERE activo = 1 AND cantidad_actual <= stock_minimo ORDER BY (stock_minimo - cantidad_actual) DESC, nombre'
  ).all();
}

module.exports = { create, deactivate, getAll, getById, getInsumosConStockBajo, update };