const router = require('express').Router();
const roles = require('../models/roles');

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
    return res.status(200).json(roles.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', (req, res) => {
  try {
    const role = roles.getById(req.params.id);
    if (role === null || role === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(role);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  try {
    if (isMissing(req.body.nombre)) {
      return res.status(400).json({ error: 'Campo nombre requerido' });
    }

    return res.status(201).json(roles.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', (req, res) => {
  try {
    return res.status(200).json(roles.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;