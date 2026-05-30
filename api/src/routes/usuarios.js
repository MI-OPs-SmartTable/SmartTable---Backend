const router = require('express').Router();
const usuarios = require('../models/usuarios');

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
    return res.status(200).json(usuarios.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', (req, res) => {
  try {
    const usuario = usuarios.getById(req.params.id);
    if (usuario === null || usuario === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(usuario);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  try {
    if (isMissing(req.body.rol_id)) return res.status(400).json({ error: 'Campo rol_id requerido' });
    if (isMissing(req.body.nombre_completo)) return res.status(400).json({ error: 'Campo nombre_completo requerido' });
    if (isMissing(req.body.email)) return res.status(400).json({ error: 'Campo email requerido' });
    if (isMissing(req.body.pin_hash)) return res.status(400).json({ error: 'Campo pin_hash requerido' });

    return res.status(201).json(usuarios.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', (req, res) => {
  try {
    return res.status(200).json(usuarios.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', (req, res) => {
  try {
    usuarios.deactivate(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;