const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env') });

function normalizeEnvironment(value) {
  const normalized = String(value || '').trim().toUpperCase();

  if (normalized === 'PRODUCTION') {
    return 'PRODUCTION';
  }

  return 'DEVELOPMENT';
}

const environment = normalizeEnvironment(
  process.env.environment || process.env.enviroment || process.env.NODE_ENV
);

process.env.environment = environment;
process.env.NODE_ENV = environment === 'PRODUCTION' ? 'production' : 'development';
process.env.JWT_SECRET = environment === 'PRODUCTION'
  ? process.env.JWT_SECRET_PRODUCTION || process.env.JWT_SECRET
  : process.env.JWT_SECRET_DEVELOPMENT || process.env.JWT_SECRET;

console.log(`[env] SmartTable backend en modo ${process.env.environment}`);
if (process.env.NODE_ENV !== 'production') {
  console.warn('[env] DEVELOPMENT activo: algunas rutas tienen permisos más flexibles para pruebas locales.');
}

const express = require('express');
const cors = require('cors');
const logger = require('./middlewares/logger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const { swaggerUi, swaggerSpec } = require('./config/swagger');

const app = express();

function parseCorsOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN || 'http://localhost:3030,http://localhost:5173');

app.use(logger);
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  }
}));
app.use(express.json());

const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none',
    displayRequestDuration: true,
    defaultModelsExpandDepth: -1
  }
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions, null, 'SmartTable API Docs'));
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
app.use('/api/medios-pago-transferencia', require('./routes/medios_pago_transferencia'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/gastos-caja', require('./routes/gastos_caja'));
app.use('/api/backup', require('./routes/backup'));

const frontendDist = process.env.FRONTEND_DIST;
if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    return res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) {
        next(err);
      }
    });
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;