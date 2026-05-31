const jwt = require('jsonwebtoken');
const db = require('../database/db');

function auth(req, res, next) {
  try {
    const authorization = req.header('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    if (!payload || !payload.id) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(payload.id);

    if (!usuario || usuario.activo === 0) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    const rol = db.prepare('SELECT nombre FROM roles WHERE id = ?').get(usuario.rol_id);

    if (!rol || !rol.nombre) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    req.usuario = {
      id: usuario.id,
      rol_id: usuario.rol_id,
      rol: rol.nombre,
      nombre_completo: usuario.nombre_completo,
      email: usuario.email,
      activo: usuario.activo,
    };
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

      const rolNombre = req.usuario.rol || db.prepare('SELECT nombre FROM roles WHERE id = ?').get(req.usuario.rol_id)?.nombre;

      if (!rolNombre || !roles.includes(rolNombre)) {
        return res.status(403).json({ error: 'No autorizado para este recurso' });
      }

      req.usuario.rol = rolNombre;

      return next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error interno' });
    }
  };
}

module.exports = auth;
module.exports.requireRol = requireRol;