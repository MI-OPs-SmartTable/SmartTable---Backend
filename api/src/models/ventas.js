const db = require('../database/db');
const { ensureCajaAbierta, ensureExists, ensureNonNegative, ensureText, fetchById, newId } = require('./_utils');

const METODOS_PAGO = ['efectivo', 'transferencia', 'mixto'];

function getAll() {
  return db.prepare('SELECT * FROM ventas ORDER BY pagado_at DESC').all();
}

function getById(id) {
  return fetchById(db, 'ventas', id, 'Venta');
}

function create(data) {
  const pedidoId = ensureText(data.pedido_id, 'El pedido_id de la venta');
  const cajaId = ensureText(data.caja_id, 'El caja_id de la venta');
  ensureCajaAbierta(db, cajaId);

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
  if (!pedido) {
    throw new Error('Pedido no encontrado: ' + pedidoId);
  }
  if (pedido.estado === 'pagado') {
    throw new Error('El pedido ya fue pagado: ' + pedidoId);
  }
  if (pedido.estado === 'cancelado') {
    throw new Error('No se puede vender un pedido cancelado: ' + pedidoId);
  }

  const pagos = data.pagos && typeof data.pagos === 'object' ? data.pagos : null;
  if (!pagos) {
    throw new Error('pagos es obligatorio');
  }

  const montoEfectivo = ensureNonNegative(pagos.monto_efectivo ?? 0, 'El monto en efectivo');
  const montoTransferencia = ensureNonNegative(pagos.monto_transferencia ?? 0, 'El monto por transferencia');
  const total = db.prepare('SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total FROM items_pedido WHERE pedido_id = ?').get(pedidoId).total;
  const metodoPago = montoEfectivo > 0 && montoTransferencia > 0
    ? 'mixto'
    : montoEfectivo > 0
      ? 'efectivo'
      : montoTransferencia > 0
        ? 'transferencia'
        : null;

  if (!metodoPago) {
    throw new Error('El pago debe incluir efectivo, transferencia o ambos');
  }

  if (!METODOS_PAGO.includes(metodoPago)) {
    throw new Error('Método de pago inválido: ' + metodoPago);
  }

  const sumaMontos = montoEfectivo + montoTransferencia;
  if (Math.abs(sumaMontos - total) > 0.000001) {
    throw new Error('El total de la venta no coincide con los montos registrados');
  }

  if (metodoPago === 'efectivo' && montoTransferencia !== 0) {
    throw new Error('La venta en efectivo no debe incluir transferencia');
  }
  if (metodoPago === 'transferencia' && montoEfectivo !== 0) {
    throw new Error('La venta por transferencia no debe incluir efectivo');
  }

  const createVentaTransaction = db.transaction((payload) => {
    const ventaId = newId();

    db.prepare(
      'INSERT INTO ventas (id, pedido_id, caja_id, total, monto_efectivo, monto_transferencia, metodo_pago, pagado_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
    ).run(ventaId, payload.pedidoId, payload.cajaId, payload.total, payload.montoEfectivo, payload.montoTransferencia, payload.metodoPago);

    db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run('pagado', payload.pedidoId);

    return getById(ventaId);
  });

  return createVentaTransaction({
    cajaId,
    metodoPago,
    montoEfectivo,
    montoTransferencia,
    pedidoId,
    total,
  });
}

module.exports = { create, getAll, getById };