const db = require('../database/db');
const { ensureCajaAbierta, ensureExists, ensureNonNegative, ensurePositive, ensureText, fetchById, newId } = require('./_utils');

const ESTADOS_ITEM = ['pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado'];

function getAll() {
  return db.prepare('SELECT * FROM items_pedido ORDER BY id').all();
}

function getById(id) {
  return fetchById(db, 'items_pedido', id, 'Item de pedido');
}

function getByPedido(pedidoId) {
  ensureExists(db, 'pedidos', pedidoId, 'Pedido');
  return db.prepare(
    'SELECT ip.*, vp.nombre AS variante_nombre FROM items_pedido ip INNER JOIN variantes_producto vp ON vp.id = ip.variante_id WHERE ip.pedido_id = ? ORDER BY ip.id'
  ).all(pedidoId);
}

function create(data) {
  const pedidoId = ensureText(data.pedido_id, 'El pedido_id del item');
  const varianteId = ensureText(data.variante_id, 'La variante_id del item');
  ensureExists(db, 'pedidos', pedidoId, 'Pedido');
  ensureExists(db, 'variantes_producto', varianteId, 'Variante de producto');

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
  if (!pedido) {
    throw new Error('Pedido no encontrado: ' + pedidoId);
  }
  ensureCajaAbierta(db, pedido.caja_id);
  if (pedido.estado === 'cancelado' || pedido.estado === 'pagado') {
    throw new Error('No se pueden agregar items a un pedido finalizado: ' + pedidoId);
  }

  const cantidad = ensurePositive(data.cantidad, 'La cantidad del item');
  const variante = db.prepare('SELECT precio FROM variantes_producto WHERE id = ?').get(varianteId);
  const precioUnitario = data.precio_unitario !== undefined
    ? ensureNonNegative(data.precio_unitario, 'El precio unitario del item')
    : Number(variante.precio);
  const estado = data.estado !== undefined ? ensureText(data.estado, 'El estado del item') : 'pendiente';

  if (!ESTADOS_ITEM.includes(estado)) {
    throw new Error('Estado de item inválido: ' + estado);
  }

  const id = newId();
  db.prepare('INSERT INTO items_pedido (id, pedido_id, variante_id, cantidad, precio_unitario, estado) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    pedidoId,
    varianteId,
    cantidad,
    precioUnitario,
    estado
  );

  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const pedidoId = data.pedido_id !== undefined ? ensureText(data.pedido_id, 'El pedido_id del item') : current.pedido_id;
  const varianteId = data.variante_id !== undefined ? ensureText(data.variante_id, 'La variante_id del item') : current.variante_id;

  if (data.pedido_id !== undefined) {
    ensureExists(db, 'pedidos', pedidoId, 'Pedido');
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!pedido) {
      throw new Error('Pedido no encontrado: ' + pedidoId);
    }
    ensureCajaAbierta(db, pedido.caja_id);
  }
  if (data.variante_id !== undefined) {
    ensureExists(db, 'variantes_producto', varianteId, 'Variante de producto');
  }

  const cantidad = data.cantidad !== undefined ? ensurePositive(data.cantidad, 'La cantidad del item') : current.cantidad;
  const precioUnitario = data.precio_unitario !== undefined ? ensureNonNegative(data.precio_unitario, 'El precio unitario del item') : current.precio_unitario;
  const estado = data.estado !== undefined ? ensureText(data.estado, 'El estado del item') : current.estado;

  if (!ESTADOS_ITEM.includes(estado)) {
    throw new Error('Estado de item inválido: ' + estado);
  }

  db.prepare('UPDATE items_pedido SET pedido_id = ?, variante_id = ?, cantidad = ?, precio_unitario = ?, estado = ? WHERE id = ?').run(
    pedidoId,
    varianteId,
    cantidad,
    precioUnitario,
    estado,
    id
  );

  return getById(id);
}

function updateEstado(id, estado) {
  const current = getById(id);
  const nuevoEstado = ensureText(estado, 'El estado del item');

  if (!ESTADOS_ITEM.includes(nuevoEstado)) {
    throw new Error('Estado de item inválido: ' + nuevoEstado);
  }

  db.prepare('UPDATE items_pedido SET estado = ? WHERE id = ?').run(nuevoEstado, id);
  return getById(id);
}

function remove(id) {
  const current = getById(id);
  db.prepare('DELETE FROM items_pedido WHERE id = ?').run(id);
  return current;
}

module.exports = { create, getAll, getById, getByPedido, remove, update, updateEstado };