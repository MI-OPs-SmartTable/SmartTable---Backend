const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const mesas = require('../models/mesas');

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
    return res.status(200).json(mesas.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/ubicacion/:ubicacion_id', requireRol('admin', 'cajero', 'mesero'), (req, res) => {
  try {
    return res.status(200).json(mesas.getByUbicacion(req.params.ubicacion_id));
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', requireRol('admin', 'cajero', 'mesero'), (req, res) => {
  try {
    const mesa = mesas.getById(req.params.id);
    if (mesa === null || mesa === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(mesa);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', requireRol('admin', 'cajero'), (req, res) => {
  try {
    if (isMissing(req.body.ubicacion_id)) return res.status(400).json({ error: 'Campo ubicacion_id requerido' });
    if (isMissing(req.body.nombre)) return res.status(400).json({ error: 'Campo nombre requerido' });

    return res.status(201).json(mesas.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', requireRol('admin', 'cajero'), (req, res) => {
  try {
    return res.status(200).json(mesas.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

router.patch('/:id/estado', requireRol('admin', 'cajero'), (req, res) => {
  try {
    if (isMissing(req.body.estado)) return res.status(400).json({ error: 'Campo estado requerido' });

    return res.status(200).json(mesas.updateEstado(req.params.id, req.body.estado));
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;