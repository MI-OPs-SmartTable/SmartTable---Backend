const router = require('express').Router();
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const auth = require('../middlewares/auth');
const authSesiones = require('../models/auth_sesiones');
const cajas = require('../models/cajas');
const sesiones = require('../models/sesiones');
const { verifyPin } = require('../middlewares/hashPin');

function parseExpiresInSeconds(expiresIn) {
  if (typeof expiresIn === 'string' && expiresIn.endsWith('h')) {
    return Number.parseInt(expiresIn, 10) * 3600;
  }
  return 28800;
}

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
    const { nombre_completo, pin, forzar_cierre } = req.body || {};

    if (nombre_completo === undefined || nombre_completo === null || nombre_completo === '' || pin === undefined || pin === null || pin === '') {
      return res.status(400).json({ error: 'nombre_completo y pin requeridos' });
    }

    const matches = db.prepare(`
      SELECT *
      FROM usuarios
      WHERE nombre_completo = ? AND activo = 1
      ORDER BY created_at ASC
    `).all(nombre_completo);

    if (matches.length > 1) {
      return res.status(409).json({
        error: 'Hay más de un usuario activo con ese nombre_completo. Use un identificador único.',
      });
    }

    const usuario = matches[0];

    if (!usuario || usuario.activo === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!verifyPin(pin, usuario.pin_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const sesionActiva = authSesiones.getActivaByUsuario(usuario.id);
    if (sesionActiva && !forzar_cierre) {
      return res.status(409).json({
        error: 'Este usuario ya tiene una sesión activa en otro dispositivo. Debe cerrar sesión allí o forzar el cierre aquí.',
        code: 'SESSION_ACTIVE_ELSEWHERE',
        puede_forzar: true,
      });
    }

    if (sesionActiva && forzar_cierre) {
      authSesiones.revocarActivasPorUsuario(usuario.id);
    }

    const rol = db.prepare(`
      SELECT r.nombre AS rol
      FROM roles r
      INNER JOIN usuarios u ON u.rol_id = r.id
      WHERE u.id = ?
    `).get(usuario.id);

    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
    const expiresInSeconds = parseExpiresInSeconds(expiresIn);
    const deviceLabel = String(req.headers['user-agent'] || '').slice(0, 200) || null;
    const authSesion = authSesiones.crear({
      usuarioId: usuario.id,
      expiresInSeconds,
      deviceLabel,
    });

    const token = jwt.sign(
      { id: usuario.id, rol: rol.rol, jti: authSesion.id },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    const usuarioAutenticado = db.prepare(`
      SELECT u.id, u.nombre_completo, r.nombre AS rol
      FROM usuarios u
      INNER JOIN roles r ON r.id = u.rol_id
      WHERE u.id = ?
    `).get(usuario.id);

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
    if (req.authSesionId) {
      authSesiones.revocar(req.authSesionId);
    } else {
      authSesiones.revocarActivasPorUsuario(req.usuario.id);
    }

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
