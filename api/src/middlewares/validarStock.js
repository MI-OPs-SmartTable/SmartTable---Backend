const db = require('../database/db');

function validarStock(req, res, next) {
  try {
    const items = req.body && req.body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items requeridos' });
    }

    const consumoPorInsumo = new Map();

    for (const item of items) {
      if (!item || !item.variante_id || item.cantidad === undefined || item.cantidad === null) {
        return res.status(400).json({ error: 'items requeridos' });
      }

      const cantidadItem = Number(item.cantidad);

      if (!Number.isFinite(cantidadItem) || cantidadItem <= 0) {
        return res.status(400).json({ error: 'items requeridos' });
      }

      const recetas = db.prepare(
        `
          SELECT
            recetas.insumo_id,
            recetas.cantidad_requerida,
            insumos.nombre,
            insumos.cantidad_actual
          FROM recetas
          INNER JOIN insumos ON insumos.id = recetas.insumo_id
          WHERE recetas.variante_id = ?
        `
      ).all(item.variante_id);

      for (const receta of recetas) {
        const consumoActual = consumoPorInsumo.get(receta.insumo_id) || 0;
        consumoPorInsumo.set(
          receta.insumo_id,
          consumoActual + (Number(receta.cantidad_requerida) * cantidadItem)
        );
      }
    }

    for (const [insumoId, requerido] of consumoPorInsumo.entries()) {
      const insumo = db.prepare('SELECT id, nombre, cantidad_actual FROM insumos WHERE id = ?').get(insumoId);

      if (!insumo) {
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }

      if (Number(insumo.cantidad_actual) < requerido) {
        return res.status(400).json({
          error: 'Stock insuficiente',
          insumo: insumo.nombre,
          disponible: insumo.cantidad_actual,
          requerido,
        });
      }
    }

    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = validarStock;