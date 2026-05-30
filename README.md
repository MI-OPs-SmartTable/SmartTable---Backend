# SmartTable Backend

## Avances actuales

El backend del sistema POS ya cuenta con una base sólida de persistencia y acceso a datos construida sobre `better-sqlite3`.

### Estado implementado

- Esquema SQLite completo para la operación del POS, con tablas para roles, usuarios, proveedores, categorías, insumos, productos, variantes, recetas, ubicaciones, mesas, cajas, sesiones, pedidos, items de pedido, ventas y gastos de caja.
- Migraciones centralizadas en `api/src/database/migrations.js`, con llaves UUID en texto, restricciones `CHECK`, claves foráneas, índices y soporte para `WAL` y `foreign_keys`.
- Capa de modelos en `api/src/models/` con funciones nombradas, consultas preparadas y validaciones de negocio.
- Rutas Express en `api/src/routes/` para CRUD, consultas especializadas y acciones como apertura/cierre de caja, gestión de pedidos, ventas y gastos.
- Archivo `api/src/app.js` creado para montar todos los routers bajo `/api/*`.
- Validaciones básicas ya incluidas en el flujo del backend, como control de campos requeridos, estado de caja abierta, control de stock y respuestas HTTP consistentes.

### Siguiente enfoque sugerido

- Conectar estas rutas con el frontend o con un cliente API.
- Agregar pruebas para los flujos críticos: pedidos, ventas, cajas y stock.
- Revisar casos de negocio adicionales, como ajustes de inventario y cierre de sesión/caja.

## Instalación de dependencias

Para descargar los módulos de Node.js del proyecto, ejecuta estos comandos desde la raíz del repositorio:

```bash
npm install
```

Si quieres instalar solo las dependencias principales de forma manual, también puedes usar:

```bash
npm install express cors dotenv better-sqlite3
```
