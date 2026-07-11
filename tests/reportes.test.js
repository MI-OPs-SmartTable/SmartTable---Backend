// === tests/reportes.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAuthHeader(userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '8h' });
  return `Bearer ${token}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function toSqlDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const PRECIOS = {
  cafeNegro: 3500,
  brownieIndividual: 5000,
  porcionGrande: 16000,
};

describe('Reportes', () => {
  let adminAuthHeader;
  let cajeroAuthHeader;

  async function crearVentaPagada({ usuarioId, varianteId, cantidad, precioUnitario, pagadoAt }) {
    const pedidoResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', adminAuthHeader)
      .send({
        usuario_id: usuarioId,
        items: [{ variante_id: varianteId, cantidad }],
      });

    const total = cantidad * precioUnitario;

    const ventaResponse = await request(app)
      .post('/api/ventas')
      .set('Authorization', adminAuthHeader)
      .send({
        pedido_id: pedidoResponse.body.id,
        pagos: { monto_efectivo: total },
      });

    if (pagadoAt) {
      db.prepare('UPDATE ventas SET pagado_at = ? WHERE id = ?').run(toSqlDateTime(pagadoAt), ventaResponse.body.id);
    }

    return ventaResponse.body.id;
  }

  beforeAll(async () => {
    adminAuthHeader = await getAuthHeader(db.seedData.anaId);
    cajeroAuthHeader = await getAuthHeader(db.seedData.luisId);
  });

  it('debe rechazar el acceso a roles distintos de admin', async () => {
    const response = await request(app)
      .get('/api/reportes/top-productos')
      .set('Authorization', cajeroAuthHeader);

    expect(response.status).toBe(403);
  });

  it('debe validar el periodo enviado', async () => {
    const response = await request(app)
      .get('/api/reportes/top-productos?periodo=trimestre')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/periodo debe ser/);
  });

  it('debe devolver los productos mas vendidos del mes actual ordenados por cantidad', async () => {
    await crearVentaPagada({
      usuarioId: db.seedData.mariaId,
      varianteId: db.seedData.cafeNegroId,
      cantidad: 5,
      precioUnitario: PRECIOS.cafeNegro,
    });
    await crearVentaPagada({
      usuarioId: db.seedData.mariaId,
      varianteId: db.seedData.brownieIndividualId,
      cantidad: 2,
      precioUnitario: PRECIOS.brownieIndividual,
    });

    const response = await request(app)
      .get('/api/reportes/top-productos?periodo=mes')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(response.body.periodo).toBe('mes');
    expect(response.body.productos.length).toBeLessThanOrEqual(5);

    const cafe = response.body.productos.find((p) => p.producto_id === db.seedData.cafeId);
    expect(cafe).toEqual(expect.objectContaining({ cantidad_vendida: 5, total_vendido: 17500 }));

    const indexCafe = response.body.productos.findIndex((p) => p.producto_id === db.seedData.cafeId);
    const indexBrownie = response.body.productos.findIndex((p) => p.producto_id === db.seedData.brownieId);
    expect(indexCafe).toBeLessThan(indexBrownie);
  });

  it('debe filtrar por semana excluyendo ventas de otras semanas', async () => {
    const haceDosSemanas = new Date();
    haceDosSemanas.setDate(haceDosSemanas.getDate() - 14);

    await crearVentaPagada({
      usuarioId: db.seedData.mariaId,
      varianteId: db.seedData.porcionGrandeId,
      cantidad: 3,
      precioUnitario: PRECIOS.porcionGrande,
      pagadoAt: haceDosSemanas,
    });

    const response = await request(app)
      .get('/api/reportes/top-productos?periodo=semana')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(response.body.periodo).toBe('semana');
    const pechuga = response.body.productos.find((p) => p.producto_id === db.seedData.pechugaId);
    expect(pechuga).toBeUndefined();
  });

  it('debe permitir un rango de fechas personalizado con desde y hasta', async () => {
    const haceDosSemanas = new Date();
    haceDosSemanas.setDate(haceDosSemanas.getDate() - 14);
    const desde = new Date(haceDosSemanas);
    desde.setDate(desde.getDate() - 1);
    const hasta = new Date(haceDosSemanas);
    hasta.setDate(hasta.getDate() + 1);

    const response = await request(app)
      .get(`/api/reportes/top-productos?desde=${toIsoDate(desde)}&hasta=${toIsoDate(hasta)}`)
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(response.body.periodo).toBe('personalizado');
    const pechuga = response.body.productos.find((p) => p.producto_id === db.seedData.pechugaId);
    expect(pechuga).toEqual(expect.objectContaining({ cantidad_vendida: 3, total_vendido: 48000 }));
  });
});
