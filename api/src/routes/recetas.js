const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const recetas = require('../models/recetas');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(500).json({ error: err.message });
}

router.use(auth, requireRol('admin'));

router.get('/variante/:variante_id', (req, res) => {
  try {
    return res.status(200).json(recetas.getByVariante(req.params.variante_id));
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  try {
    if (isMissing(req.body.variante_id)) return res.status(400).json({ error: 'Campo variante_id requerido' });
    if (isMissing(req.body.insumo_id)) return res.status(400).json({ error: 'Campo insumo_id requerido' });
    if (isMissing(req.body.cantidad_requerida)) return res.status(400).json({ error: 'Campo cantidad_requerida requerido' });

    return res.status(201).json(recetas.upsert(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/variante/:variante_id/insumo/:insumo_id', (req, res) => {
  try {
    const removed = recetas.removeByVarianteInsumo(req.params.variante_id, req.params.insumo_id);
    if (removed === null || removed === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;