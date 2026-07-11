// === tests/medios_pago_transferencia.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAdminAuthHeader() {
  return db.issueAuthHeader(db.seedData.anaId);
}

describe('Medios de pago por transferencia', () => {
  let adminAuthHeader;

  beforeAll(async () => {
    adminAuthHeader = await getAdminAuthHeader();
  });

  it('debe crear un medio de pago por transferencia y retornarlo activo', async () => {
    const response = await request(app)
      .post('/api/medios-pago-transferencia')
      .set('Authorization', adminAuthHeader)
      .send({ nombre: 'QR-Bancolombia' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      nombre: 'QR-Bancolombia',
      activo: 1,
    }));
  });

  it('debe listar los medios de pago por transferencia activos', async () => {
    const response = await request(app)
      .get('/api/medios-pago-transferencia')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ nombre: 'Nequi' }),
    ]));
  });
});