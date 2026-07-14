const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireRol } = auth;
const pedidos = require('../models/pedidos');
const sesiones = require('../models/sesiones');
const ventas = require('../models/ventas');
const { publishPedidosChanged } = require('../realtime/hub');

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function handleError(res, err) {
  const message = String(err.message || '');
  if (message.toLowerCase().includes('no encontrado')) {
    return res.status(404).json({ error: message });
  }
  if (
    message.includes('Debe seleccionar') ||
    message.includes('no coincide') ||
    message.includes('inválido') ||
    message.includes('requerido') ||
    message.includes('obligatorio') ||
    message.includes('No se puede') ||
    message.includes('ya fue pagado')
  ) {
    return res.status(400).json({ error: message });
  }
  if (message.includes('sesión activa')) {
    return res.status(403).json({ error: message });
  }
  return res.status(500).json({ error: message });
}

router.use(auth, requireRol('admin', 'cajero'));

router.get('/', (req, res) => {
  try {
    return res.status(200).json(ventas.getAll());
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/caja/:caja_id', (req, res) => {
  try {
    return res.status(200).json(ventas.getByCaja(req.params.caja_id));
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:id', (req, res) => {
  try {
    const venta = ventas.getById(req.params.id);
    if (venta === null || venta === undefined) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    return res.status(200).json(venta);
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', (req, res) => {
  try {
    if (isMissing(req.body.pedido_id)) return res.status(400).json({ error: 'Campo pedido_id requerido' });
    if (req.body.pagos === undefined || req.body.pagos === null || typeof req.body.pagos !== 'object') {
      return res.status(400).json({ error: 'Campo pagos requerido' });
    }

    const pedido = pedidos.getById(req.body.pedido_id);
    if (!sesiones.usuarioPuedeOperarCaja(req.usuario.id, pedido.caja_id)) {
      return res.status(403).json({ error: 'No tiene sesión activa para operar esta caja' });
    }

    req.body.pagos = {
      monto_efectivo: req.body.pagos.monto_efectivo ?? 0,
      monto_transferencia: req.body.pagos.monto_transferencia ?? 0,
      medio_transferencia_id: req.body.pagos.medio_transferencia_id,
      banco_nombre: req.body.pagos.banco_nombre,
      comentario: req.body.pagos.comentario ?? req.body.pagos.descripcion ?? req.body.pagos.descripcion_transferencia,
    };

    const venta = ventas.create({
      ...req.body,
      caja_id: pedido.caja_id,
      usuario_cobro_id: req.usuario.id,
    });
    publishPedidosChanged(pedido.caja_id);
    return res.status(201).json(venta);
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;
