const fs = require('fs');
const path = require('path');

const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : process.env.NODE_ENV === 'development'
    ? '.env.development'
    : '.env';
const envPath = path.join(process.cwd(), envFile);
const fallbackEnvPath = path.join(process.cwd(), '.env');

require('dotenv').config({ path: fs.existsSync(envPath) ? envPath : fallbackEnvPath });

const express = require('express');
const logger = require('./middlewares/logger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const { swaggerUi, swaggerSpec } = require('./config/swagger');

const app = express();

app.use(logger);
app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// No aplicar autenticación de forma global; cada ruta debe protegerse cuando corresponda

app.use('/api/auth', require('./routes/auth'));
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