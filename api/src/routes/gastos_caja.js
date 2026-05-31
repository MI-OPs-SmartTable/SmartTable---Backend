const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const validarCajaAbierta = require('../middlewares/validarCajaAbierta');
const gastosCaja = require('../models/gastos_caja');

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
    return res.status(200).json(gastosCaja.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/caja/:caja_id', (req, res) => {
  try {
    return res.status(200).json(gastosCaja.getByCaja(req.params.caja_id));
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', (req, res) => {
  try {
    const gasto = gastosCaja.getById(req.params.id);
    if (gasto === null || gasto === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(gasto);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  return validarCajaAbierta(req, res, () => {
    try {
      if (isMissing(req.body.usuario_id)) return res.status(400).json({ error: 'Campo usuario_id requerido' });
      if (isMissing(req.body.monto)) return res.status(400).json({ error: 'Campo monto requerido' });
      if (isMissing(req.body.descripcion)) return res.status(400).json({ error: 'Campo descripcion requerido' });
      if (isMissing(req.body.categoria)) return res.status(400).json({ error: 'Campo categoria requerido' });

      return res.status(201).json(gastosCaja.create(req.body));
    } catch (err) {
      return handleError(res, err);
    }
  });
});

module.exports = router;