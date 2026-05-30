const express = require('express');
const logger = require('./middlewares/logger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const auth = require('./middlewares/auth');
const { swaggerUi, swaggerSpec } = require('./config/swagger');

const app = express();

app.use(logger);
app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Requiere autenticación en todas las rutas /api/* excepto documentación
app.use('/api', (req, res, next) => (req.path.startsWith('/docs') ? next() : auth(req, res, next)));

app.use('/api/roles', require('./routes/roles'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/insumos', require('./routes/insumos'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/variantes', require('./routes/variantes'));
app.use('/api/recetas', require('./routes/recetas'));
app.use('/api/ubicaciones', require('./routes/ubicaciones'));
app.use('/api/mesas', require('./routes/mesas'));
app.use('/api/cajas', require('./routes/cajas'));
app.use('/api/sesiones', require('./routes/sesiones'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/items-pedido', require('./routes/items_pedido'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/gastos-caja', require('./routes/gastos_caja'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;