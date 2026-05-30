const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

const db = new Database(':memory:');

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = MEMORY');

const seedData = {};

function runMigrations() {
  db.exec(`
    CREATE TABLE roles (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT
    );

    CREATE TABLE usuarios (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      rol_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      nombre_completo TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE proveedores (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre_empresa TEXT NOT NULL,
      persona_contacto TEXT,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE categorias (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL UNIQUE,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE insumos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      proveedor_id TEXT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      unidad TEXT NOT NULL,
      cantidad_actual REAL NOT NULL DEFAULT 0 CHECK (cantidad_actual >= 0),
      stock_minimo REAL NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
      costo_unitario REAL NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE productos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE variantes_producto (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      precio REAL NOT NULL CHECK (precio >= 0),
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE recetas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      variante_id TEXT NOT NULL REFERENCES variantes_producto(id) ON DELETE CASCADE,
      insumo_id TEXT NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
      cantidad_requerida REAL NOT NULL CHECK (cantidad_requerida > 0),
      UNIQUE (variante_id, insumo_id)
    );

    CREATE TABLE ubicaciones (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL UNIQUE,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE mesas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      ubicacion_id TEXT NOT NULL REFERENCES ubicaciones(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'libre' CHECK (estado IN ('libre', 'ocupada', 'reservada'))
    );

    CREATE TABLE cajas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      monto_apertura REAL NOT NULL DEFAULT 0 CHECK (monto_apertura >= 0),
      monto_cierre REAL NOT NULL DEFAULT 0 CHECK (monto_cierre >= 0),
      apertura_at TEXT NOT NULL DEFAULT (datetime('now')),
      cierre_at TEXT DEFAULT (datetime('now')),
      estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada'))
    );

    CREATE TABLE sesiones (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      caja_id TEXT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
      inicio_at TEXT NOT NULL DEFAULT (datetime('now')),
      fin_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE pedidos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      mesa_id TEXT REFERENCES mesas(id) ON DELETE SET NULL,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      caja_id TEXT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
      estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'enviado', 'listo', 'pagado', 'cancelado')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE items_pedido (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      variante_id TEXT NOT NULL REFERENCES variantes_producto(id) ON DELETE RESTRICT,
      cantidad REAL NOT NULL CHECK (cantidad > 0),
      precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado'))
    );

    CREATE TABLE ventas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      pedido_id TEXT NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
      caja_id TEXT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
      total REAL NOT NULL CHECK (total >= 0),
      monto_efectivo REAL NOT NULL DEFAULT 0 CHECK (monto_efectivo >= 0),
      monto_transferencia REAL NOT NULL DEFAULT 0 CHECK (monto_transferencia >= 0),
      metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'mixto')),
      pagado_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE gastos_caja (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      caja_id TEXT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      monto REAL NOT NULL CHECK (monto >= 0),
      descripcion TEXT NOT NULL,
      categoria TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedDatabase() {
  const adminRolId = randomUUID().replace(/-/g, '').toLowerCase();
  const cajeroRolId = randomUUID().replace(/-/g, '').toLowerCase();
  const meseroRolId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO roles (id, nombre, descripcion) VALUES (?, ?, ?)').run(adminRolId, 'admin', 'Administrador del sistema');
  db.prepare('INSERT INTO roles (id, nombre, descripcion) VALUES (?, ?, ?)').run(cajeroRolId, 'cajero', 'Encargado de caja y cobros');
  db.prepare('INSERT INTO roles (id, nombre, descripcion) VALUES (?, ?, ?)').run(meseroRolId, 'mesero', 'Atención y toma de pedidos');

  const anaId = randomUUID().replace(/-/g, '').toLowerCase();
  const luisId = randomUUID().replace(/-/g, '').toLowerCase();
  const mariaId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare("INSERT INTO usuarios (id, rol_id, nombre_completo, email, pin_hash, activo, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").run(anaId, adminRolId, 'Ana García', 'ana@pos.com', 'HASH:1234', 1);
  db.prepare("INSERT INTO usuarios (id, rol_id, nombre_completo, email, pin_hash, activo, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").run(luisId, cajeroRolId, 'Luis Pérez', 'luis@pos.com', 'HASH:1234', 1);
  db.prepare("INSERT INTO usuarios (id, rol_id, nombre_completo, email, pin_hash, activo, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").run(mariaId, meseroRolId, 'María López', 'maria@pos.com', 'HASH:1234', 1);

  const distribuidoraCentralId = randomUUID().replace(/-/g, '').toLowerCase();
  const lacteosDelValleId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO proveedores (id, nombre_empresa, persona_contacto, telefono, email, direccion, activo) VALUES (?, ?, ?, ?, ?, ?, ?)').run(distribuidoraCentralId, 'Distribuidora Central', 'Carlos Ruiz', '3000000001', 'contacto@distribuidoracentral.com', 'Calle 10 # 20-30', 1);
  db.prepare('INSERT INTO proveedores (id, nombre_empresa, persona_contacto, telefono, email, direccion, activo) VALUES (?, ?, ?, ?, ?, ?, ?)').run(lacteosDelValleId, 'Lácteos del Valle', 'Sofía Mora', '3000000002', 'ventas@lacteosdelvalle.com', 'Carrera 15 # 45-12', 1);

  const bebidasCategoriaId = randomUUID().replace(/-/g, '').toLowerCase();
  const platosFuertesCategoriaId = randomUUID().replace(/-/g, '').toLowerCase();
  const postresCategoriaId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO categorias (id, nombre, activo) VALUES (?, ?, ?)').run(bebidasCategoriaId, 'Bebidas', 1);
  db.prepare('INSERT INTO categorias (id, nombre, activo) VALUES (?, ?, ?)').run(platosFuertesCategoriaId, 'Platos fuertes', 1);
  db.prepare('INSERT INTO categorias (id, nombre, activo) VALUES (?, ?, ?)').run(postresCategoriaId, 'Postres', 1);

  const cafeMolidoId = randomUUID().replace(/-/g, '').toLowerCase();
  const lecheId = randomUUID().replace(/-/g, '').toLowerCase();
  const polloId = randomUUID().replace(/-/g, '').toLowerCase();
  const arrozId = randomUUID().replace(/-/g, '').toLowerCase();
  const chocolateId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO insumos (id, proveedor_id, nombre, unidad, cantidad_actual, stock_minimo, costo_unitario, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(cafeMolidoId, distribuidoraCentralId, 'Café molido', 'g', 2000, 500, 0.05, 1);
  db.prepare('INSERT INTO insumos (id, proveedor_id, nombre, unidad, cantidad_actual, stock_minimo, costo_unitario, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(lecheId, lacteosDelValleId, 'Leche', 'ml', 5000, 1000, 0.003, 1);
  db.prepare('INSERT INTO insumos (id, proveedor_id, nombre, unidad, cantidad_actual, stock_minimo, costo_unitario, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(polloId, distribuidoraCentralId, 'Pollo', 'g', 3000, 500, 0.008, 1);
  db.prepare('INSERT INTO insumos (id, proveedor_id, nombre, unidad, cantidad_actual, stock_minimo, costo_unitario, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(arrozId, distribuidoraCentralId, 'Arroz', 'g', 5000, 1000, 0.002, 1);
  db.prepare('INSERT INTO insumos (id, proveedor_id, nombre, unidad, cantidad_actual, stock_minimo, costo_unitario, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(chocolateId, lacteosDelValleId, 'Chocolate', 'g', 1000, 200, 0.01, 1);

  const cafeId = randomUUID().replace(/-/g, '').toLowerCase();
  const pechugaId = randomUUID().replace(/-/g, '').toLowerCase();
  const brownieId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO productos (id, categoria_id, nombre, descripcion, activo) VALUES (?, ?, ?, ?, ?)').run(cafeId, bebidasCategoriaId, 'Café', 'Bebida caliente artesanal', 1);
  db.prepare('INSERT INTO productos (id, categoria_id, nombre, descripcion, activo) VALUES (?, ?, ?, ?, ?)').run(pechugaId, platosFuertesCategoriaId, 'Pechuga a la plancha', 'Plato fuerte con guarnición', 1);
  db.prepare('INSERT INTO productos (id, categoria_id, nombre, descripcion, activo) VALUES (?, ?, ?, ?, ?)').run(brownieId, postresCategoriaId, 'Brownie', 'Postre de chocolate', 1);

  const cafeNegroId = randomUUID().replace(/-/g, '').toLowerCase();
  const cafeConLecheId = randomUUID().replace(/-/g, '').toLowerCase();
  const porcionPequenaId = randomUUID().replace(/-/g, '').toLowerCase();
  const porcionGrandeId = randomUUID().replace(/-/g, '').toLowerCase();
  const brownieIndividualId = randomUUID().replace(/-/g, '').toLowerCase();
  const brownieConHeladoId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, ?)').run(cafeNegroId, cafeId, 'Café negro', 3500, 1);
  db.prepare('INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, ?)').run(cafeConLecheId, cafeId, 'Café con leche', 4200, 1);
  db.prepare('INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, ?)').run(porcionPequenaId, pechugaId, 'Porción pequeña', 12000, 1);
  db.prepare('INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, ?)').run(porcionGrandeId, pechugaId, 'Porción grande', 16000, 1);
  db.prepare('INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, ?)').run(brownieIndividualId, brownieId, 'Individual', 5000, 1);
  db.prepare('INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, ?)').run(brownieConHeladoId, brownieId, 'Con helado', 7500, 1);

  const recetaCafeNegroId = randomUUID().replace(/-/g, '').toLowerCase();
  const recetaCafeConLecheCafeId = randomUUID().replace(/-/g, '').toLowerCase();
  const recetaCafeConLecheLecheId = randomUUID().replace(/-/g, '').toLowerCase();
  const recetaPorcionPequenaPolloId = randomUUID().replace(/-/g, '').toLowerCase();
  const recetaPorcionPequenaArrozId = randomUUID().replace(/-/g, '').toLowerCase();
  const recetaPorcionGrandePolloId = randomUUID().replace(/-/g, '').toLowerCase();
  const recetaPorcionGrandeArrozId = randomUUID().replace(/-/g, '').toLowerCase();
  const recetaBrownieIndividualId = randomUUID().replace(/-/g, '').toLowerCase();
  const recetaBrownieConHeladoId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(recetaCafeNegroId, cafeNegroId, cafeMolidoId, 10);
  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(recetaCafeConLecheCafeId, cafeConLecheId, cafeMolidoId, 10);
  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(recetaCafeConLecheLecheId, cafeConLecheId, lecheId, 150);
  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(recetaPorcionPequenaPolloId, porcionPequenaId, polloId, 150);
  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(recetaPorcionPequenaArrozId, porcionPequenaId, arrozId, 100);
  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(recetaPorcionGrandePolloId, porcionGrandeId, polloId, 250);
  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(recetaPorcionGrandeArrozId, porcionGrandeId, arrozId, 150);
  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(recetaBrownieIndividualId, brownieIndividualId, chocolateId, 40);
  db.prepare('INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)').run(recetaBrownieConHeladoId, brownieConHeladoId, chocolateId, 40);

  const salonPrincipalId = randomUUID().replace(/-/g, '').toLowerCase();
  const terrazaId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO ubicaciones (id, nombre, activo) VALUES (?, ?, ?)').run(salonPrincipalId, 'Salón principal', 1);
  db.prepare('INSERT INTO ubicaciones (id, nombre, activo) VALUES (?, ?, ?)').run(terrazaId, 'Terraza', 1);

  const mesa1Id = randomUUID().replace(/-/g, '').toLowerCase();
  const mesa2Id = randomUUID().replace(/-/g, '').toLowerCase();
  const mesa3Id = randomUUID().replace(/-/g, '').toLowerCase();
  const mesa4Id = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO mesas (id, ubicacion_id, nombre, estado) VALUES (?, ?, ?, ?)').run(mesa1Id, salonPrincipalId, 'Mesa 1', 'libre');
  db.prepare('INSERT INTO mesas (id, ubicacion_id, nombre, estado) VALUES (?, ?, ?, ?)').run(mesa2Id, salonPrincipalId, 'Mesa 2', 'libre');
  db.prepare('INSERT INTO mesas (id, ubicacion_id, nombre, estado) VALUES (?, ?, ?, ?)').run(mesa3Id, terrazaId, 'Mesa 3', 'libre');
  db.prepare('INSERT INTO mesas (id, ubicacion_id, nombre, estado) VALUES (?, ?, ?, ?)').run(mesa4Id, terrazaId, 'Mesa 4', 'libre');

  const cajaAbiertaId = randomUUID().replace(/-/g, '').toLowerCase();
  db.prepare("INSERT INTO cajas (id, usuario_id, monto_apertura, monto_cierre, apertura_at, cierre_at, estado) VALUES (?, ?, ?, ?, datetime('now'), NULL, ?)").run(cajaAbiertaId, anaId, 50000, 0, 'abierta');

  const sesionActivaId = randomUUID().replace(/-/g, '').toLowerCase();
  db.prepare("INSERT INTO sesiones (id, usuario_id, caja_id, inicio_at, fin_at) VALUES (?, ?, ?, datetime('now'), NULL)").run(sesionActivaId, anaId, cajaAbiertaId);

  const pedidoId = randomUUID().replace(/-/g, '').toLowerCase();
  db.prepare("INSERT INTO pedidos (id, mesa_id, usuario_id, caja_id, estado, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").run(pedidoId, mesa1Id, mariaId, cajaAbiertaId, 'abierto');

  const itemCafeConLecheId = randomUUID().replace(/-/g, '').toLowerCase();
  const itemPorcionGrandeId = randomUUID().replace(/-/g, '').toLowerCase();

  db.prepare('INSERT INTO items_pedido (id, pedido_id, variante_id, cantidad, precio_unitario, estado) VALUES (?, ?, ?, ?, ?, ?)').run(itemCafeConLecheId, pedidoId, cafeConLecheId, 2, 4200, 'pendiente');
  db.prepare('INSERT INTO items_pedido (id, pedido_id, variante_id, cantidad, precio_unitario, estado) VALUES (?, ?, ?, ?, ?, ?)').run(itemPorcionGrandeId, pedidoId, porcionGrandeId, 1, 16000, 'pendiente');

  Object.assign(seedData, {
    adminRolId,
    cajeroRolId,
    meseroRolId,
    anaId,
    luisId,
    mariaId,
    distribuidoraCentralId,
    lacteosDelValleId,
    bebidasCategoriaId,
    platosFuertesCategoriaId,
    postresCategoriaId,
    cafeMolidoId,
    lecheId,
    polloId,
    arrozId,
    chocolateId,
    cafeId,
    pechugaId,
    brownieId,
    cafeNegroId,
    cafeConLecheId,
    porcionPequenaId,
    porcionGrandeId,
    brownieIndividualId,
    brownieConHeladoId,
    salonPrincipalId,
    terrazaId,
    mesa1Id,
    mesa2Id,
    mesa3Id,
    mesa4Id,
    cajaAbiertaId,
    sesionActivaId,
    pedidoId,
    itemCafeConLecheId,
    itemPorcionGrandeId,
  });
}

beforeAll(() => {
  runMigrations();
  seedDatabase();
});

afterAll(() => {
  db.close();
});

db.seedData = seedData;

module.exports = db;