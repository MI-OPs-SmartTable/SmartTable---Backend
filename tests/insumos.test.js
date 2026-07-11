// === tests/insumos.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAdminAuthHeader() {
  return db.issueAuthHeader(db.seedData.anaId);
}

describe('Insumos', () => {
  let adminAuthHeader;

  beforeAll(async () => {
    db.prepare('UPDATE insumos SET cantidad_actual = ?, stock_minimo = ? WHERE id = ?').run(100, 500, db.seedData.cafeMolidoId);
    adminAuthHeader = await getAdminAuthHeader();
  });

  it('debe retornar todos los insumos activos', async () => {
    const response = await request(app)
      .get('/api/insumos')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ nombre: 'Café molido' }),
      expect.objectContaining({ nombre: 'Leche' }),
      expect.objectContaining({ nombre: 'Pollo' }),
      expect.objectContaining({ nombre: 'Arroz' }),
      expect.objectContaining({ nombre: 'Chocolate' }),
    ]));
  });

  it('debe retornar solo los insumos con stock bajo', async () => {
    const response = await request(app)
      .get('/api/insumos/stock-bajo')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ nombre: 'Café molido', cantidad_actual: 100, stock_minimo: 500 }),
    ]));
    expect(response.body.every((insumo) => insumo.cantidad_actual <= insumo.stock_minimo)).toBe(true);
  });

  it('debe retornar el resumen de inventario', async () => {
    const response = await request(app)
      .get('/api/insumos/resumen')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      total: expect.any(Number),
      stock_bajo: expect.any(Number),
      stock_ok: expect.any(Number),
      valor_inventario: expect.any(Number),
    }));
    expect(response.body.total).toBe(response.body.stock_bajo + response.body.stock_ok);
    expect(response.body.valor_inventario).toBeGreaterThanOrEqual(0);
  });

  it('debe agregar stock como compra y listar historial', async () => {
    const before = await request(app)
      .get(`/api/insumos/${db.seedData.arrozId}`)
      .set('Authorization', adminAuthHeader);

    const stockAntes = before.body.cantidad_actual;

    const add = await request(app)
      .post(`/api/insumos/${db.seedData.arrozId}/compras`)
      .set('Authorization', adminAuthHeader)
      .send({
        tipo: 'agregar',
        cantidad: 10,
        costo_unitario: 2.5,
        proveedor_id: db.seedData.distribuidoraCentralId,
      });

    expect(add.status).toBe(201);
    expect(add.body.insumo.cantidad_actual).toBe(stockAntes + 10);
    expect(add.body.insumo.costo_unitario).toBe(2.5);
    expect(add.body.compras[0]).toEqual(expect.objectContaining({
      tipo: 'agregar',
      cantidad: 10,
      total: 25,
    }));

    const hist = await request(app)
      .get(`/api/insumos/${db.seedData.arrozId}/compras`)
      .set('Authorization', adminAuthHeader);

    expect(hist.status).toBe(200);
    expect(hist.body.length).toBeGreaterThan(0);
    expect(hist.body[0].tipo).toBe('agregar');
  });

  it('debe fijar stock por ajuste', async () => {
    const fix = await request(app)
      .post(`/api/insumos/${db.seedData.arrozId}/compras`)
      .set('Authorization', adminAuthHeader)
      .send({ tipo: 'fijar', cantidad: 7 });

    expect(fix.status).toBe(201);
    expect(fix.body.insumo.cantidad_actual).toBe(7);
    expect(fix.body.compras.some((c) => c.tipo === 'fijar' && c.cantidad_nueva === 7)).toBe(true);
  });
});