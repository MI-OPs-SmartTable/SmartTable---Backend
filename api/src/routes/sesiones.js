const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const sesiones = require('../models/sesiones');
const cajas = require('../models/cajas');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  if (String(err.message || '').toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  if (String(err.message || '').toLowerCase().includes('sesión activa')) {
    return res.status(409).json({ error: err.message });
  }

  return res.status(500).json({ error: err.message });
}

router.use(auth, requireRol('admin', 'cajero'));

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

    return res.status(201).json(sesiones.abrirTitular(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/:id/cerrar', (req, res) => {
  try {
    const sesion = sesiones.getById(req.params.id);
    const caja = cajas.getById(sesion.caja_id);

    if (caja.usuario_id !== req.usuario.id && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el titular de la caja o un administrador puede cerrar esta sesión' });
    }

    return res.status(200).json(sesiones.cerrarSesion(req.params.id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;