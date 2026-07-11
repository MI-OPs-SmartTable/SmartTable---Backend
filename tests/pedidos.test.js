// === tests/pedidos.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAuthHeader(userId) {
  return db.issueAuthHeader(userId);
}

describe('Pedidos', () => {
  let cajeroAuthHeader;
  let adminAuthHeader;

  beforeAll(async () => {
    cajeroAuthHeader = await getAuthHeader(db.seedData.luisId);
    adminAuthHeader = await getAuthHeader(db.seedData.anaId);

    await request(app)
      .post(`/api/cajas/${db.seedData.cajaAbiertaId}/colaboradores`)
      .set('Authorization', adminAuthHeader)
      .send({ usuario_id: db.seedData.luisId });
  });

  it('no debe permitir crear un pedido para una mesa que ya está por cobrar', async () => {
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', cajeroAuthHeader)
      .send({
        usuario_id: db.seedData.mariaId,
        mesa_id: db.seedData.mesa1Id,
        items: [
          {
            variante_id: db.seedData.cafeNegroId,
            cantidad: 1,
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'La mesa ya tiene un pedido pendiente por cobrar',
    }));
  });

  it('debe permitir crear un pedido en una mesa libre', async () => {
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', cajeroAuthHeader)
      .send({
        usuario_id: db.seedData.mariaId,
        mesa_id: db.seedData.mesa2Id,
        items: [
          {
            variante_id: db.seedData.cafeNegroId,
            cantidad: 1,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      mesa_id: db.seedData.mesa2Id,
      estado: 'abierto',
    }));
  });

  it('debe permitir agregar una nota opcional a un item del pedido', async () => {
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', cajeroAuthHeader)
      .send({
        usuario_id: db.seedData.mariaId,
        mesa_id: db.seedData.mesa3Id,
        items: [
          {
            variante_id: db.seedData.cafeNegroId,
            cantidad: 1,
            nota: 'Sin azúcar',
          },
          {
            variante_id: db.seedData.cafeConLecheId,
            cantidad: 1,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ variante_id: db.seedData.cafeNegroId, nota: 'Sin azúcar' }),
      expect.objectContaining({ variante_id: db.seedData.cafeConLecheId, nota: null }),
    ]));
  });
});
