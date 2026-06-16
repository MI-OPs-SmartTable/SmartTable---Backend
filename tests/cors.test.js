jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const app = require('../api/src/app');

describe('CORS', () => {
  it.each([
    'http://localhost:3030',
    'http://localhost:5173'
  ])('debe permitir solicitudes desde %s', async (origin) => {
    const response = await request(app)
      .options('/api/auth/login')
      .set('Origin', origin);

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });
});