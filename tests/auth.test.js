// === tests/auth.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

describe('Auth', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM auth_sesiones').run();
  });

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

  it('no debe permitir un segundo login del mismo usuario sin forzar', async () => {
    const first = await request(app)
      .post('/api/auth/login')
      .send({ nombre_completo: 'Ana García', pin: '1234' });

    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/login')
      .send({ nombre_completo: 'Ana García', pin: '1234' });

    expect(second.status).toBe(409);
    expect(second.body).toEqual(expect.objectContaining({
      code: 'SESSION_ACTIVE_ELSEWHERE',
      puede_forzar: true,
    }));
  });

  it('debe permitir forzar cierre de la sesión anterior', async () => {
    const first = await request(app)
      .post('/api/auth/login')
      .send({ nombre_completo: 'Ana García', pin: '1234' });

    const oldToken = first.body.token;

    const forced = await request(app)
      .post('/api/auth/login')
      .send({ nombre_completo: 'Ana García', pin: '1234', forzar_cierre: true });

    expect(forced.status).toBe(200);
    expect(forced.body.token).toEqual(expect.any(String));

    const oldStillValid = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${oldToken}`);

    expect(oldStillValid.status).toBe(401);
  });

  it('debe cerrar la caja abierta al cerrar sesión', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ nombre_completo: 'Ana García', pin: '1234' });

    const token = loginResponse.body.token;

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutResponse.status).toBe(200);

    const caja = db.prepare('SELECT * FROM cajas WHERE id = ?').get(db.seedData.cajaAbiertaId);
    expect(caja.estado).toBe('cerrada');
    expect(caja.cierre_at).not.toBeNull();

    db.prepare("UPDATE cajas SET estado = 'abierta', cierre_at = NULL WHERE id = ?").run(db.seedData.cajaAbiertaId);
  });
});
