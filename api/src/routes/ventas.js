const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const validarCajaAbierta = require('../middlewares/validarCajaAbierta');
const ventas = require('../models/ventas');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(500).json({ error: err.message });
}

router.use(auth, requireRol('admin', 'cajero'));

router.get('/', (req, res) => {
  try {
    return res.status(200).json(ventas.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', (req, res) => {
  try {
    const venta = ventas.getById(req.params.id);
    if (venta === null || venta === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(venta);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  return validarCajaAbierta(req, res, () => {
    try {
      if (isMissing(req.body.pedido_id)) return res.status(400).json({ error: 'Campo pedido_id requerido' });
      if (req.body.pagos === undefined || req.body.pagos === null || typeof req.body.pagos !== 'object') {
        return res.status(400).json({ error: 'Campo pagos requerido' });
      }

      req.body.pagos = {
        monto_efectivo: req.body.pagos.monto_efectivo ?? 0,
        monto_transferencia: req.body.pagos.monto_transferencia ?? 0,
      };

      return res.status(201).json(ventas.create(req.body));
    } catch (err) {
      return handleError(res, err);
    }
  });
});

module.exports = router;