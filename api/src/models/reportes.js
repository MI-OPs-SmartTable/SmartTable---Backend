const ExcelJS = require('exceljs');
const db = require('../database/db');
const insumos = require('./insumos');

const PERIODOS = ['semana', 'mes'];
const LIMITE_POR_DEFECTO = 5;
const LIMITE_MAXIMO = 50;

function pad(value) {
  return String(value).padStart(2, '0');
}

function toSqlDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseFechaReferencia(fecha) {
  if (fecha === undefined || fecha === null || fecha === '') {
    return new Date();
  }

  const parsed = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('La fecha de referencia es inválida');
  }

  return parsed;
}

function getRangoSemana(fechaRef) {
  const desde = new Date(fechaRef);
  const diasDesdeElLunes = (desde.getDay() + 6) % 7;
  desde.setDate(desde.getDate() - diasDesdeElLunes);
  desde.setHours(0, 0, 0, 0);

  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 7);

  return { desde, hasta };
}

function getRangoMes(fechaRef) {
  const desde = new Date(fechaRef.getFullYear(), fechaRef.getMonth(), 1, 0, 0, 0, 0);
  const hasta = new Date(fechaRef.getFullYear(), fechaRef.getMonth() + 1, 1, 0, 0, 0, 0);

  return { desde, hasta };
}

function getRangoPersonalizado(desde, hasta) {
  const desdeDate = desde ? new Date(`${desde}T00:00:00`) : null;
  const hastaDate = hasta ? new Date(`${hasta}T00:00:00`) : null;

  if (!desdeDate || Number.isNaN(desdeDate.getTime())) {
    throw new Error('El parámetro desde es obligatorio y debe ser una fecha válida (YYYY-MM-DD)');
  }
  if (!hastaDate || Number.isNaN(hastaDate.getTime())) {
    throw new Error('El parámetro hasta es obligatorio y debe ser una fecha válida (YYYY-MM-DD)');
  }
  if (desdeDate > hastaDate) {
    throw new Error('El parámetro desde no puede ser posterior al parámetro hasta');
  }

  hastaDate.setDate(hastaDate.getDate() + 1);

  return { desde: desdeDate, hasta: hastaDate };
}

function resolveRango({ periodo, fecha, desde, hasta }) {
  if (desde || hasta) {
    return { ...getRangoPersonalizado(desde, hasta), periodo: 'personalizado' };
  }

  const periodoNormalizado = periodo ? String(periodo).toLowerCase() : 'mes';
  if (!PERIODOS.includes(periodoNormalizado)) {
    throw new Error('El periodo debe ser "semana" o "mes"');
  }

  const fechaRef = parseFechaReferencia(fecha);
  const rango = periodoNormalizado === 'semana' ? getRangoSemana(fechaRef) : getRangoMes(fechaRef);

  return { ...rango, periodo: periodoNormalizado };
}

function resolveLimite(limite) {
  if (limite === undefined || limite === null || limite === '') {
    return LIMITE_POR_DEFECTO;
  }

  const limiteNumerico = Number(limite);
  if (!Number.isInteger(limiteNumerico) || limiteNumerico <= 0 || limiteNumerico > LIMITE_MAXIMO) {
    throw new Error(`El límite debe ser un número entero entre 1 y ${LIMITE_MAXIMO}`);
  }

  return limiteNumerico;
}

// Ranking de productos más vendidos (por cantidad) en un rango de fechas,
// calculado sobre ventas ya pagadas (no sobre pedidos abiertos/pendientes).
function getTopProductosVendidos(filtros = {}) {
  const { desde, hasta, periodo } = resolveRango(filtros);
  const limite = resolveLimite(filtros.limite);

  const desdeSql = toSqlDateTime(desde);
  const hastaSql = toSqlDateTime(hasta);

  const productos = db.prepare(`
    SELECT
      p.id AS producto_id,
      p.nombre AS producto,
      SUM(ip.cantidad) AS cantidad_vendida,
      SUM(ip.cantidad * ip.precio_unitario) AS total_vendido
    FROM ventas v
    INNER JOIN items_pedido ip ON ip.pedido_id = v.pedido_id AND ip.estado != 'cancelado'
    INNER JOIN variantes_producto vp ON vp.id = ip.variante_id
    INNER JOIN productos p ON p.id = vp.producto_id
    WHERE v.pagado_at >= ? AND v.pagado_at < ?
    GROUP BY p.id, p.nombre
    ORDER BY cantidad_vendida DESC, total_vendido DESC
    LIMIT ?
  `).all(desdeSql, hastaSql, limite);

  return {
    periodo,
    desde: desdeSql,
    hasta: toSqlDateTime(new Date(hasta.getTime() - 1000)),
    productos: productos.map((row) => ({
      producto_id: row.producto_id,
      producto: row.producto,
      cantidad_vendida: Number(row.cantidad_vendida),
      total_vendido: Number(row.total_vendido),
    })),
  };
}

// Totales de ventas (cantidad e ingresos por medio de pago) en un rango de fechas,
// calculado sobre ventas ya pagadas.
function getResumenVentas(filtros = {}) {
  const { desde, hasta, periodo } = resolveRango(filtros);

  const desdeSql = toSqlDateTime(desde);
  const hastaSql = toSqlDateTime(hasta);

  const resumen = db.prepare(`
    SELECT
      COUNT(*) AS cantidad_ventas,
      COALESCE(SUM(total), 0) AS total_ventas,
      COALESCE(SUM(monto_efectivo), 0) AS total_efectivo,
      COALESCE(SUM(monto_transferencia), 0) AS total_transferencia
    FROM ventas
    WHERE pagado_at >= ? AND pagado_at < ?
  `).get(desdeSql, hastaSql);

  return {
    periodo,
    desde: desdeSql,
    hasta: toSqlDateTime(new Date(hasta.getTime() - 1000)),
    cantidad_ventas: Number(resumen.cantidad_ventas),
    total_ventas: Number(resumen.total_ventas),
    total_efectivo: Number(resumen.total_efectivo),
    total_transferencia: Number(resumen.total_transferencia),
  };
}

// Total de gastos de caja registrados en un rango de fechas.
function getResumenGastos(filtros = {}) {
  const { desde, hasta, periodo } = resolveRango(filtros);

  const desdeSql = toSqlDateTime(desde);
  const hastaSql = toSqlDateTime(hasta);

  const resumen = db.prepare(`
    SELECT
      COUNT(*) AS cantidad_gastos,
      COALESCE(SUM(monto), 0) AS total_gastos
    FROM gastos_caja
    WHERE created_at >= ? AND created_at < ?
  `).get(desdeSql, hastaSql);

  return {
    periodo,
    desde: desdeSql,
    hasta: toSqlDateTime(new Date(hasta.getTime() - 1000)),
    cantidad_gastos: Number(resumen.cantidad_gastos),
    total_gastos: Number(resumen.total_gastos),
  };
}

// Ventas agrupadas por día (efectivo / transferencia) en un rango de fechas.
function getVentasDiarias(filtros = {}) {
  const { desde, hasta, periodo } = resolveRango(filtros);
  const desdeSql = toSqlDateTime(desde);
  const hastaSql = toSqlDateTime(hasta);

  const filas = db.prepare(`
    SELECT
      date(pagado_at) AS fecha,
      COUNT(*) AS cantidad_ventas,
      COALESCE(SUM(monto_efectivo), 0) AS total_efectivo,
      COALESCE(SUM(monto_transferencia), 0) AS total_transferencia,
      COALESCE(SUM(total), 0) AS total
    FROM ventas
    WHERE pagado_at >= ? AND pagado_at < ?
    GROUP BY date(pagado_at)
    ORDER BY fecha ASC
  `).all(desdeSql, hastaSql);

  return {
    periodo,
    desde: desdeSql,
    hasta: toSqlDateTime(new Date(hasta.getTime() - 1000)),
    dias: filas.map((row) => ({
      fecha: row.fecha,
      cantidad_ventas: Number(row.cantidad_ventas),
      total_efectivo: Number(row.total_efectivo),
      total_transferencia: Number(row.total_transferencia),
      total: Number(row.total),
    })),
  };
}

// Ventas agrupadas por categoría de producto en un rango de fechas.
function getVentasPorCategoria(filtros = {}) {
  const { desde, hasta, periodo } = resolveRango(filtros);
  const desdeSql = toSqlDateTime(desde);
  const hastaSql = toSqlDateTime(hasta);

  const filas = db.prepare(`
    SELECT
      c.id AS categoria_id,
      c.nombre AS categoria,
      COALESCE(c.emoji, '📦') AS emoji,
      SUM(ip.cantidad) AS cantidad_vendida,
      SUM(ip.cantidad * ip.precio_unitario) AS total_vendido
    FROM ventas v
    INNER JOIN items_pedido ip ON ip.pedido_id = v.pedido_id AND ip.estado != 'cancelado'
    INNER JOIN variantes_producto vp ON vp.id = ip.variante_id
    INNER JOIN productos p ON p.id = vp.producto_id
    INNER JOIN categorias c ON c.id = p.categoria_id
    WHERE v.pagado_at >= ? AND v.pagado_at < ?
    GROUP BY c.id, c.nombre, c.emoji
    ORDER BY total_vendido DESC, cantidad_vendida DESC
  `).all(desdeSql, hastaSql);

  return {
    periodo,
    desde: desdeSql,
    hasta: toSqlDateTime(new Date(hasta.getTime() - 1000)),
    categorias: filas.map((row) => ({
      categoria_id: row.categoria_id,
      categoria: row.categoria,
      emoji: row.emoji,
      cantidad_vendida: Number(row.cantidad_vendida),
      total_vendido: Number(row.total_vendido),
    })),
  };
}

// Ventas agrupadas por ubicación (ej. Salón Principal, Terraza) en un rango de fechas.
// Los pedidos sin mesa asignada (mesa_id null) se agrupan como "Sin ubicación".
function getVentasPorUbicacion(filtros = {}) {
  const { desde, hasta, periodo } = resolveRango(filtros);
  const desdeSql = toSqlDateTime(desde);
  const hastaSql = toSqlDateTime(hasta);

  const filas = db.prepare(`
    SELECT
      u.id AS ubicacion_id,
      COALESCE(u.nombre, 'Sin ubicación') AS ubicacion,
      COUNT(*) AS cantidad_ventas,
      COALESCE(SUM(v.total), 0) AS total_vendido
    FROM ventas v
    INNER JOIN pedidos p ON p.id = v.pedido_id
    LEFT JOIN mesas m ON m.id = p.mesa_id
    LEFT JOIN ubicaciones u ON u.id = m.ubicacion_id
    WHERE v.pagado_at >= ? AND v.pagado_at < ?
    GROUP BY u.id, u.nombre
    ORDER BY cantidad_ventas DESC, total_vendido DESC
  `).all(desdeSql, hastaSql);

  return {
    periodo,
    desde: desdeSql,
    hasta: toSqlDateTime(new Date(hasta.getTime() - 1000)),
    ubicaciones: filas.map((row) => ({
      ubicacion_id: row.ubicacion_id,
      ubicacion: row.ubicacion,
      cantidad_ventas: Number(row.cantidad_ventas),
      total_vendido: Number(row.total_vendido),
    })),
  };
}

// Resumen consolidado para el dashboard: ventas, gastos, top productos y alertas de stock bajo.
function getResumenDashboard(filtros = {}) {
  const ventas = getResumenVentas(filtros);
  const gastos = getResumenGastos(filtros);
  const topProductos = getTopProductosVendidos({ ...filtros, limite: filtros.limite ?? 5 });
  const ventasDiarias = getVentasDiarias(filtros);
  const porCategoria = getVentasPorCategoria(filtros);
  const porUbicacion = getVentasPorUbicacion(filtros);
  const insumosConStockBajo = insumos.getInsumosConStockBajo();

  return {
    periodo: ventas.periodo,
    desde: ventas.desde,
    hasta: ventas.hasta,
    ventas: {
      cantidad: ventas.cantidad_ventas,
      total: ventas.total_ventas,
      total_efectivo: ventas.total_efectivo,
      total_transferencia: ventas.total_transferencia,
      ticket_promedio: ventas.cantidad_ventas > 0
        ? Math.round(ventas.total_ventas / ventas.cantidad_ventas)
        : 0,
    },
    gastos: {
      cantidad: gastos.cantidad_gastos,
      total: gastos.total_gastos,
    },
    ingresos_netos: ventas.total_ventas - gastos.total_gastos,
    ventas_diarias: ventasDiarias.dias,
    por_categoria: porCategoria.categorias,
    por_ubicacion: porUbicacion.ubicaciones,
    top_productos: topProductos.productos,
    stock_bajo: {
      cantidad: insumosConStockBajo.length,
      insumos: insumosConStockBajo,
    },
  };
}

function formatMoneda(valor) {
  return Number(valor || 0);
}

// Construye el libro de Excel del reporte consolidado (mismos datos que getResumenDashboard),
// con una hoja de resumen, una de top de productos y una de alertas de stock bajo.
async function generarReporteExcel(filtros = {}) {
  const resumen = getResumenDashboard(filtros);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartTable';
  workbook.created = new Date();

  const hojaResumen = workbook.addWorksheet('Resumen');
  hojaResumen.columns = [
    { header: 'Indicador', key: 'indicador', width: 30 },
    { header: 'Valor', key: 'valor', width: 20 },
  ];
  hojaResumen.addRows([
    { indicador: 'Periodo', valor: resumen.periodo },
    { indicador: 'Desde', valor: resumen.desde },
    { indicador: 'Hasta', valor: resumen.hasta },
    { indicador: 'Cantidad de ventas', valor: resumen.ventas.cantidad },
    { indicador: 'Total ventas', valor: formatMoneda(resumen.ventas.total) },
    { indicador: 'Total efectivo', valor: formatMoneda(resumen.ventas.total_efectivo) },
    { indicador: 'Total transferencia', valor: formatMoneda(resumen.ventas.total_transferencia) },
    { indicador: 'Cantidad de gastos', valor: resumen.gastos.cantidad },
    { indicador: 'Total gastos', valor: formatMoneda(resumen.gastos.total) },
    { indicador: 'Ingresos netos', valor: formatMoneda(resumen.ingresos_netos) },
    { indicador: 'Insumos con stock bajo', valor: resumen.stock_bajo.cantidad },
  ]);
  hojaResumen.getRow(1).font = { bold: true };

  const hojaDiarias = workbook.addWorksheet('Ventas diarias');
  hojaDiarias.columns = [
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Pedidos', key: 'cantidad_ventas', width: 12 },
    { header: 'Efectivo', key: 'total_efectivo', width: 16 },
    { header: 'Transferencia', key: 'total_transferencia', width: 16 },
    { header: 'Total', key: 'total', width: 16 },
  ];
  hojaDiarias.addRows(resumen.ventas_diarias.map((d) => ({
    fecha: d.fecha,
    cantidad_ventas: d.cantidad_ventas,
    total_efectivo: formatMoneda(d.total_efectivo),
    total_transferencia: formatMoneda(d.total_transferencia),
    total: formatMoneda(d.total),
  })));
  hojaDiarias.getRow(1).font = { bold: true };

  const hojaTopProductos = workbook.addWorksheet('Top productos');
  hojaTopProductos.columns = [
    { header: 'Producto', key: 'producto', width: 30 },
    { header: 'Cantidad vendida', key: 'cantidad_vendida', width: 20 },
    { header: 'Total vendido', key: 'total_vendido', width: 20 },
  ];
  hojaTopProductos.addRows(resumen.top_productos.map((p) => ({
    producto: p.producto,
    cantidad_vendida: p.cantidad_vendida,
    total_vendido: formatMoneda(p.total_vendido),
  })));
  hojaTopProductos.getRow(1).font = { bold: true };

  const hojaCategorias = workbook.addWorksheet('Por categoría');
  hojaCategorias.columns = [
    { header: 'Categoría', key: 'categoria', width: 28 },
    { header: 'Cantidad vendida', key: 'cantidad_vendida', width: 20 },
    { header: 'Total vendido', key: 'total_vendido', width: 20 },
  ];
  hojaCategorias.addRows(resumen.por_categoria.map((c) => ({
    categoria: c.categoria,
    cantidad_vendida: c.cantidad_vendida,
    total_vendido: formatMoneda(c.total_vendido),
  })));
  hojaCategorias.getRow(1).font = { bold: true };

  const hojaUbicaciones = workbook.addWorksheet('Por ubicación');
  hojaUbicaciones.columns = [
    { header: 'Ubicación', key: 'ubicacion', width: 28 },
    { header: 'Cantidad de ventas', key: 'cantidad_ventas', width: 20 },
    { header: 'Total vendido', key: 'total_vendido', width: 20 },
  ];
  hojaUbicaciones.addRows(resumen.por_ubicacion.map((u) => ({
    ubicacion: u.ubicacion,
    cantidad_ventas: u.cantidad_ventas,
    total_vendido: formatMoneda(u.total_vendido),
  })));
  hojaUbicaciones.getRow(1).font = { bold: true };

  const hojaStockBajo = workbook.addWorksheet('Stock bajo');
  hojaStockBajo.columns = [
    { header: 'Insumo', key: 'nombre', width: 30 },
    { header: 'Cantidad actual', key: 'cantidad_actual', width: 18 },
    { header: 'Stock mínimo', key: 'stock_minimo', width: 18 },
    { header: 'Unidad', key: 'unidad', width: 12 },
  ];
  hojaStockBajo.addRows(resumen.stock_bajo.insumos.map((i) => ({
    nombre: i.nombre,
    cantidad_actual: i.cantidad_actual,
    stock_minimo: i.stock_minimo,
    unidad: i.unidad,
  })));
  hojaStockBajo.getRow(1).font = { bold: true };

  return {
    buffer: await workbook.xlsx.writeBuffer(),
    nombreArchivo: `reporte-${resumen.periodo}-${resumen.desde.slice(0, 10)}_${resumen.hasta.slice(0, 10)}.xlsx`,
  };
}

module.exports = {
  generarReporteExcel,
  getResumenDashboard,
  getResumenGastos,
  getResumenVentas,
  getTopProductosVendidos,
  getVentasDiarias,
  getVentasPorCategoria,
  getVentasPorUbicacion,
};
