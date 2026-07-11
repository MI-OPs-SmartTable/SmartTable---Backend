const router = require('express').Router();
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const authSesiones = require('../models/auth_sesiones');
const { subscribe } = require('../realtime/hub');

const KEEP_ALIVE_MS = 25000;

function resolveToken(req) {
  const fromQuery = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (fromQuery) return fromQuery;

  const authorization = req.header('authorization');
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return '';
}

function authenticateEventRequest(req, res) {
  const token = resolveToken(req);
  if (!token) {
    res.status(401).json({ error: 'Token requerido' });
    return null;
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return null;
  }

  if (!payload || !payload.id) {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return null;
  }

  const authSesionId = payload.jti || payload.jwtid || null;
  if (!authSesionId || !authSesiones.isActiva(authSesionId)) {
    res.status(401).json({
      error: 'Sesión cerrada o iniciada en otro dispositivo. Inicie sesión nuevamente.',
      code: 'SESSION_REVOKED',
    });
    return null;
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(payload.id);
  if (!usuario || usuario.activo === 0) {
    res.status(401).json({ error: 'Usuario no válido' });
    return null;
  }

  return usuario;
}

function writeSse(res, event, data) {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * SSE: EventSource no permite header Authorization, por eso acepta ?token=
 * GET /api/events?token=JWT
 *
 * Una conexión sana permanece abierta (minutos/horas). Si ves GET cada 1–2s,
 * la conexión se está cayendo (ruta 404, proxy o auth) y el cliente reintenta.
 */
router.get('/', (req, res) => {
  const usuario = authenticateEventRequest(req, res);
  if (!usuario) return;

  // Evitar que Node cierre el socket por inactividad.
  req.socket.setTimeout(0);
  res.socket?.setTimeout?.(0);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  writeSse(res, 'connected', { ok: true, usuario_id: usuario.id });

  const onMessage = (event) => {
    try {
      writeSse(res, 'message', event);
    } catch {
      /* cliente desconectado */
    }
  };

  const unsubscribe = subscribe(onMessage);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, KEEP_ALIVE_MS);

  const cleanup = () => {
    clearInterval(keepAlive);
    unsubscribe();
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
});

module.exports = router;
