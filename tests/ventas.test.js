// === tests/ventas.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAuthHeader(userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '8h' });
  return `Bearer ${token}`;
}

describe('Ventas', () => {
  let cajeroAuthHeader;
  let adminAuthHeader;
  let pedidoTransferenciaId;

  beforeAll(async () => {
    cajeroAuthHeader = await getAuthHeader(db.seedData.luisId);
    adminAuthHeader = await getAuthHeader(db.seedData.anaId);

    await request(app)
      .post(`/api/cajas/${db.seedData.cajaAbiertaId}/colaboradores`)
      .set('Authorization', adminAuthHeader)
      .send({ usuario_id: db.seedData.luisId });

    const pedidoResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', cajeroAuthHeader)
      .send({
        usuario_id: db.seedData.mariaId,
        items: [
          {
            variante_id: db.seedData.cafeNegroId,
            cantidad: 1,
          },
        ],
      });

    pedidoTransferenciaId = pedidoResponse.body.id;
  });

  it('debe exigir un medio de transferencia cuando el pago es por transferencia', async () => {
    const response = await request(app)
      .post('/api/ventas')
      .set('Authorization', cajeroAuthHeader)
      .send({
        pedido_id: pedidoTransferenciaId,
        pagos: {
          monto_transferencia: 3500,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'Debe seleccionar un medio de pago por transferencia',
    }));
  });

  it('debe crear la venta por transferencia con medio y comentario opcional', async () => {
    const response = await request(app)
      .post('/api/ventas')
      .set('Authorization', cajeroAuthHeader)
      .send({
        pedido_id: pedidoTransferenciaId,
        pagos: {
          monto_transferencia: 3500,
          medio_transferencia_id: db.seedData.nequiMedioPagoId,
          comentario: 'Cliente confirmó transferencia por Nequi',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      pedido_id: pedidoTransferenciaId,
      caja_id: db.seedData.cajaAbiertaId,
        usuario_cobro_id: db.seedData.luisId,
      monto_transferencia: 3500,
      medio_transferencia_id: db.seedData.nequiMedioPagoId,
      comentario: 'Cliente confirmó transferencia por Nequi',
      metodo_pago: 'transferencia',
    }));
  });
});