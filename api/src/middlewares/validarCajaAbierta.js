const db = require('../database/db');

function validarCajaAbierta(req, res, next) {
  try {
    const cajaId = req.body && req.body.caja_id;
    const caja = db.prepare('SELECT * FROM cajas WHERE id = ? AND estado = ?').get(cajaId, 'abierta');

    if (!caja) {
      return res.status(400).json({ error: 'No hay una caja abierta. Debe abrir una caja antes de continuar.' });
    }

    req.caja = caja;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = validarCajaAbierta;