const { randomUUID } = require('crypto');
const db = require('./db');
const { hashPin } = require('../middlewares/hashPin');

/** Medios de pago / billeteras más usados en Colombia para transferencias. */
const MEDIOS_PAGO_COLOMBIA = [
  'Bancolombia',
  'Nequi',
  'Daviplata',
  'Davivienda',
  'Banco de Bogotá',
  'BBVA',
  'Scotiabank Colpatria',
  'Banco Popular',
  'Banco Caja Social',
  'Banco AV Villas',
  'Movii',
  'Dale!',
  'RappiPay',
  'Lulo Bank',
  'Nu',
];

function newId() {
  return randomUUID().replace(/-/g, '').toLowerCase();
}

/**
 * Datos mínimos de arranque cuando la BD está vacía (SMARTTABLE_AUTO_SEED=1):
 * - Roles del sistema
 * - 1 usuario administrador (PIN 1234)
 * - Salón principal con 5 mesas
 * - Medios de pago comunes en Colombia
 */
function runSeeds() {
  const seedTransaction = db.transaction(() => {
    const adminRolId = newId();
    const cajeroRolId = newId();
    const meseroRolId = newId();

    db.prepare('INSERT INTO roles (id, nombre, descripcion) VALUES (?, ?, ?)').run(
      adminRolId,
      'admin',
      'Administrador del sistema'
    );
    db.prepare('INSERT INTO roles (id, nombre, descripcion) VALUES (?, ?, ?)').run(
      cajeroRolId,
      'cajero',
      'Encargado de caja y cobros'
    );
    db.prepare('INSERT INTO roles (id, nombre, descripcion) VALUES (?, ?, ?)').run(
      meseroRolId,
      'mesero',
      'Atención y toma de pedidos'
    );

    const adminId = newId();
    db.prepare(
      `INSERT INTO usuarios (id, rol_id, nombre_completo, email, pin_hash, activo, created_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now', 'localtime'))`
    ).run(
      adminId,
      adminRolId,
      'Administrador',
      'admin@smarttable.local',
      hashPin('1234')
    );

    const salonPrincipalId = newId();
    db.prepare('INSERT INTO ubicaciones (id, nombre, activo) VALUES (?, ?, 1)').run(
      salonPrincipalId,
      'Salón principal'
    );

    const insertMesa = db.prepare(
      'INSERT INTO mesas (id, ubicacion_id, nombre, estado) VALUES (?, ?, ?, ?)'
    );
    for (let n = 1; n <= 5; n += 1) {
      insertMesa.run(newId(), salonPrincipalId, `Mesa ${n}`, 'libre');
    }

    const insertMedio = db.prepare(
      'INSERT INTO medios_pago_transferencia (id, nombre, activo) VALUES (?, ?, 1)'
    );
    for (const nombre of MEDIOS_PAGO_COLOMBIA) {
      const exists = db
        .prepare('SELECT id FROM medios_pago_transferencia WHERE nombre = ?')
        .get(nombre);
      if (!exists) {
        insertMedio.run(newId(), nombre);
      }
    }
  });

  try {
    seedTransaction();
    console.log(
      'Seeds básicos ejecutados: Administrador (PIN 1234), Salón principal (5 mesas), medios de pago Colombia.'
    );
  } catch (error) {
    console.error('Error ejecutando seeds:', error);
    throw error;
  }
}

module.exports = { runSeeds, MEDIOS_PAGO_COLOMBIA };

if (require.main === module) {
  runSeeds();
}
