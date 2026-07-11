const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const reportes = require('../models/reportes');

function handleError(res, err) {
  const message = String(err.message || '');
  if (
    message.includes('periodo debe ser') ||
    message.includes('fecha') ||
    message.includes('límite debe ser') ||
    message.includes('desde') ||
    message.includes('hasta')
  ) {
    return res.status(400).json({ error: message });
  }
  return res.status(500).json({ error: message });
}

router.use(auth, requireRol('admin'));

router.get('/top-productos', (req, res) => {
  try {
    const resultado = reportes.getTopProductosVendidos({
      periodo: req.query.periodo,
      fecha: req.query.fecha,
      desde: req.query.desde,
      hasta: req.query.hasta,
      limite: req.query.limite,
    });
    return res.status(200).json(resultado);
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/ventas-resumen', (req, res) => {
  try {
    const resultado = reportes.getResumenVentas({
      periodo: req.query.periodo,
      fecha: req.query.fecha,
      desde: req.query.desde,
      hasta: req.query.hasta,
    });
    return res.status(200).json(resultado);
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/gastos-resumen', (req, res) => {
  try {
    const resultado = reportes.getResumenGastos({
      periodo: req.query.periodo,
      fecha: req.query.fecha,
      desde: req.query.desde,
      hasta: req.query.hasta,
    });
    return res.status(200).json(resultado);
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/dashboard', (req, res) => {
  try {
    const resultado = reportes.getResumenDashboard({
      periodo: req.query.periodo,
      fecha: req.query.fecha,
      desde: req.query.desde,
      hasta: req.query.hasta,
      limite: req.query.limite,
    });
    return res.status(200).json(resultado);
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/dashboard/excel', async (req, res) => {
  try {
    const { buffer, nombreArchivo } = await reportes.generarReporteExcel({
      periodo: req.query.periodo,
      fecha: req.query.fecha,
      desde: req.query.desde,
      hasta: req.query.hasta,
      limite: req.query.limite,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;
