const router = require('express').Router();
const db = require('../database/db');
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const cajas = require('../models/cajas');
const sesiones = require('../models/sesiones');

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

function cajaConColaboradores(caja) {
  return {
    ...caja,
    colaboradores: sesiones.getColaboradoresActivosByCaja(caja.id),
  };
}

router.use(auth, requireRol('admin', 'cajero'));

router.get('/', (req, res) => {
  try {
    return res.status(200).json(cajas.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/abierta/:usuario_id', (req, res) => {
  try {
    const caja = cajas.getCajaAbierta(req.params.usuario_id);
    if (caja === null || caja === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(caja);
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/abiertas-con-colaboradores', (req, res) => {
  try {
    return res.status(200).json(cajas.getAbiertas().map(cajaConColaboradores));
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id/colaboradores', (req, res) => {
  try {
    const caja = cajas.getById(req.params.id);
    if (caja === null || caja === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    return res.status(200).json({
      caja,
      colaboradores: sesiones.getColaboradoresActivosByCaja(caja.id),
    });
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', (req, res) => {
  try {
    const caja = cajas.getById(req.params.id);
    if (caja === null || caja === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(caja);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/abrir', (req, res) => {
  try {
    if (isMissing(req.body.usuario_id)) return res.status(400).json({ error: 'Campo usuario_id requerido' });
    if (isMissing(req.body.monto_apertura)) return res.status(400).json({ error: 'Campo monto_apertura requerido' });

    const cajaAbierta = db.prepare(
      'SELECT id FROM cajas WHERE usuario_id = ? AND estado = ? LIMIT 1'
    ).get(req.body.usuario_id, 'abierta');

    if (cajaAbierta) {
      return res.status(400).json({ error: 'El usuario ya tiene una caja abierta' });
    }

    const abrirCajaTransaction = db.transaction((payload) => {
      const caja = cajas.create({ ...payload, estado: 'abierta' });
      sesiones.abrirTitular({
        usuario_id: payload.usuario_id,
        caja_id: caja.id,
        inicio_at: payload.inicio_at,
      });
      return caja;
    });

    return res.status(201).json(abrirCajaTransaction(req.body));
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/:id/colaboradores', (req, res) => {
  try {
    if (isMissing(req.body.usuario_id)) {
      return res.status(400).json({ error: 'Campo usuario_id requerido' });
    }

    const caja = cajas.getById(req.params.id);
    if (caja.usuario_id !== req.usuario.id && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el titular de la caja o un administrador puede agregar colaboradores' });
    }

    return res.status(201).json(sesiones.agregarColaborador(caja.id, req.body.usuario_id, req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/:id/cerrar', (req, res) => {
  try {
    const caja = cajas.getById(req.params.id);

    if (caja.usuario_id !== req.usuario.id && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el usuario que abrió la caja o un administrador puede cerrarla' });
    }

    const cajaCerrada = cajas.cerrar(req.params.id, req.body || {});
    sesiones.cerrarPorCaja(cajaCerrada.id, cajaCerrada.cierre_at);

    return res.status(200).json(cajaCerrada);
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;