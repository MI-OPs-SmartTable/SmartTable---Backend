const db = require('../database/db');

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

module.exports = { getTopProductosVendidos };
