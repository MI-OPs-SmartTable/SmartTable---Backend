const db = require('../database/db');
const { ensureExists, ensurePositive, ensureText, fetchById, newId } = require('./_utils');

function getAll() {
  return db.prepare(
    'SELECT r.*, vp.nombre AS variante_nombre, i.nombre AS insumo_nombre FROM recetas r INNER JOIN variantes_producto vp ON vp.id = r.variante_id INNER JOIN insumos i ON i.id = r.insumo_id ORDER BY vp.nombre, i.nombre'
  ).all();
}

function getById(id) {
  return fetchById(db, 'recetas', id, 'Receta');
}

function getByVariante(varianteId) {
  ensureExists(db, 'variantes_producto', varianteId, 'Variante de producto');
  return db.prepare(
    'SELECT r.*, i.nombre AS insumo_nombre FROM recetas r INNER JOIN insumos i ON i.id = r.insumo_id WHERE r.variante_id = ? ORDER BY i.nombre'
  ).all(varianteId);
}

function create(data) {
  const varianteId = ensureText(data.variante_id, 'La variante_id de la receta');
  const insumoId = ensureText(data.insumo_id, 'El insumo_id de la receta');
  ensureExists(db, 'variantes_producto', varianteId, 'Variante de producto');
  ensureExists(db, 'insumos', insumoId, 'Insumo');

  const cantidadRequerida = ensurePositive(data.cantidad_requerida, 'La cantidad requerida');

  const duplicate = db.prepare('SELECT id FROM recetas WHERE variante_id = ? AND insumo_id = ?').get(varianteId, insumoId);
  if (duplicate) {
    db.prepare('UPDATE recetas SET cantidad_requerida = ? WHERE id = ?').run(cantidadRequerida, duplicate.id);
    return getById(duplicate.id);
  }

  const id = newId();
  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(
    id,
    varianteId,
    insumoId,
    cantidadRequerida
  );

  return getById(id);
}

function upsert(data) {
  return create(data);
}

function update(id, data) {
  const current = getById(id);
  const varianteId = data.variante_id !== undefined ? ensureText(data.variante_id, 'La variante_id de la receta') : current.variante_id;
  const insumoId = data.insumo_id !== undefined ? ensureText(data.insumo_id, 'El insumo_id de la receta') : current.insumo_id;
  if (data.variante_id !== undefined) {
    ensureExists(db, 'variantes_producto', varianteId, 'Variante de producto');
  }
  if (data.insumo_id !== undefined) {
    ensureExists(db, 'insumos', insumoId, 'Insumo');
  }

  const cantidadRequerida = data.cantidad_requerida !== undefined
    ? ensurePositive(data.cantidad_requerida, 'La cantidad requerida')
    : current.cantidad_requerida;

  const duplicate = db.prepare('SELECT id FROM recetas WHERE variante_id = ? AND insumo_id = ? AND id <> ?').get(varianteId, insumoId, id);
  if (duplicate) {
    throw new Error('Receta duplicada para la variante e insumo indicados');
  }

  db.prepare('UPDATE recetas SET variante_id = ?, insumo_id = ?, cantidad_requerida = ? WHERE id = ?').run(
    varianteId,
    insumoId,
    cantidadRequerida,
    id
  );

  return getById(id);
}

function remove(id) {
  const current = getById(id);
  db.prepare('DELETE FROM recetas WHERE id = ?').run(id);
  return current;
}

function removeByVarianteInsumo(varianteId, insumoId) {
  const receta = db.prepare('SELECT * FROM recetas WHERE variante_id = ? AND insumo_id = ?').get(varianteId, insumoId);
  if (!receta) {
    return null;
  }

  db.prepare('DELETE FROM recetas WHERE id = ?').run(receta.id);
  return receta;
}

module.exports = { create, getAll, getById, getByVariante, remove, removeByVarianteInsumo, upsert, update };