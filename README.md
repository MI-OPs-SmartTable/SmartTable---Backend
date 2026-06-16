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

## Configuración de entorno

El proyecto usa un solo archivo `.env` en la raíz. Define la variable `environment` con uno de estos valores:

```env
environment=DEVELOPMENT
```

o

```env
environment=PRODUCTION
```

Según ese valor, la app toma automáticamente el secreto correspondiente desde `JWT_SECRET_DEVELOPMENT` o `JWT_SECRET_PRODUCTION` y también ajusta `NODE_ENV` para mantener compatibilidad con el resto del código.

Si tu frontend corre en otro puerto u host, define también `CORS_ORIGIN` para autorizar uno o varios orígenes separados por comas. Por defecto el backend permite `http://localhost:3030` y `http://localhost:5173`.

```env
CORS_ORIGIN=http://localhost:3030,http://localhost:5173
```

## Documentacion Swagger

Con el servidor encendido, puedes ver la documentacion interactiva en:

```text
http://localhost:8080/api/docs
```

Tambien puedes acceder al documento OpenAPI en JSON en:

```text
http://localhost:8080/api/docs.json
```

## Autenticación (login)

El endpoint de autenticación ahora utiliza el nombre completo del usuario en lugar del identificador numérico.

- Ruta: `POST /api/auth/login`
- Payload (JSON):

```json
{
	"nombre_completo": "Admin Principal Lina",
	"pin": "1234"
}
```

- Respuestas principales:
	- `200` — Login exitoso. Devuelve un JWT y datos básicos del usuario:

```json
{
	"token": "eyJ...",
	"usuario": {
		"nombre_completo": "Admin Principal Lina",
		"rol": "admin"
	}
}
```

	- `400` — Faltan campos requeridos: `{ "error": "nombre_completo y pin requeridos" }`.
	- `401` — Credenciales inválidas: `{ "error": "Credenciales inválidas" }`.

- Notas:
	- El servidor espera que `nombre_completo` identifique al usuario; si tu base de datos permite duplicados, considera usar un identificador único (como `email` o `username`).
	- El JWT se firma con la variable de entorno `JWT_SECRET` y su expiración puede establecerse con `JWT_EXPIRES_IN` (por defecto `8h`).

