const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const validarCajaAbierta = require('../middlewares/validarCajaAbierta');
const itemsPedido = require('../models/items_pedido');
const pedidos = require('../models/pedidos');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  if (String(err.message || '').includes('Solo el mesero que creó')) {
    return res.status(403).json({ error: err.message });
  }

  return res.status(500).json({ error: err.message });
}

function ensurePedidoPropio(req, pedidoId) {
  if (req.usuario.rol !== 'mesero') return;
  const pedido = pedidos.getById(pedidoId);
  if (pedido.usuario_id !== req.usuario.id) {
    throw new Error('Solo el mesero que creó el pedido puede modificar sus items');
  }
}

router.use(auth, requireRol('admin', 'cajero', 'mesero'));

router.get('/pedido/:pedido_id', (req, res) => {
  try {
    return res.status(200).json(itemsPedido.getByPedido(req.params.pedido_id));
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  return validarCajaAbierta(req, res, () => {
    try {
      if (isMissing(req.body.pedido_id)) return res.status(400).json({ error: 'Campo pedido_id requerido' });
      if (isMissing(req.body.variante_id)) return res.status(400).json({ error: 'Campo variante_id requerido' });
      if (isMissing(req.body.cantidad)) return res.status(400).json({ error: 'Campo cantidad requerido' });
      ensurePedidoPropio(req, req.body.pedido_id);

      return res.status(201).json(itemsPedido.create(req.body));
    } catch (err) {
      return handleError(res, err);
    }
  });
});

router.patch('/:id/estado', (req, res) => {
  try {
    if (isMissing(req.body.estado)) return res.status(400).json({ error: 'Campo estado requerido' });

    const item = itemsPedido.getById(req.params.id);
    ensurePedidoPropio(req, item.pedido_id);

    return res.status(200).json(itemsPedido.updateEstado(req.params.id, req.body.estado));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', (req, res) => {
  try {
    const item = itemsPedido.getById(req.params.id);
    ensurePedidoPropio(req, item.pedido_id);

    itemsPedido.remove(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;