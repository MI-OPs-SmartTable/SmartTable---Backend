const router = require('express').Router();
const sesiones = require('../models/sesiones');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(500).json({ error: err.message });
}

router.get('/:id', (req, res) => {
  try {
    const sesion = sesiones.getById(req.params.id);
    if (sesion === null || sesion === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(sesion);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/iniciar', (req, res) => {
  try {
    if (isMissing(req.body.usuario_id)) return res.status(400).json({ error: 'Campo usuario_id requerido' });
    if (isMissing(req.body.caja_id)) return res.status(400).json({ error: 'Campo caja_id requerido' });

    return res.status(201).json(sesiones.iniciar(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/:id/cerrar', (req, res) => {
  try {
    return res.status(201).json(sesiones.close(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;