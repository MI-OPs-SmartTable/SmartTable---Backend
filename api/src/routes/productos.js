const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const productos = require('../models/productos');

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

router.get('/', requireRol('admin', 'cajero', 'mesero'), (req, res) => {
  try {
    return res.status(200).json(productos.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', requireRol('admin', 'cajero', 'mesero'), (req, res) => {
  try {
    const producto = productos.getById(req.params.id);
    if (producto === null || producto === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(producto);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', requireRol('admin'), (req, res) => {
  try {
    if (isMissing(req.body.categoria_id)) return res.status(400).json({ error: 'Campo categoria_id requerido' });
    if (isMissing(req.body.nombre)) return res.status(400).json({ error: 'Campo nombre requerido' });

    return res.status(201).json(productos.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', requireRol('admin'), (req, res) => {
  try {
    return res.status(200).json(productos.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', requireRol('admin'), (req, res) => {
  try {
    productos.deactivate(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;