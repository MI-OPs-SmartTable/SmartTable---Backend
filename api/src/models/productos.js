const db = require('../database/db');
const { ensureActive, ensureExists, ensureText, fetchById, newId, normalizeText, ensureNonNegative, ensurePositive } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM productos WHERE activo = 1 ORDER BY nombre').all();
}

function getAllForCatalog() {
  return db.prepare(`
    SELECT p.id, p.categoria_id, p.nombre, p.descripcion, p.emoji, p.activo,
           vp.id AS variante_id, vp.precio
    FROM productos p
    INNER JOIN variantes_producto vp ON vp.producto_id = p.id AND vp.activo = 1
    WHERE p.activo = 1
    ORDER BY p.nombre
  `).all();
}

function getAllWithDetalle() {
  const rows = getAllForCatalog();
  const insumosStmt = db.prepare(`
    SELECT r.insumo_id, r.cantidad_requerida AS cantidad
    FROM recetas r
    WHERE r.variante_id = ?
  `);

  return rows.map((row) => ({
    ...row,
    insumos: insumosStmt.all(row.variante_id),
  }));
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
  const emoji = normalizeText(data.emoji) || '📦';

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
    db.prepare('INSERT INTO productos (id, categoria_id, nombre, descripcion, emoji, activo) VALUES (?, ?, ?, ?, ?, 1)').run(
      id,
      categoriaId,
      nombre,
      descripcion,
      emoji
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
  const emoji = data.emoji !== undefined
    ? (normalizeText(data.emoji) || '📦')
    : (current.emoji || '📦');
  const activo = data.activo !== undefined
    ? (data.activo === true || data.activo === 1 || data.activo === '1' ? 1 : 0)
    : current.activo;

  const updateTx = db.transaction(() => {
    db.prepare('UPDATE productos SET categoria_id = ?, nombre = ?, descripcion = ?, emoji = ?, activo = ? WHERE id = ?').run(
      categoriaId,
      nombre,
      descripcion,
      emoji,
      activo,
      id
    );

    const variante = current.variantes?.[0]
      || db.prepare('SELECT * FROM variantes_producto WHERE producto_id = ? AND activo = 1 ORDER BY nombre LIMIT 1').get(id);

    if (!variante) {
      throw new Error('El producto no tiene una variante activa para actualizar');
    }

    if (data.precio !== undefined) {
      const precioValid = ensureNonNegative(data.precio, 'El precio');
      db.prepare('UPDATE variantes_producto SET precio = ?, nombre = ? WHERE id = ?').run(
        precioValid,
        nombre,
        variante.id
      );
    } else if (data.nombre !== undefined) {
      db.prepare('UPDATE variantes_producto SET nombre = ? WHERE id = ?').run(nombre, variante.id);
    }

    if (Array.isArray(data.insumos)) {
      if (data.insumos.length === 0) {
        throw new Error('Los insumos (ingredientes) deben ser un arreglo no vacío');
      }

      db.prepare('DELETE FROM recetas WHERE variante_id = ?').run(variante.id);

      for (const item of data.insumos) {
        const insumoId = item.insumo_id || item.id || null;
        if (!insumoId) {
          throw new Error('Cada insumo debe incluir insumo_id');
        }

        ensureExists(db, 'insumos', insumoId, 'Insumo');

        const cantidad = item.cantidad !== undefined ? item.cantidad : item.cantidad_requerida;
        if (cantidad === undefined || cantidad === null) {
          throw new Error('Cada insumo debe incluir la cantidad requerida');
        }

        const cantidadValid = ensurePositive(cantidad, 'La cantidad requerida');
        const recetaId = newId();
        db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(
          recetaId,
          variante.id,
          insumoId,
          cantidadValid
        );
      }
    }
  });

  updateTx();

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

module.exports = { create, deactivate, getAll, getAllForCatalog, getAllWithDetalle, getById, update };