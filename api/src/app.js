const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

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

module.exports = app;