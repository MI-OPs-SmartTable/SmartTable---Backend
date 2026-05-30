const db = require('../database/db');
const { ensureText, fetchById, newId, normalizeText } = require('./_utils');

function getAll() {
  return db.prepare('SELECT * FROM proveedores WHERE activo = 1 ORDER BY nombre_empresa').all();
}

function getById(id) {
  return fetchById(db, 'proveedores', id, 'Proveedor');
}

function create(data) {
  const nombreEmpresa = ensureText(data.nombre_empresa, 'El nombre de la empresa');
  const personaContacto = normalizeText(data.persona_contacto);
  const telefono = normalizeText(data.telefono);
  const email = normalizeText(data.email);
  const direccion = normalizeText(data.direccion);

  const id = newId();
  db.prepare(
    'INSERT INTO proveedores (id, nombre_empresa, persona_contacto, telefono, email, direccion, activo) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).run(id, nombreEmpresa, personaContacto, telefono, email, direccion);

  return getById(id);
}

function update(id, data) {
  const current = getById(id);
  const nombreEmpresa = data.nombre_empresa !== undefined
    ? ensureText(data.nombre_empresa, 'El nombre de la empresa')
    : current.nombre_empresa;
  const personaContacto = data.persona_contacto !== undefined ? normalizeText(data.persona_contacto) : current.persona_contacto;
  const telefono = data.telefono !== undefined ? normalizeText(data.telefono) : current.telefono;
  const email = data.email !== undefined ? normalizeText(data.email) : current.email;
  const direccion = data.direccion !== undefined ? normalizeText(data.direccion) : current.direccion;

  db.prepare(
    'UPDATE proveedores SET nombre_empresa = ?, persona_contacto = ?, telefono = ?, email = ?, direccion = ? WHERE id = ?'
  ).run(nombreEmpresa, personaContacto, telefono, email, direccion, id);

  return getById(id);
}

function deactivate(id) {
  const current = getById(id);
  if (current.activo === 0) {
    return current;
  }

  db.prepare('UPDATE proveedores SET activo = 0 WHERE id = ?').run(id);
  return getById(id);
}

module.exports = { create, deactivate, getAll, getById, update };