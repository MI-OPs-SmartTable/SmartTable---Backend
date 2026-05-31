const db = require('../database/db');
const { ensureActive, ensureExists, ensureText, fetchById, newId, normalizeText, ensureNonNegative, ensurePositive } = require('./_utils');

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

  // precio obligatorio al crear según el nuevo diseño (permitir 0)
  const precio = typeof data.precio === 'undefined' ? null : data.precio;
  if (precio === null) {
    throw new Error('El precio del producto es obligatorio');
  }
  const precioValid = ensureNonNegative(precio, 'El precio');

  // insumos obligatorios: array de { insumo_id, cantidad }
  const insumos = data.insumos;
  if (!Array.isArray(insumos) || insumos.length === 0) {
    throw new Error('Los insumos (ingredientes) son obligatorios y deben ser un arreglo no vacío');
  }

  const id = newId();

  // Usar transacción para insertar producto, variante por defecto y recetas
  const createTx = db.transaction(() => {
    db.prepare('INSERT INTO productos (id, categoria_id, nombre, descripcion, activo) VALUES (?, ?, ?, ?, 1)').run(
      id,
      categoriaId,
      nombre,
      descripcion
    );

    // Crear una variante por defecto del producto que contiene el precio
    const varianteId = newId();
    const varianteNombre = data.variante_nombre || nombre;
    db.prepare('INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, 1)').run(
      varianteId,
      id,
      varianteNombre,
      precioValid
    );

    // Insertar recetas (insumos necesarios) para la variante
    for (const item of insumos) {
      const insumoId = item.insumo_id || item.id || null;
      if (!insumoId) {
        throw new Error('Cada insumo debe incluir insumo_id');
      }

      // validar existencia del insumo
      ensureExists(db, 'insumos', insumoId, 'Insumo');

      const cantidad = item.cantidad !== undefined ? item.cantidad : item.cantidad_requerida;
      if (cantidad === undefined || cantidad === null) {
        throw new Error('Cada insumo debe incluir la cantidad requerida');
      }

      const cantidadValid = ensurePositive(cantidad, 'La cantidad requerida');

      const recetaId = newId();
      db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(
        recetaId,
        varianteId,
        insumoId,
        cantidadValid
      );
    }
  });

  createTx();

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