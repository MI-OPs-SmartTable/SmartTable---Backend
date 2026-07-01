const router = require('express').Router();
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const auth = require('../middlewares/auth');
const cajas = require('../models/cajas');
const sesiones = require('../models/sesiones');
const { verifyPin } = require('../middlewares/hashPin');

router.get('/usuarios', (req, res) => {
  try {
    const usuarios = db.prepare(`
      SELECT u.id, u.nombre_completo, r.nombre AS rol
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.rol_id
      WHERE u.activo = 1
      ORDER BY u.nombre_completo
    `).all();

    return res.status(200).json(usuarios);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { nombre_completo, pin } = req.body || {};

    if (nombre_completo === undefined || nombre_completo === null || nombre_completo === '' || pin === undefined || pin === null || pin === '') {
      return res.status(400).json({ error: 'nombre_completo y pin requeridos' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE nombre_completo = ?').get(nombre_completo);

    if (!usuario || usuario.activo === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!verifyPin(pin, usuario.pin_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const rol = db.prepare(`
      SELECT r.nombre AS rol
      FROM roles r
      INNER JOIN usuarios u ON u.rol_id = r.id
      WHERE u.id = ?
    `).get(usuario.id);

    const token = jwt.sign(
      { id: usuario.id, rol: rol.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    const usuarioAutenticado = db.prepare(`
      SELECT u.id, u.nombre_completo, r.nombre AS rol
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.rol_id
      WHERE u.id = ?
    `).get(usuario.id);

    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
    const expiresInSeconds = typeof expiresIn === 'string' && expiresIn.endsWith('h')
      ? Number.parseInt(expiresIn, 10) * 3600
      : 28800;

    return res.status(200).json({
      token,
      expiresIn: expiresInSeconds,
      usuario: {
        id: usuarioAutenticado.id,
        nombre_completo: usuarioAutenticado.nombre_completo,
        rol: usuarioAutenticado.rol
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/logout', auth, (req, res) => {
  try {
    const cajaAbierta = cajas.getCajaAbierta(req.usuario.id);
    if (cajaAbierta) {
      const cajaCerrada = cajas.cerrar(cajaAbierta.id, {});
      sesiones.cerrarPorCaja(cajaCerrada.id, cajaCerrada.cierre_at);
      return res.status(200).json({ message: 'Sesión cerrada correctamente' });
    }

    const sesionActiva = sesiones.getActivaByUsuario(req.usuario.id);
    if (sesionActiva) {
      sesiones.cerrarSesion(sesionActiva.id, {});
      return res.status(200).json({ message: 'Sesión cerrada correctamente' });
    }

    return res.status(200).json({ message: 'Sesión cerrada correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;