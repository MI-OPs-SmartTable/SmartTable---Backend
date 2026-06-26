const router = require('express').Router();
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const auth = require('../middlewares/auth');
const cajas = require('../models/cajas');
const { verifyPin } = require('../middlewares/hashPin');
const { newId } = require('../models/_utils');

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

    db.prepare(
      'INSERT INTO sesiones (id, usuario_id, caja_id, inicio_at, fin_at) VALUES (?, ?, NULL, datetime(\'now\'), NULL)'
    ).run(newId(), usuario.id);

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
      cajas.cerrar(cajaAbierta.id, {});
    }

    const sesion = db.prepare(
      'SELECT * FROM sesiones WHERE usuario_id = ? AND fin_at IS NULL ORDER BY inicio_at DESC LIMIT 1'
    ).get(req.usuario.id);

    if (!sesion) {
      return res.status(404).json({ error: 'No hay sesión activa' });
    }

    db.prepare('UPDATE sesiones SET fin_at = datetime(\'now\') WHERE id = ?').run(sesion.id);

    return res.status(200).json({ message: 'Sesión cerrada correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;