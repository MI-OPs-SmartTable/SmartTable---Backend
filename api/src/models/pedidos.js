const db = require('../database/db');
const {
  ensureCajaAbierta,
  ensureExists,
  ensureNonNegative,
  ensurePositive,
  ensureText,
  fetchById,
  newId,
} = require('./_utils');

const ESTADOS_PEDIDO = ['abierto', 'enviado', 'listo', 'pagado', 'cancelado'];

function getAll() {
  return db.prepare('SELECT * FROM pedidos ORDER BY created_at DESC').all();
}

function getById(id) {
  const pedido = fetchById(db, 'pedidos', id, 'Pedido');
  const items = db.prepare(
    'SELECT ip.*, vp.nombre AS variante_nombre FROM items_pedido ip INNER JOIN variantes_producto vp ON vp.id = ip.variante_id WHERE ip.pedido_id = ? ORDER BY ip.id'
  ).all(id);
  return { ...pedido, items };
}

function getPedidoConItems(id) {
  return getById(id);
}

function validateStockForItems(items) {
  const variantTotals = new Map();

  for (const item of items) {
    const varianteId = ensureText(item.variante_id, 'La variante_id del item');
    const cantidad = ensurePositive(item.cantidad, 'La cantidad del item');
    variantTotals.set(varianteId, (variantTotals.get(varianteId) || 0) + cantidad);
  }

  const variantIds = Array.from(variantTotals.keys());
  if (variantIds.length === 0) {
    throw new Error('Debe enviar al menos un item para crear el pedido');
  }

  const placeholderList = variantIds.map(() => '?').join(', ');
  const recipeRows = db.prepare(
    'SELECT r.variante_id, r.insumo_id, r.cantidad_requerida, i.nombre AS insumo_nombre, i.cantidad_actual FROM recetas r INNER JOIN insumos i ON i.id = r.insumo_id WHERE r.variante_id IN (' + placeholderList + ')'
  ).all(...variantIds);

  const requiredByInsumo = new Map();

  for (const row of recipeRows) {
    const cantidadPedido = variantTotals.get(row.variante_id) || 0;
    if (cantidadPedido <= 0) {
      continue;
    }

    const required = cantidadPedido * Number(row.cantidad_requerida);
    requiredByInsumo.set(row.insumo_id, (requiredByInsumo.get(row.insumo_id) || 0) + required);
  }

  for (const [insumoId, required] of requiredByInsumo.entries()) {
    const insumo = db.prepare('SELECT id, nombre, cantidad_actual FROM insumos WHERE id = ?').get(insumoId);
    if (!insumo) {
      throw new Error('Insumo no encontrado: ' + insumoId);
    }

    if (Number(insumo.cantidad_actual) < required) {
      throw new Error('Stock insuficiente para ' + insumo.nombre + ': requerido ' + required + ', disponible ' + insumo.cantidad_actual);
    }
  }

  for (const varianteId of variantIds) {
    const variant = db.prepare('SELECT id, nombre, precio, activo FROM variantes_producto WHERE id = ?').get(varianteId);
    if (!variant || variant.activo !== 1) {
      throw new Error('Variante de producto no encontrada o inactiva: ' + varianteId);
    }
  }
}

function create(data) {
  const usuarioId = ensureText(data.usuario_id, 'El usuario_id del pedido');
  const cajaId = ensureText(data.caja_id, 'El caja_id del pedido');
  const mesaId = data.mesa_id === undefined || data.mesa_id === null || String(data.mesa_id).trim() === ''
    ? null
    : ensureText(data.mesa_id, 'La mesa_id del pedido');
  const items = Array.isArray(data.items) ? data.items : [];

  ensureExists(db, 'usuarios', usuarioId, 'Usuario');
  ensureCajaAbierta(db, cajaId);
  if (mesaId) {
    ensureExists(db, 'mesas', mesaId, 'Mesa');
  }

  validateStockForItems(items);

  const createPedidoTransaction = db.transaction((payload) => {
    const pedidoId = newId();

    db.prepare('INSERT INTO pedidos (id, mesa_id, usuario_id, caja_id, estado) VALUES (?, ?, ?, ?, ?)').run(
      pedidoId,
      payload.mesaId,
      payload.usuarioId,
      payload.cajaId,
      'abierto'
    );

    for (const item of payload.items) {
      const varianteId = ensureText(item.variante_id, 'La variante_id del item');
      const variante = db.prepare('SELECT id, nombre, precio, activo FROM variantes_producto WHERE id = ?').get(varianteId);
      if (!variante || variante.activo !== 1) {
        throw new Error('Variante de producto no encontrada o inactiva: ' + varianteId);
      }

      const cantidad = ensurePositive(item.cantidad, 'La cantidad del item');
      const precioUnitario = item.precio_unitario !== undefined
        ? ensureNonNegative(item.precio_unitario, 'El precio unitario del item')
        : Number(variante.precio);

      db.prepare(
        'INSERT INTO items_pedido (id, pedido_id, variante_id, cantidad, precio_unitario, estado) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(newId(), pedidoId, varianteId, cantidad, precioUnitario, 'pendiente');
    }

    return getPedidoConItems(pedidoId);
  });

  return createPedidoTransaction({ usuarioId, cajaId, mesaId, items });
}

function updateEstado(id, estado) {
  const pedido = getById(id);
  const nuevoEstado = ensureText(estado, 'El estado del pedido');

  if (!ESTADOS_PEDIDO.includes(nuevoEstado)) {
    throw new Error('Estado de pedido inválido: ' + nuevoEstado);
  }

  db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(nuevoEstado, id);
  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const mesaId = data.mesa_id !== undefined
    ? (data.mesa_id === null || String(data.mesa_id).trim() === '' ? null : ensureText(data.mesa_id, 'La mesa_id del pedido'))
    : current.mesa_id;
  const usuarioId = data.usuario_id !== undefined ? ensureText(data.usuario_id, 'El usuario_id del pedido') : current.usuario_id;
  const cajaId = data.caja_id !== undefined ? ensureText(data.caja_id, 'El caja_id del pedido') : current.caja_id;
  const estado = data.estado !== undefined ? ensureText(data.estado, 'El estado del pedido') : current.estado;

  if (mesaId) {
    ensureExists(db, 'mesas', mesaId, 'Mesa');
  }
  if (data.usuario_id !== undefined) {
    ensureExists(db, 'usuarios', usuarioId, 'Usuario');
  }
  if (data.caja_id !== undefined) {
    ensureCajaAbierta(db, cajaId);
  }
  if (!ESTADOS_PEDIDO.includes(estado)) {
    throw new Error('Estado de pedido inválido: ' + estado);
  }

  db.prepare('UPDATE pedidos SET mesa_id = ?, usuario_id = ?, caja_id = ?, estado = ? WHERE id = ?').run(
    mesaId,
    usuarioId,
    cajaId,
    estado,
    id
  );

  return getPedidoConItems(id);
}

function cancel(id) {
  const current = getById(id);
  if (current.estado === 'cancelado') {
    return getPedidoConItems(id);
  }

  db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run('cancelado', id);
  return getPedidoConItems(id);
}

module.exports = { cancel, create, getAll, getById, getPedidoConItems, update, updateEstado };