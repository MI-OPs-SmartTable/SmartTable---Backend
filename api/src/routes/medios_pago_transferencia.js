const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const mediosPagoTransferencia = require('../models/medios_pago_transferencia');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(500).json({ error: err.message });
}

router.use(auth);

router.get('/', requireRol('admin', 'cajero'), (req, res) => {
  try {
    return res.status(200).json(mediosPagoTransferencia.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', requireRol('admin'), (req, res) => {
  try {
    if (isMissing(req.body.nombre)) {
      return res.status(400).json({ error: 'Campo nombre requerido' });
    }

    return res.status(201).json(mediosPagoTransferencia.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', requireRol('admin'), (req, res) => {
  try {
    return res.status(200).json(mediosPagoTransferencia.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', requireRol('admin'), (req, res) => {
  try {
    mediosPagoTransferencia.deactivate(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;