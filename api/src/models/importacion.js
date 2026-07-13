const ExcelJS = require('exceljs');
const db = require('../database/db');
const categorias = require('./categorias');
const proveedores = require('./proveedores');
const insumos = require('./insumos');
const { newId, normalizeText } = require('./_utils');

const CATEGORIA_INSUMO = 'ingredientes';
const PROVEEDOR_NA = 'N/A';
const VARIANTE_DEFAULT_NOMBRE = 'Regular';

const REQUIRED_HEADERS = [
  'Producto',
  'Categoría',
  'Unidad',
  'P. Compra',
  'P. Venta',
  'Proveedor',
  'Cant. (Principal)',
  'Mínimo de Stock',
];

const UNIDAD_MAP = {
  gr: 'gramos',
  ml: 'ml',
  cm: 'cm',
  'c/u': 'unidad',
  unidad: 'unidad',
};

function cellText(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && Array.isArray(value.richText)) {
    return value.richText.map((t) => t.text).join('');
  }
  if (typeof value === 'object' && value.result !== undefined) {
    return value.result;
  }
  return value;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeUnidad(raw) {
  const text = String(raw || '').trim().toLowerCase();
  return UNIDAD_MAP[text] || text;
}

function findHeaderRow(sheet) {
  const maxScan = Math.min(sheet.rowCount, 5);
  for (let r = 1; r <= maxScan; r++) {
    const row = sheet.getRow(r);
    let found = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (String(cellText(cell) || '').trim() === 'Producto') found = true;
    });
    if (found) return r;
  }
  throw new Error("No se encontró la fila de encabezados (se esperaba una columna 'Producto')");
}

function buildColumnIndex(sheet, headerRowNumber) {
  const headerRow = sheet.getRow(headerRowNumber);
  const idx = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const name = String(cellText(cell) || '').trim();
    if (name) idx[name] = colNumber;
  });

  const missing = REQUIRED_HEADERS.filter((h) => !(h in idx));
  if (missing.length > 0) {
    throw new Error('Faltan columnas requeridas en el Excel: ' + missing.join(', '));
  }

  return idx;
}

async function readRawRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('El archivo Excel no contiene hojas');
  }

  const headerRowNumber = findHeaderRow(sheet);
  const idx = buildColumnIndex(sheet, headerRowNumber);

  const rows = [];
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount === 0) continue;

    const get = (name) => cellText(row.getCell(idx[name]));

    rows.push({
      fila: r,
      producto: normalizeText(get('Producto')),
      categoria: normalizeText(get('Categoría')),
      unidad: normalizeText(get('Unidad')),
      pCompra: toNumber(get('P. Compra')),
      pVenta: toNumber(get('P. Venta')),
      proveedor: normalizeText(get('Proveedor')),
      cantidad: toNumber(get('Cant. (Principal)')),
      stockMinimo: toNumber(get('Mínimo de Stock')),
    });
  }

  return rows;
}

function classifyRows(rawRows) {
  const omitidas = [];
  const insumoRows = [];
  const productoRowsByNombre = new Map();
  let productosFusionados = 0;

  for (const row of rawRows) {
    if (!row.producto) {
      omitidas.push({ fila: row.fila, motivo: 'Fila sin nombre de producto' });
      continue;
    }
    if (!row.categoria) {
      omitidas.push({ fila: row.fila, motivo: 'Fila sin categoría', producto: row.producto });
      continue;
    }

    const esInsumo = row.categoria.trim().toLowerCase() === CATEGORIA_INSUMO;

    if (esInsumo) {
      if (!row.unidad) {
        omitidas.push({ fila: row.fila, motivo: 'Insumo sin unidad', producto: row.producto });
        continue;
      }
      if (row.pCompra === null) {
        omitidas.push({ fila: row.fila, motivo: 'Insumo con P. Compra inválido', producto: row.producto });
        continue;
      }
      insumoRows.push(row);
      continue;
    }

    if (row.pVenta === null) {
      omitidas.push({ fila: row.fila, motivo: 'Producto con P. Venta inválido', producto: row.producto });
      continue;
    }

    const key = row.producto.trim().toLowerCase();
    if (productoRowsByNombre.has(key)) {
      productosFusionados++;
      continue;
    }
    productoRowsByNombre.set(key, row);
  }

  return {
    omitidas,
    insumoRows,
    productoRows: [...productoRowsByNombre.values()],
    productosFusionados,
  };
}

function findOrCreateCategoria(cache, nombre) {
  const key = nombre.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const existing = db.prepare('SELECT id FROM categorias WHERE lower(nombre) = ?').get(key);
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const created = categorias.create({ nombre: nombre.trim() });
  cache.set(key, created.id);
  return created.id;
}

function findOrCreateProveedor(cache, nombreEmpresa) {
  const key = nombreEmpresa.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const existing = db.prepare('SELECT id FROM proveedores WHERE lower(nombre_empresa) = ?').get(key);
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const created = proveedores.create({ nombre_empresa: nombreEmpresa.trim() });
  cache.set(key, created.id);
  return created.id;
}

function crearProductoSinReceta({ categoriaId, nombre, precio }) {
  const id = newId();
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO productos (id, categoria_id, nombre, descripcion, emoji, activo) VALUES (?, ?, ?, NULL, ?, 1)'
    ).run(id, categoriaId, nombre, '📦');

    db.prepare(
      'INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, 1)'
    ).run(newId(), id, VARIANTE_DEFAULT_NOMBRE, precio);
  });
  tx();
  return id;
}

async function importFromWorkbook(buffer) {
  const rawRows = await readRawRows(buffer);
  const { omitidas, insumoRows, productoRows, productosFusionados } = classifyRows(rawRows);

  const categoriaCache = new Map();
  const proveedorCache = new Map();

  let categoriasCreadasAntes = db.prepare('SELECT COUNT(*) AS n FROM categorias').get().n;
  let proveedoresCreadosAntes = db.prepare('SELECT COUNT(*) AS n FROM proveedores').get().n;

  let insumosCreados = 0;
  let insumosConStockAjustado = 0;
  let insumosSinProveedorAsignadoNA = 0;

  for (const row of insumoRows) {
    try {
      let proveedorId;
      if (row.proveedor) {
        proveedorId = findOrCreateProveedor(proveedorCache, row.proveedor);
      } else {
        proveedorId = findOrCreateProveedor(proveedorCache, PROVEEDOR_NA);
        insumosSinProveedorAsignadoNA++;
      }

      let cantidadActual = row.cantidad ?? 0;
      if (cantidadActual < 0) {
        cantidadActual = 0;
        insumosConStockAjustado++;
      }

      insumos.create({
        proveedor_id: proveedorId,
        nombre: row.producto,
        unidad: normalizeUnidad(row.unidad),
        cantidad_actual: cantidadActual,
        stock_minimo: row.stockMinimo !== null && row.stockMinimo >= 0 ? row.stockMinimo : 0,
        costo_unitario: row.pCompra !== null && row.pCompra >= 0 ? row.pCompra : 0,
      });
      insumosCreados++;
    } catch (err) {
      omitidas.push({ fila: row.fila, motivo: 'Error al crear insumo: ' + err.message, producto: row.producto });
    }
  }

  let productosCreados = 0;

  for (const row of productoRows) {
    try {
      const categoriaId = findOrCreateCategoria(categoriaCache, row.categoria);
      crearProductoSinReceta({
        categoriaId,
        nombre: row.producto,
        precio: row.pVenta >= 0 ? row.pVenta : 0,
      });
      productosCreados++;
    } catch (err) {
      omitidas.push({ fila: row.fila, motivo: 'Error al crear producto: ' + err.message, producto: row.producto });
    }
  }

  const categoriasCreadasDespues = db.prepare('SELECT COUNT(*) AS n FROM categorias').get().n;
  const proveedoresCreadosDespues = db.prepare('SELECT COUNT(*) AS n FROM proveedores').get().n;

  return {
    categorias_creadas: categoriasCreadasDespues - categoriasCreadasAntes,
    proveedores_creados: proveedoresCreadosDespues - proveedoresCreadosAntes,
    insumos_creados: insumosCreados,
    insumos_con_stock_ajustado: insumosConStockAjustado,
    insumos_sin_proveedor_asignado_na: insumosSinProveedorAsignadoNA,
    productos_creados: productosCreados,
    productos_fusionados_por_duplicado: productosFusionados,
    filas_omitidas: omitidas,
  };
}

module.exports = { importFromWorkbook };
