const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const insumos = require('../models/insumos');

const readRoles = requireRol('admin', 'cajero', 'mesero');
const writeRoles = requireRol('admin');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  const message = String(err.message || '');
  if (message.toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  if (
    message.includes('obligatorio') ||
    message.includes('debe ser') ||
    message.includes('debe ser un número')
  ) {
    return res.status(400).json({ error: message });
  }

  return res.status(500).json({ error: message });
}

router.get('/', auth, readRoles, (req, res) => {
  try {
    return res.status(200).json(insumos.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/stock-bajo', auth, readRoles, (req, res) => {
  try {
    return res.status(200).json(insumos.getInsumosConStockBajo());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/resumen', auth, readRoles, (req, res) => {
  try {
    return res.status(200).json(insumos.getResumenInventario());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id/compras', auth, readRoles, (req, res) => {
  try {
    return res.status(200).json(insumos.listCompras(req.params.id));
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/:id/compras', auth, writeRoles, (req, res) => {
  try {
    if (isMissing(req.body?.tipo)) return res.status(400).json({ error: 'Campo tipo requerido' });
    if (req.body?.cantidad === undefined || req.body?.cantidad === null) {
      return res.status(400).json({ error: 'Campo cantidad requerido' });
    }
    return res.status(201).json(insumos.registrarMovimiento(req.params.id, req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', auth, readRoles, (req, res) => {
  try {
    const insumo = insumos.getById(req.params.id);
    if (insumo === null || insumo === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(insumo);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', auth, writeRoles, (req, res) => {
  try {
    if (isMissing(req.body.nombre)) return res.status(400).json({ error: 'Campo nombre requerido' });
    if (isMissing(req.body.unidad)) return res.status(400).json({ error: 'Campo unidad requerido' });

    return res.status(201).json(insumos.create(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', auth, writeRoles, (req, res) => {
  try {
    return res.status(200).json(insumos.update(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', auth, writeRoles, (req, res) => {
  try {
    insumos.deactivate(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;
