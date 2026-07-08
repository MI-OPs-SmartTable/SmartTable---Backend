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

### Notas de entorno (dev/prod)

- Algunas rutas tienen permisos distintos entre desarrollo y producción.
- En producción se exige autenticación/rol en endpoints sensibles y ciertas operaciones quedan bloqueadas.
- Para evitar comportamientos inesperados, define explícitamente `environment=DEVELOPMENT` en local y `environment=PRODUCTION` en despliegues.

Si tu frontend corre en otro puerto u host, define también `CORS_ORIGIN` para autorizar uno o varios orígenes separados por comas. Por defecto el backend permite `http://localhost:3030` y `http://localhost:5173`.

```env
CORS_ORIGIN=http://localhost:3030,http://localhost:5173
```

## Respaldo automático de la base de datos

El backend incluye un servicio que crea copias de seguridad de SQLite de forma periódica. Se inicia automáticamente al levantar el servidor (`npm start`).

### Comportamiento

- Crea un respaldo seguro con `better-sqlite3` (compatible con modo `WAL`).
- Comprime el archivo como `.db.gz`.
- Usa siempre el mismo nombre de archivo y lo sobrescribe localmente en cada ciclo.
- Por defecto guarda la copia en una carpeta `backups/` junto al archivo de la base de datos (`pos.db`).
- Opcionalmente sube el mismo archivo a Google Drive, actualizándolo si ya existe.

### Configuración

La configuración del respaldo se gestiona desde la app, en **Configuración → Respaldo** (solo admin). Se guarda en `backup-config.json` junto a la base de datos.

En la app de escritorio (Electron), eso queda en la carpeta de datos del usuario (`AppData`), no en la carpeta de instalación.

### Configurar Google Drive

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita la API de **Google Drive**.
3. Crea una **cuenta de servicio** y descarga el JSON de credenciales.
4. Crea una carpeta en Google Drive y compártela con el email de la cuenta de servicio (permiso de editor).
5. En la app, ve a **Configuración → Respaldo**, sube el JSON, pega el ID de la carpeta y activa Google Drive.

### Ejecución manual

Para probar un respaldo sin esperar al intervalo:

```bash
npm run backup:run
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
	- El login usa `nombre_completo`; ahora el backend evita crear/editar usuarios activos con nombres duplicados para evitar ambigüedad.
	- El JWT se firma con la variable de entorno `JWT_SECRET` y su expiración puede establecerse con `JWT_EXPIRES_IN` (por defecto `8h`).

## Observación de codificación

Si en tu editor algunos acentos se ven raros, revisa que el archivo esté en UTF-8. Eso no cambia la lógica del backend.

