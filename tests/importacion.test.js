// === tests/importacion.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAdminAuthHeader() {
  return db.issueAuthHeader(db.seedData.anaId);
}

const HEADERS = [
  'ID', 'Cod', 'Stock Total', 'Cant. (Principal)', 'Producto', 'Categoría',
  'Unidad', 'P. Compra', 'P. Venta', 'Proveedor', 'Mínimo de Stock',
];

async function buildWorkbookBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet JS');
  sheet.addRow(['Título del reporte']);
  sheet.addRow(HEADERS);
  for (const row of rows) {
    sheet.addRow([
      row.id ?? null,
      row.cod ?? null,
      row.stockTotal ?? row.cantidad ?? null,
      row.cantidad ?? null,
      row.producto ?? null,
      row.categoria ?? null,
      row.unidad ?? null,
      row.pCompra ?? null,
      row.pVenta ?? null,
      row.proveedor ?? null,
      row.stockMinimo ?? null,
    ]);
  }
  return workbook.xlsx.writeBuffer();
}

describe('Importación de Excel', () => {
  let adminAuthHeader;

  beforeAll(async () => {
    adminAuthHeader = await getAdminAuthHeader();
  });

  it('normaliza e importa insumos y productos aplicando las reglas de negocio', async () => {
    const buffer = await buildWorkbookBuffer([
      // insumo normal, con proveedor
      { id: 1, cantidad: 100, producto: 'Carne Mixta', categoria: 'Ingredientes', unidad: 'GR', pCompra: 14, pVenta: 14, proveedor: 'Nutrialimentos', stockMinimo: 10 },
      // insumo con stock negativo -> debe quedar en 0
      { id: 2, cantidad: -50, producto: 'Bolsa de Leche', categoria: 'Ingredientes', unidad: 'ML', pCompra: 4.5, pVenta: 6, proveedor: 'Quesera Jordan', stockMinimo: 5 },
      // insumo sin proveedor -> debe asignarse a "N/A"
      { id: 3, cantidad: 20, producto: 'Pan Perro', categoria: 'Ingredientes', unidad: 'unidad', pCompra: 850, pVenta: 900, proveedor: null, stockMinimo: 8 },
      // producto normal
      { id: 4, cantidad: 180, producto: 'Taco Pollo', categoria: 'TACOS', unidad: 'unidad', pCompra: 4447, pVenta: 16000, proveedor: 'SANTACO INT', stockMinimo: 20 },
      // ADICIONALES -> debe tratarse como producto, no insumo
      { id: 5, cantidad: 30, producto: 'Extra Queso', categoria: 'ADICIONALES', unidad: 'GR', pCompra: 500, pVenta: 2000, proveedor: 'Quesera Jordan', stockMinimo: 5 },
      // fila sin categoría -> se omite
      { id: 6, cantidad: 5, producto: 'Producto Fantasma', categoria: null, unidad: 'unidad', pCompra: 100, pVenta: 200, proveedor: 'FRUVER', stockMinimo: 1 },
      // producto duplicado (misma clave que fila 4 en minúsculas) -> se fusiona, se omite la 2da
      { id: 7, cantidad: 180, producto: 'taco pollo', categoria: 'TACOS', unidad: 'unidad', pCompra: 4447, pVenta: 16500, proveedor: 'SANTACO INT', stockMinimo: 20 },
    ]);

    const response = await request(app)
      .post('/api/importacion/excel')
      .set('Authorization', adminAuthHeader)
      .attach('archivo', buffer, 'inventario.xlsx');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      insumos_creados: 3,
      insumos_con_stock_ajustado: 1,
      insumos_sin_proveedor_asignado_na: 1,
      productos_creados: 2,
      productos_fusionados_por_duplicado: 1,
    }));
    expect(response.body.filas_omitidas).toEqual(expect.arrayContaining([
      expect.objectContaining({ motivo: 'Fila sin categoría', producto: 'Producto Fantasma' }),
    ]));

    const insumosResp = await request(app).get('/api/insumos').set('Authorization', adminAuthHeader);
    const bolsaLeche = insumosResp.body.find((i) => i.nombre === 'Bolsa de Leche');
    expect(bolsaLeche.cantidad_actual).toBe(0);
    expect(bolsaLeche.unidad).toBe('ml');

    const panPerro = insumosResp.body.find((i) => i.nombre === 'Pan Perro');
    const proveedoresResp = await request(app).get('/api/proveedores').set('Authorization', adminAuthHeader);
    const proveedorNA = proveedoresResp.body.find((p) => p.nombre_empresa === 'N/A');
    expect(proveedorNA).toBeDefined();
    expect(panPerro.proveedor_id).toBe(proveedorNA.id);

    const productosResp = await request(app).get('/api/productos').set('Authorization', adminAuthHeader);
    const tacos = productosResp.body.filter((p) => p.nombre.toLowerCase() === 'taco pollo');
    expect(tacos.length).toBe(1);

    const productosDetalle = await request(app).get('/api/productos?detalle=1').set('Authorization', adminAuthHeader);
    const tacoDetalle = productosDetalle.body.find((p) => p.nombre === 'Taco Pollo');
    expect(tacoDetalle.precio).toBe(16000);
    expect(tacoDetalle.insumos).toEqual([]);

    const categoriasResp = await request(app).get('/api/categorias').set('Authorization', adminAuthHeader);
    expect(categoriasResp.body.some((c) => c.nombre === 'ADICIONALES')).toBe(true);
  });

  it('rechaza archivos sin la columna Producto', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Hoja');
    sheet.addRow(['Foo', 'Bar']);
    sheet.addRow(['x', 'y']);
    const buffer = await workbook.xlsx.writeBuffer();

    const response = await request(app)
      .post('/api/importacion/excel')
      .set('Authorization', adminAuthHeader)
      .attach('archivo', buffer, 'malo.xlsx');

    expect(response.status).toBe(400);
  });

  it('rechaza peticiones sin archivo', async () => {
    const response = await request(app)
      .post('/api/importacion/excel')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(400);
  });
});
