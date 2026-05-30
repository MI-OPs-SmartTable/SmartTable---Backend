const router = require('express').Router();
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
  try {
    if (isMissing(req.body.pedido_id)) return res.status(400).json({ error: 'Campo pedido_id requerido' });
    if (isMissing(req.body.caja_id)) return res.status(400).json({ error: 'Campo caja_id requerido' });
    if (req.body.pagos === undefined || req.body.pagos === null) return res.status(400).json({ error: 'Campo pagos requerido' });
    if (req.body.pagos.monto_efectivo === undefined || req.body.pagos.monto_efectivo === null) {
      return res.status(400).json({ error: 'Campo monto_efectivo requerido' });
    }
    if (req.body.pagos.monto_transferencia === undefined || req.body.pagos.monto_transferencia === null) {
      return res.status(400).json({ error: 'Campo monto_transferencia requerido' });
    }

    return res.status(201).json(ventas.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;