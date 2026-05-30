const router = require('express').Router();
const variantes = require('../models/variantes_producto');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(500).json({ error: err.message });
}

router.get('/producto/:producto_id', (req, res) => {
  try {
    return res.status(200).json(variantes.getByProducto(req.params.producto_id));
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', (req, res) => {
  try {
    const variante = variantes.getById(req.params.id);
    if (variante === null || variante === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(variante);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  try {
    if (isMissing(req.body.producto_id)) return res.status(400).json({ error: 'Campo producto_id requerido' });
    if (isMissing(req.body.nombre)) return res.status(400).json({ error: 'Campo nombre requerido' });
    if (isMissing(req.body.precio)) return res.status(400).json({ error: 'Campo precio requerido' });

    return res.status(201).json(variantes.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', (req, res) => {
  try {
    return res.status(200).json(variantes.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', (req, res) => {
  try {
    variantes.deactivate(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;