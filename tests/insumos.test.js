// === tests/insumos.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

describe('Insumos', () => {
  beforeAll(() => {
    db.prepare('UPDATE insumos SET cantidad_actual = ?, stock_minimo = ? WHERE id = ?').run(100, 500, db.seedData.cafeMolidoId);
  });

  it('debe retornar todos los insumos activos', async () => {
    const response = await request(app).get('/api/insumos');

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
    const response = await request(app).get('/api/insumos/stock-bajo');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ nombre: 'Café molido', cantidad_actual: 100, stock_minimo: 500 }),
    ]));
    expect(response.body.every((insumo) => insumo.cantidad_actual <= insumo.stock_minimo)).toBe(true);
  });
});