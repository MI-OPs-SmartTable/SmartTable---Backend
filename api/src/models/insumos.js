const db = require('../database/db');
const {
  ensureExists,
  ensureNonNegative,
  ensurePositive,
  ensureText,
  fetchById,
  newId,
} = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM insumos WHERE activo = 1 ORDER BY nombre').all();
}

function getById(id) {
  return fetchById(db, 'insumos', id, 'Insumo');
}

function getDefaultProveedorId() {
  const row = db.prepare('SELECT id FROM proveedores WHERE activo = 1 ORDER BY nombre_empresa LIMIT 1').get();
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
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO insumos (id, proveedor_id, nombre, unidad, cantidad_actual, stock_minimo, costo_unitario, activo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
    ).run(id, proveedorId, nombre, unidad, cantidadActual, stockMinimo, costoUnitario);

    if (cantidadActual > 0) {
      insertMovimiento({
        insumoId: id,
        proveedorId,
        tipo: 'agregar',
        cantidad: cantidadActual,
        cantidadAnterior: 0,
        cantidadNueva: cantidadActual,
        costoUnitario,
      });
    }
  });
  tx();

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

function getResumenInventario() {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN cantidad_actual <= stock_minimo THEN 1 ELSE 0 END), 0) AS stock_bajo,
      COALESCE(SUM(CASE WHEN cantidad_actual > stock_minimo THEN 1 ELSE 0 END), 0) AS stock_ok,
      COALESCE(SUM(cantidad_actual * costo_unitario), 0) AS valor_inventario
    FROM insumos
    WHERE activo = 1
  `).get();

  return {
    total: Number(row?.total ?? 0),
    stock_bajo: Number(row?.stock_bajo ?? 0),
    stock_ok: Number(row?.stock_ok ?? 0),
    valor_inventario: Number(row?.valor_inventario ?? 0),
  };
}

function insertMovimiento({
  insumoId,
  proveedorId,
  tipo,
  cantidad,
  cantidadAnterior,
  cantidadNueva,
  costoUnitario,
}) {
  const total = tipo === 'agregar' ? cantidad * costoUnitario : 0;
  const id = newId();
  db.prepare(`
    INSERT INTO compras_insumo (
      id, insumo_id, proveedor_id, tipo, cantidad, cantidad_anterior, cantidad_nueva, costo_unitario, total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    insumoId,
    proveedorId || null,
    tipo,
    cantidad,
    cantidadAnterior,
    cantidadNueva,
    costoUnitario,
    total
  );
  return id;
}

function listCompras(insumoId) {
  ensureExists(db, 'insumos', insumoId, 'Insumo');
  return db.prepare(`
    SELECT
      c.id,
      c.insumo_id,
      c.proveedor_id,
      c.tipo,
      c.cantidad,
      c.cantidad_anterior,
      c.cantidad_nueva,
      c.costo_unitario,
      c.total,
      c.created_at,
      p.nombre_empresa AS proveedor_nombre
    FROM compras_insumo c
    LEFT JOIN proveedores p ON p.id = c.proveedor_id
    WHERE c.insumo_id = ?
    ORDER BY datetime(c.created_at) DESC, c.rowid DESC
  `).all(insumoId);
}

/**
 * Movimiento de stock: compra (agregar) o ajuste (fijar).
 * body: { tipo: 'agregar'|'fijar', cantidad, proveedor_id?, costo_unitario? }
 */
function registrarMovimiento(insumoId, data) {
  const current = getById(insumoId);
  const tipo = ensureText(data.tipo, 'El tipo de movimiento').toLowerCase();
  if (tipo !== 'agregar' && tipo !== 'fijar') {
    throw new Error("El tipo debe ser 'agregar' o 'fijar'");
  }

  let proveedorId = current.proveedor_id;
  if (data.proveedor_id !== undefined && data.proveedor_id !== null && String(data.proveedor_id).trim() !== '') {
    proveedorId = ensureText(data.proveedor_id, 'El proveedor_id');
    ensureExists(db, 'proveedores', proveedorId, 'Proveedor');
  }

  let costoUnitario = current.costo_unitario;
  if (data.costo_unitario !== undefined && data.costo_unitario !== null && String(data.costo_unitario).trim() !== '') {
    costoUnitario = ensureNonNegative(data.costo_unitario, 'El costo unitario');
  }

  const cantidadAnterior = Number(current.cantidad_actual) || 0;
  let cantidad;
  let cantidadNueva;

  if (tipo === 'agregar') {
    cantidad = ensurePositive(data.cantidad, 'La cantidad a agregar');
    cantidadNueva = cantidadAnterior + cantidad;
  } else {
    cantidadNueva = ensureNonNegative(data.cantidad, 'La nueva cantidad');
    cantidad = cantidadNueva;
  }

  const tx = db.transaction(() => {
    db.prepare(
      'UPDATE insumos SET cantidad_actual = ?, costo_unitario = ?, proveedor_id = ? WHERE id = ?'
    ).run(cantidadNueva, costoUnitario, proveedorId, insumoId);

    insertMovimiento({
      insumoId,
      proveedorId,
      tipo,
      cantidad,
      cantidadAnterior,
      cantidadNueva,
      costoUnitario,
    });
  });
  tx();

  return {
    insumo: getById(insumoId),
    compras: listCompras(insumoId),
  };
}

module.exports = {
  create,
  deactivate,
  getAll,
  getById,
  getInsumosConStockBajo,
  getResumenInventario,
  listCompras,
  registrarMovimiento,
  update,
};
