// === tests/usuarios.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

describe('Usuarios', () => {
  let usuarioTemporalId;

  beforeAll(async () => {
    const response = await request(app)
      .post('/api/usuarios')
      .send({
        rol_id: db.seedData.cajeroRolId,
        nombre_completo: 'Carlos Test',
        email: 'carlos.test@pos.com',
        pin_hash: 'HASH:9999',
      });

    usuarioTemporalId = response.body.id;
  });

  it('debe retornar un arreglo con los usuarios activos', async () => {
    const response = await request(app)
      .get('/api/usuarios')
      .set('x-usuario-id', db.seedData.anaId);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: 'ana@pos.com' }),
      expect.objectContaining({ email: 'luis@pos.com' }),
      expect.objectContaining({ email: 'maria@pos.com' }),
    ]));
  });

  it('debe crear el usuario y retornar 201', async () => {
    const response = await request(app)
      .post('/api/usuarios')
      .set('x-usuario-id', db.seedData.anaId)
      .send({
        rol_id: db.seedData.adminRolId,
        nombre_completo: 'Laura Prueba',
        email: 'laura.prueba@pos.com',
        pin_hash: 'HASH:1234',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      rol_id: db.seedData.adminRolId,
      nombre_completo: 'Laura Prueba',
      email: 'laura.prueba@pos.com',
      pin_hash: 'HASH:1234',
      activo: 1,
    }));
  });

  it('debe retornar 400 si falta el email', async () => {
    const response = await request(app)
      .post('/api/usuarios')
      .set('x-usuario-id', db.seedData.anaId)
      .send({
        rol_id: db.seedData.adminRolId,
        nombre_completo: 'Sin Email',
        pin_hash: 'HASH:1111',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({ error: 'Campo email requerido' }));
  });

  it('debe desactivar el usuario y retornar 204', async () => {
    const response = await request(app)
      .delete(`/api/usuarios/${usuarioTemporalId}`)
      .set('x-usuario-id', db.seedData.anaId);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });

  it('debe retornar 404 para un usuario desactivado', async () => {
    const response = await request(app)
      .get(`/api/usuarios/${usuarioTemporalId}`)
      .set('x-usuario-id', db.seedData.anaId);

    expect(response.status).toBe(404);
    expect(response.body).toEqual(expect.objectContaining({ error: 'No encontrado' }));
  });
});