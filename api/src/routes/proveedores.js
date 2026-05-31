const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const proveedores = require('../models/proveedores');

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

router.get('/', (req, res) => {
  try {
    return res.status(200).json(proveedores.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', (req, res) => {
  try {
    const proveedor = proveedores.getById(req.params.id);
    if (proveedor === null || proveedor === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(proveedor);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  try {
    if (isMissing(req.body.nombre_empresa)) {
      return res.status(400).json({ error: 'Campo nombre_empresa requerido' });
    }

    return res.status(201).json(proveedores.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', (req, res) => {
  try {
    return res.status(200).json(proveedores.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', (req, res) => {
  try {
    proveedores.deactivate(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;