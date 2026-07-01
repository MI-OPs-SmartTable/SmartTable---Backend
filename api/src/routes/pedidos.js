const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const pedidos = require('../models/pedidos');
const sesiones = require('../models/sesiones');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  const message = String(err.message || '');
  if (message.toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: message });
  }
  if (
    message.includes('Stock insuficiente') ||
    message.includes('inválido') ||
    message.includes('requerido') ||
    message.includes('No se puede') ||
    message.includes('Debe enviar') ||
    message.includes('ya tiene un pedido pendiente')
  ) {
    return res.status(400).json({ error: message });
  }
  if (message.includes('sesión activa')) {
    return res.status(409).json({ error: message });
  }
  return res.status(500).json({ error: message });
}

router.use(auth, requireRol('admin', 'cajero', 'mesero'));

router.get('/pendientes/:caja_id', (req, res) => {
  try {
    return res.status(200).json(pedidos.getPendientes(req.params.caja_id));
  } catch (err) {
    return handleError(res, err);
  }
});

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
  try {
    if (isMissing(req.body.usuario_id)) return res.status(400).json({ error: 'Campo usuario_id requerido' });

    const sesionActiva = sesiones.getActivaByUsuario(req.usuario.id);
    if (!sesionActiva) {
      return res.status(409).json({ error: 'Debe tener una sesión de caja activa para crear pedidos' });
    }

    return res.status(201).json(pedidos.create({
      ...req.body,
      caja_id: sesionActiva.caja_id,
    }));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', (req, res) => {
  try {
    if (Array.isArray(req.body.items)) {
      return res.status(200).json(pedidos.replaceItems(req.params.id, req.body.items));
    }
    return res.status(200).json(pedidos.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', (req, res) => {
  try {
    return res.status(200).json(pedidos.cancel(req.params.id));
  } catch (err) {
    return handleError(res, err);
  }
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
