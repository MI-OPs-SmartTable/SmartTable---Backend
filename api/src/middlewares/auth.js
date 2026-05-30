const db = require('../database/db');

function auth(req, res, next) {
  try {
    const usuarioId = req.header('x-usuario-id');

    if (!usuarioId) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);

    if (!usuario || usuario.activo === 0) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    req.usuario = usuario;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

function requireRol(...roles) {
  return (req, res, next) => {
    try {
      if (!req.usuario) {
        return res.status(401).json({ error: 'Autenticación requerida' });
      }

      const rol = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.usuario.rol_id);

      if (!rol || !roles.includes(rol.nombre)) {
        return res.status(403).json({ error: 'No autorizado para este recurso' });
      }

      return next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error interno' });
    }
  };
}

module.exports = auth;
module.exports.requireRol = requireRol;