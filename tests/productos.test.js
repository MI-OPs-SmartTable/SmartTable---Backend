// === tests/productos.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAdminAuthHeader() {
  const token = jwt.sign({ id: db.seedData.anaId }, process.env.JWT_SECRET, { expiresIn: '8h' });
  return `Bearer ${token}`;
}

describe('Productos', () => {
  let productoTemporalId;
  let adminAuthHeader;

  beforeAll(async () => {
    adminAuthHeader = await getAdminAuthHeader();

    const response = await request(app)
      .post('/api/productos')
      .set('Authorization', adminAuthHeader)
      .send({
        categoria_id: db.seedData.bebidasCategoriaId,
        nombre: 'Producto Temporal',
        descripcion: 'Producto usado para pruebas',
        precio: 0,
        insumos: [ { insumo_id: db.seedData.cafeMolidoId, cantidad: 1 } ],
      });

    productoTemporalId = response.body.id;
  });

  it('debe retornar un arreglo con productos activos', async () => {
    const response = await request(app)
      .get('/api/productos')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ nombre: 'Café' }),
      expect.objectContaining({ nombre: 'Pechuga a la plancha' }),
      expect.objectContaining({ nombre: 'Brownie' }),
    ]));
  });

  it('debe crear el producto y retornar 201', async () => {
    const response = await request(app)
      .post('/api/productos')
      .set('Authorization', adminAuthHeader)
      .send({
        categoria_id: db.seedData.postresCategoriaId,
        nombre: 'Cheesecake',
        descripcion: 'Postre frío de queso crema',
        precio: 5000,
        insumos: [ { insumo_id: db.seedData.chocolateId, cantidad: 40 } ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      categoria_id: db.seedData.postresCategoriaId,
      nombre: 'Cheesecake',
      descripcion: 'Postre frío de queso crema',
      activo: 1,
    }));
    expect(Array.isArray(response.body.variantes)).toBe(true);
    expect(response.body.variantes.length).toBeGreaterThanOrEqual(1);
  });

  it('debe incluir el arreglo de variantes al consultar un producto', async () => {
    const response = await request(app)
      .get(`/api/productos/${db.seedData.cafeId}`)
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      id: db.seedData.cafeId,
      nombre: 'Café',
    }));
    expect(Array.isArray(response.body.variantes)).toBe(true);
    expect(response.body.variantes).toEqual(expect.arrayContaining([
      expect.objectContaining({ nombre: 'Café negro' }),
      expect.objectContaining({ nombre: 'Café con leche' }),
    ]));
  });

  it('debe desactivar el producto y retornar 204', async () => {
    const response = await request(app)
      .delete(`/api/productos/${productoTemporalId}`)
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });
});