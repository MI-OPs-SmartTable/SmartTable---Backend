const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const validarCajaAbierta = require('../middlewares/validarCajaAbierta');
const pedidos = require('../models/pedidos');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(500).json({ error: err.message });
}

router.use(auth, requireRol('admin', 'cajero', 'mesero'));

router.get('/', (req, res) => {
  try {
    return res.status(200).json(pedidos.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', (req, res) => {
  try {
    const pedido = pedidos.getById(req.params.id);
    if (pedido === null || pedido === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(pedido);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  return validarCajaAbierta(req, res, () => {
    try {
      if (isMissing(req.body.usuario_id)) return res.status(400).json({ error: 'Campo usuario_id requerido' });

      return res.status(201).json(pedidos.create(req.body));
    } catch (err) {
      return handleError(res, err);
    }
  });
});

router.patch('/:id/estado', (req, res) => {
  try {
    if (isMissing(req.body.estado)) return res.status(400).json({ error: 'Campo estado requerido' });

    return res.status(200).json(pedidos.updateEstado(req.params.id, req.body.estado));
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;