// === tests/roles.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

describe('Roles', () => {
  it('debe retornar un arreglo con los roles', async () => {
    const response = await request(app).get('/api/roles');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ nombre: 'admin' }),
      expect.objectContaining({ nombre: 'cajero' }),
      expect.objectContaining({ nombre: 'mesero' }),
    ]));
  });

  it('debe crear el rol y retornar 201', async () => {
    const response = await request(app)
      .post('/api/roles')
      .send({ nombre: 'gerente', descripcion: 'Gestiona operaciones del local' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      nombre: 'gerente',
      descripcion: 'Gestiona operaciones del local',
    }));
  });

  it('debe retornar 400 si falta el nombre', async () => {
    const response = await request(app)
      .post('/api/roles')
      .send({ descripcion: 'Sin nombre' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({ error: 'Campo nombre requerido' }));
  });

  it('debe retornar el rol cuando el id es válido', async () => {
    const response = await request(app).get(`/api/roles/${db.seedData.adminRolId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      id: db.seedData.adminRolId,
      nombre: 'admin',
    }));
  });

  it('debe retornar 404 si el rol no existe', async () => {
    const response = await request(app).get('/api/roles/ffffffffffffffffffffffffffffffff');

    expect(response.status).toBe(404);
    expect(response.body).toEqual(expect.objectContaining({ error: 'No encontrado' }));
  });
});