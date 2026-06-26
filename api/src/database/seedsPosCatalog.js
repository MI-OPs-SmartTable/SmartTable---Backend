/**
 * Catálogo POS (productos, categorías e insumos del menú original).
 * Ejecutar: npm run seed:pos
 * No borra datos existentes; solo inserta si aún no existe la categoría "Comidas Rápidas".
 */
const db = require('./db');
const { newId } = require('../models/_utils');

const CATEGORIAS = [
  'Comidas Rápidas',
  'Platos del Día',
  'Bebidas',
  'Acompañantes',
  'Postres',
];

const INSUMOS = [
  { key: 'i01', nombre: 'Pan de hamburguesa', unidad: 'unidad' },
  { key: 'i02', nombre: 'Carne de res (100g)', unidad: 'porción' },
  { key: 'i03', nombre: 'Lechuga', unidad: 'gramos' },
  { key: 'i04', nombre: 'Tomate', unidad: 'gramos' },
  { key: 'i05', nombre: 'Queso tajado', unidad: 'tajada' },
  { key: 'i06', nombre: 'Papa', unidad: 'kg' },
  { key: 'i07', nombre: 'Arroz', unidad: 'kg' },
  { key: 'i08', nombre: 'Frijoles', unidad: 'kg' },
  { key: 'i09', nombre: 'Chicharrón', unidad: 'porción' },
  { key: 'i10', nombre: 'Salchicha', unidad: 'unidad' },
  { key: 'i11', nombre: 'Pan perro', unidad: 'unidad' },
  { key: 'i12', nombre: 'Coca Cola 350ml', unidad: 'unidad' },
  { key: 'i13', nombre: 'Agua 500ml', unidad: 'unidad' },
  { key: 'i14', nombre: 'Cerveza 330ml', unidad: 'unidad' },
  { key: 'i15', nombre: 'Jugo natural', unidad: 'unidad' },
];

const PRODUCTOS = [
  {
    nombre: 'Hamburguesa Clásica',
    descripcion: 'Carne, lechuga, tomate y queso',
    precio: 15000,
    categoria: 'Comidas Rápidas',
    activo: 1,
    insumos: [
      { key: 'i01', cantidad: 1 },
      { key: 'i02', cantidad: 1 },
      { key: 'i03', cantidad: 20 },
      { key: 'i04', cantidad: 30 },
      { key: 'i05', cantidad: 2 },
    ],
  },
  {
    nombre: 'Hamburguesa Doble',
    descripcion: 'Doble carne, doble queso',
    precio: 18000,
    categoria: 'Comidas Rápidas',
    activo: 1,
    insumos: [
      { key: 'i01', cantidad: 1 },
      { key: 'i02', cantidad: 2 },
      { key: 'i05', cantidad: 4 },
    ],
  },
  {
    nombre: 'Hot Dog',
    descripcion: 'Salchicha, mostaza y ketchup',
    precio: 10000,
    categoria: 'Comidas Rápidas',
    activo: 1,
    insumos: [
      { key: 'i10', cantidad: 1 },
      { key: 'i11', cantidad: 1 },
    ],
  },
  {
    nombre: 'Perro con Todo',
    descripcion: 'Salchicha con todos los aderezos',
    precio: 12000,
    categoria: 'Comidas Rápidas',
    activo: 1,
    insumos: [
      { key: 'i10', cantidad: 1 },
      { key: 'i11', cantidad: 1 },
    ],
  },
  {
    nombre: 'Bandeja Paisa',
    descripcion: 'Arroz, frijoles, chicharrón, carne',
    precio: 22000,
    categoria: 'Platos del Día',
    activo: 1,
    insumos: [
      { key: 'i07', cantidad: 0.2 },
      { key: 'i08', cantidad: 0.15 },
      { key: 'i09', cantidad: 1 },
      { key: 'i02', cantidad: 1 },
    ],
  },
  {
    nombre: 'Sopa del Día',
    descripcion: 'Sopa casera según el día',
    precio: 15000,
    categoria: 'Platos del Día',
    activo: 1,
    insumos: [{ key: 'i07', cantidad: 0.05 }],
  },
  {
    nombre: 'Almuerzo Corriente',
    descripcion: 'Sopa, seco, jugo y postre',
    precio: 18000,
    categoria: 'Platos del Día',
    activo: 1,
    insumos: [{ key: 'i07', cantidad: 0.1 }],
  },
  {
    nombre: 'Papas Fritas',
    descripcion: 'Papas fritas crocantes',
    precio: 8000,
    categoria: 'Acompañantes',
    activo: 1,
    insumos: [{ key: 'i06', cantidad: 0.3 }],
  },
  {
    nombre: 'Coca Cola',
    descripcion: 'Refresco 350ml',
    precio: 4000,
    categoria: 'Bebidas',
    activo: 1,
    insumos: [{ key: 'i12', cantidad: 1 }],
  },
  {
    nombre: 'Cerveza',
    descripcion: 'Cerveza fría 330ml',
    precio: 5000,
    categoria: 'Bebidas',
    activo: 0,
    insumos: [{ key: 'i14', cantidad: 1 }],
  },
];

function ensureProveedor() {
  let row = db.prepare('SELECT id FROM proveedores WHERE activo = 1 LIMIT 1').get();
  if (row) return row.id;

  const id = newId();
  db.prepare(
    'INSERT INTO proveedores (id, nombre_empresa, persona_contacto, telefono, email, direccion, activo) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).run(id, 'Proveedor General', 'Contacto POS', '3000000000', 'pos@local.com', 'N/A');
  return id;
}

function runPosCatalogSeeds() {
  const exists = db.prepare('SELECT id FROM categorias WHERE nombre = ? AND activo = 1').get('Comidas Rápidas');
  if (exists) {
    console.log('Catálogo POS ya cargado (Comidas Rápidas existe). Use seed:pos --force para recargar.');
    return { skipped: true };
  }

  const proveedorId = ensureProveedor();
  const catIds = {};
  const insumoIds = {};

  const tx = db.transaction(() => {
    for (const nombre of CATEGORIAS) {
      const id = newId();
      db.prepare('INSERT INTO categorias (id, nombre, activo) VALUES (?, ?, 1)').run(id, nombre);
      catIds[nombre] = id;
    }

    for (const insumo of INSUMOS) {
      const id = newId();
      db.prepare(
        'INSERT INTO insumos (id, proveedor_id, nombre, unidad, cantidad_actual, stock_minimo, costo_unitario, activo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
      ).run(id, proveedorId, insumo.nombre, insumo.unidad, 500, 50, 1);
      insumoIds[insumo.key] = id;
    }

    for (const prod of PRODUCTOS) {
      const productoId = newId();
      const categoriaId = catIds[prod.categoria];
      db.prepare('INSERT INTO productos (id, categoria_id, nombre, descripcion, activo) VALUES (?, ?, ?, ?, ?)').run(
        productoId,
        categoriaId,
        prod.nombre,
        prod.descripcion,
        prod.activo
      );

      const varianteId = newId();
      db.prepare(
        'INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, 1)'
      ).run(varianteId, productoId, prod.nombre, prod.precio);

      for (const item of prod.insumos) {
        const insumoId = insumoIds[item.key];
        const recetaId = newId();
        db.prepare(
          'INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)'
        ).run(recetaId, varianteId, insumoId, item.cantidad);
      }
    }
  });

  tx();
  console.log('Catálogo POS insertado: 5 categorías, 15 insumos, 10 productos.');
  return { skipped: false };
}

function forcePosCatalogSeeds() {
  db.transaction(() => {
    db.prepare('DELETE FROM recetas').run();
    db.prepare('DELETE FROM items_pedido').run();
    db.prepare('DELETE FROM variantes_producto').run();
    db.prepare('DELETE FROM productos').run();
    db.prepare('DELETE FROM insumos').run();
    db.prepare('DELETE FROM categorias').run();
  })();

  const exists = db.prepare('SELECT id FROM categorias WHERE nombre = ?').get('__never__');
  void exists;

  const proveedorId = ensureProveedor();
  const catIds = {};
  const insumoIds = {};

  const tx = db.transaction(() => {
    for (const nombre of CATEGORIAS) {
      const id = newId();
      db.prepare('INSERT INTO categorias (id, nombre, activo) VALUES (?, ?, 1)').run(id, nombre);
      catIds[nombre] = id;
    }

    for (const insumo of INSUMOS) {
      const id = newId();
      db.prepare(
        'INSERT INTO insumos (id, proveedor_id, nombre, unidad, cantidad_actual, stock_minimo, costo_unitario, activo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
      ).run(id, proveedorId, insumo.nombre, insumo.unidad, 500, 50, 1);
      insumoIds[insumo.key] = id;
    }

    for (const prod of PRODUCTOS) {
      const productoId = newId();
      const categoriaId = catIds[prod.categoria];
      db.prepare('INSERT INTO productos (id, categoria_id, nombre, descripcion, activo) VALUES (?, ?, ?, ?, ?)').run(
        productoId,
        categoriaId,
        prod.nombre,
        prod.descripcion,
        prod.activo
      );

      const varianteId = newId();
      db.prepare(
        'INSERT INTO variantes_producto (id, producto_id, nombre, precio, activo) VALUES (?, ?, ?, ?, 1)'
      ).run(varianteId, productoId, prod.nombre, prod.precio);

      for (const item of prod.insumos) {
        const insumoId = insumoIds[item.key];
        const recetaId = newId();
        db.prepare(
          'INSERT INTO recetas (id, variante_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?, ?)'
        ).run(recetaId, varianteId, insumoId, item.cantidad);
      }
    }
  });

  tx();
  console.log('Catálogo POS recargado (modo --force).');
}

module.exports = { runPosCatalogSeeds, forcePosCatalogSeeds };

if (require.main === module) {
  const force = process.argv.includes('--force');
  try {
    if (force) {
      forcePosCatalogSeeds();
    } else {
      runPosCatalogSeeds();
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
