// === tests/cajas.colaboradores.test.js ===
jest.mock('../api/src/database/db', () => require('../api/src/database/db.test'));

const request = require('supertest');
const app = require('../api/src/app');
const db = require('../api/src/database/db.test');

async function getAuthHeader(userId) {
  return db.issueAuthHeader(userId);
}

describe('Cajas colaboradores', () => {
  let adminAuthHeader;

  beforeAll(async () => {
    adminAuthHeader = await getAuthHeader(db.seedData.anaId);

    await request(app)
      .post(`/api/cajas/${db.seedData.cajaAbiertaId}/colaboradores`)
      .set('Authorization', adminAuthHeader)
      .send({ usuario_id: db.seedData.luisId });
  });

  it('debe listar los colaboradores activos de una caja', async () => {
    const response = await request(app)
      .get(`/api/cajas/${db.seedData.cajaAbiertaId}/colaboradores`)
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      caja: expect.objectContaining({
        id: db.seedData.cajaAbiertaId,
      }),
    }));
    expect(Array.isArray(response.body.colaboradores)).toBe(true);
    expect(response.body.colaboradores).toEqual(expect.arrayContaining([
      expect.objectContaining({
        usuario_id: db.seedData.luisId,
        rol_sesion: 'colaborador',
        nombre_completo: 'Luis Pérez',
      }),
    ]));
  });

  it('debe listar las cajas abiertas con sus colaboradores', async () => {
    const response = await request(app)
      .get('/api/cajas/abiertas-con-colaboradores')
      .set('Authorization', adminAuthHeader);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    const cajaAbierta = response.body.find((caja) => caja.id === db.seedData.cajaAbiertaId);
    expect(cajaAbierta).toEqual(expect.objectContaining({
      id: db.seedData.cajaAbiertaId,
      estado: 'abierta',
    }));
    expect(cajaAbierta.colaboradores).toEqual(expect.arrayContaining([
      expect.objectContaining({
        usuario_id: db.seedData.luisId,
        rol_sesion: 'colaborador',
      }),
    ]));
  });

  it('debe rechazar agregar colaboradores si no es el titular', async () => {
    const cajeroAuthHeader = await getAuthHeader(db.seedData.luisId);

    const response = await request(app)
      .post(`/api/cajas/${db.seedData.cajaAbiertaId}/colaboradores`)
      .set('Authorization', cajeroAuthHeader)
      .send({ usuario_id: db.seedData.mariaId });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/quien abrió la caja/i);
  });

  it('al abrir un cajero debe añadir al admin como colaborador y no permitirle cerrar', async () => {
    // Cerrar la caja seed (Ana titular) para poder abrir una nueva
    await request(app)
      .post(`/api/cajas/${db.seedData.cajaAbiertaId}/cerrar`)
      .set('Authorization', adminAuthHeader)
      .send({});

    const cajeroAuthHeader = await getAuthHeader(db.seedData.luisId);

    const abrir = await request(app)
      .post('/api/cajas/abrir')
      .set('Authorization', cajeroAuthHeader)
      .send({
        usuario_id: db.seedData.luisId,
        monto_apertura: 10000,
      });

    expect(abrir.status).toBe(201);
    expect(abrir.body.usuario_id).toBe(db.seedData.luisId);
    expect(abrir.body.colaboradores).toEqual(expect.arrayContaining([
      expect.objectContaining({
        usuario_id: db.seedData.anaId,
        rol_sesion: 'colaborador',
        rol: 'admin',
      }),
    ]));

    const cajaId = abrir.body.id;
    const cierrePorAdmin = await request(app)
      .post(`/api/cajas/${cajaId}/cerrar`)
      .set('Authorization', adminAuthHeader)
      .send({});

    expect(cierrePorAdmin.status).toBe(403);
    expect(cierrePorAdmin.body.error).toMatch(/quien abrió la caja/i);

    const cierrePorTitular = await request(app)
      .post(`/api/cajas/${cajaId}/cerrar`)
      .set('Authorization', cajeroAuthHeader)
      .send({});

    expect(cierrePorTitular.status).toBe(200);
    expect(cierrePorTitular.body.estado).toBe('cerrada');

    // Restaurar caja/sesión seed para otros suites que comparten la BD de test
    db.prepare(`
      UPDATE cajas
      SET estado = 'abierta', cierre_at = NULL, monto_cierre = 0
      WHERE id = ?
    `).run(db.seedData.cajaAbiertaId);
    db.prepare(`UPDATE sesiones SET fin_at = datetime('now') WHERE fin_at IS NULL`).run();
    db.prepare(`
      UPDATE sesiones
      SET fin_at = NULL, caja_id = ?, rol_sesion = 'titular'
      WHERE id = ?
    `).run(db.seedData.cajaAbiertaId, db.seedData.sesionActivaId);
  });
});
