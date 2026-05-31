// === tests/auth.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

describe('Auth', () => {
  it('debe iniciar sesión con nombre_completo y pin y retornar token y usuario', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ nombre_completo: 'Ana García', pin: '1234' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ token: expect.any(String), usuario: expect.any(Object) }));
    expect(response.body.usuario).toEqual(expect.objectContaining({ nombre_completo: 'Ana García', rol: 'admin' }));
  });

  it('debe retornar 400 si faltan campos', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ nombre_completo: '', pin: '' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({ error: 'nombre_completo y pin requeridos' }));
  });

  it('debe retornar 401 con credenciales inválidas', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ nombre_completo: 'Ana García', pin: '0000' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual(expect.objectContaining({ error: 'Credenciales inválidas' }));
  });
});
