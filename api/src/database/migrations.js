const db = require('./db');

function runMigrations() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      rol_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      nombre_completo TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre_empresa TEXT NOT NULL,
      persona_contacto TEXT,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL UNIQUE,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS insumos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      proveedor_id TEXT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      unidad TEXT NOT NULL,
      cantidad_actual REAL NOT NULL DEFAULT 0 CHECK (cantidad_actual >= 0),
      stock_minimo REAL NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
      costo_unitario REAL NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS productos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS variantes_producto (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      precio REAL NOT NULL CHECK (precio >= 0),
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS recetas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      variante_id TEXT NOT NULL REFERENCES variantes_producto(id) ON DELETE CASCADE,
      insumo_id TEXT NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
      cantidad_requerida REAL NOT NULL CHECK (cantidad_requerida > 0),
      UNIQUE (variante_id, insumo_id)
    );

    CREATE TABLE IF NOT EXISTS ubicaciones (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL UNIQUE,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS mesas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      ubicacion_id TEXT NOT NULL REFERENCES ubicaciones(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'libre' CHECK (estado IN ('libre', 'ocupada', 'reservada'))
    );

    CREATE TABLE IF NOT EXISTS cajas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      monto_apertura REAL NOT NULL DEFAULT 0 CHECK (monto_apertura >= 0),
      monto_cierre REAL NOT NULL DEFAULT 0 CHECK (monto_cierre >= 0),
      apertura_at TEXT NOT NULL DEFAULT (datetime('now')),
      cierre_at TEXT DEFAULT (datetime('now')),
      estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada'))
    );

    CREATE TABLE IF NOT EXISTS sesiones (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      caja_id TEXT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
      inicio_at TEXT NOT NULL DEFAULT (datetime('now')),
      fin_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      mesa_id TEXT REFERENCES mesas(id) ON DELETE SET NULL,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      caja_id TEXT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
      estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'enviado', 'listo', 'pagado', 'cancelado')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items_pedido (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      variante_id TEXT NOT NULL REFERENCES variantes_producto(id) ON DELETE RESTRICT,
      cantidad REAL NOT NULL CHECK (cantidad > 0),
      precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado'))
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      pedido_id TEXT NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
      caja_id TEXT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
      total REAL NOT NULL CHECK (total >= 0),
      monto_efectivo REAL NOT NULL DEFAULT 0 CHECK (monto_efectivo >= 0),
      monto_transferencia REAL NOT NULL DEFAULT 0 CHECK (monto_transferencia >= 0),
      metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'mixto')),
      pagado_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gastos_caja (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      caja_id TEXT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      monto REAL NOT NULL CHECK (monto >= 0),
      descripcion TEXT NOT NULL,
      categoria TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_usuarios_rol_id ON usuarios (rol_id);
    CREATE INDEX IF NOT EXISTS idx_insumos_proveedor_id ON insumos (proveedor_id);
    CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos (categoria_id);
    CREATE INDEX IF NOT EXISTS idx_variantes_producto_producto_id ON variantes_producto (producto_id);
    CREATE INDEX IF NOT EXISTS idx_recetas_variante_id ON recetas (variante_id);
    CREATE INDEX IF NOT EXISTS idx_recetas_insumo_id ON recetas (insumo_id);
    CREATE INDEX IF NOT EXISTS idx_mesas_ubicacion_id ON mesas (ubicacion_id);
    CREATE INDEX IF NOT EXISTS idx_cajas_usuario_id ON cajas (usuario_id);
    CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_id ON sesiones (usuario_id);
    CREATE INDEX IF NOT EXISTS idx_sesiones_caja_id ON sesiones (caja_id);
    CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_id ON pedidos (mesa_id);
    CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id ON pedidos (usuario_id);
    CREATE INDEX IF NOT EXISTS idx_pedidos_caja_id ON pedidos (caja_id);
    CREATE INDEX IF NOT EXISTS idx_items_pedido_pedido_id ON items_pedido (pedido_id);
    CREATE INDEX IF NOT EXISTS idx_items_pedido_variante_id ON items_pedido (variante_id);
    CREATE INDEX IF NOT EXISTS idx_ventas_pedido_id ON ventas (pedido_id);
    CREATE INDEX IF NOT EXISTS idx_ventas_caja_id ON ventas (caja_id);
    CREATE INDEX IF NOT EXISTS idx_gastos_caja_caja_id ON gastos_caja (caja_id);
    CREATE INDEX IF NOT EXISTS idx_gastos_caja_usuario_id ON gastos_caja (usuario_id);
  `);
}

module.exports = { runMigrations };