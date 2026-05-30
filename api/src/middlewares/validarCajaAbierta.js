const db = require('../database/db');

function validarCajaAbierta(req, res, next) {
  try {
    const { caja_id: cajaId } = req.body || {};

    if (!cajaId) {
      return res.status(400).json({ error: 'caja_id requerido' });
    }

    const caja = db.prepare('SELECT * FROM cajas WHERE id = ?').get(cajaId);

    if (!caja) {
      return res.status(404).json({ error: 'Caja no encontrada' });
    }

    if (caja.estado !== 'abierta') {
      return res.status(400).json({ error: 'La caja no está abierta' });
    }

    req.caja = caja;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = validarCajaAbierta;