// === tests/cajas.colaboradores.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAuthHeader(userId) {
  return db.issueAuthHeader(userId);
}

describe('Cajas colaboradores', () => {
  let adminAuthHeader;

  beforeAll(async () => {
    adminAuthHeader = await getAuthHeader(db.seedData.anaId);

    await request(app)
      .post(`/api/cajas/${db.seedData.cajaAbiertaId}/colaboradores`)
      .set('Authorization', adminAuthHeader)
      .send({ usuario_id: db.seedData.luisId });
  });

  it('debe listar los colaboradores activos de una caja', async () => {
    const response = await request(app)
      .get(`/api/cajas/${db.seedData.cajaAbiertaId}/colaboradores`)
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      caja: expect.objectContaining({
        id: db.seedData.cajaAbiertaId,
      }),
    }));
    expect(Array.isArray(response.body.colaboradores)).toBe(true);
    expect(response.body.colaboradores).toEqual(expect.arrayContaining([
      expect.objectContaining({
        usuario_id: db.seedData.luisId,
        rol_sesion: 'colaborador',
        nombre_completo: 'Luis Pérez',
      }),
    ]));
  });

  it('debe listar las cajas abiertas con sus colaboradores', async () => {
    const response = await request(app)
      .get('/api/cajas/abiertas-con-colaboradores')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    const cajaAbierta = response.body.find((caja) => caja.id === db.seedData.cajaAbiertaId);
    expect(cajaAbierta).toEqual(expect.objectContaining({
      id: db.seedData.cajaAbiertaId,
      estado: 'abierta',
    }));
    expect(cajaAbierta.colaboradores).toEqual(expect.arrayContaining([
      expect.objectContaining({
        usuario_id: db.seedData.luisId,
        rol_sesion: 'colaborador',
      }),
    ]));
  });
});