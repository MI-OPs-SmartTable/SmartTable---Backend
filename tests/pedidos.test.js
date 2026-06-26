// === tests/pedidos.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAuthHeader(userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '8h' });
  return `Bearer ${token}`;
}

describe('Pedidos', () => {
  let cajeroAuthHeader;

  beforeAll(async () => {
    cajeroAuthHeader = await getAuthHeader(db.seedData.luisId);
  });

  it('no debe permitir crear un pedido para una mesa que ya está por cobrar', async () => {
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', cajeroAuthHeader)
      .send({
        usuario_id: db.seedData.mariaId,
        caja_id: db.seedData.cajaAbiertaId,
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
        caja_id: db.seedData.cajaAbiertaId,
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
});
