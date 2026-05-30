const router = require('express').Router();
const itemsPedido = require('../models/items_pedido');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(500).json({ error: err.message });
}

router.get('/pedido/:pedido_id', (req, res) => {
  try {
    return res.status(200).json(itemsPedido.getByPedido(req.params.pedido_id));
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  try {
    if (isMissing(req.body.pedido_id)) return res.status(400).json({ error: 'Campo pedido_id requerido' });
    if (isMissing(req.body.variante_id)) return res.status(400).json({ error: 'Campo variante_id requerido' });
    if (isMissing(req.body.cantidad)) return res.status(400).json({ error: 'Campo cantidad requerido' });

    return res.status(201).json(itemsPedido.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.patch('/:id/estado', (req, res) => {
  try {
    if (isMissing(req.body.estado)) return res.status(400).json({ error: 'Campo estado requerido' });

    return res.status(200).json(itemsPedido.updateEstado(req.params.id, req.body.estado));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', (req, res) => {
  try {
    itemsPedido.remove(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;