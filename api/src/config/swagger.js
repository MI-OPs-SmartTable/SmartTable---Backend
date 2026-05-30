const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const ROUTE_DEFINITIONS = [
  { basePath: '/api/roles', routeFile: 'roles.js', tag: 'Roles' },
  { basePath: '/api/usuarios', routeFile: 'usuarios.js', tag: 'Usuarios' },
  { basePath: '/api/proveedores', routeFile: 'proveedores.js', tag: 'Proveedores' },
  { basePath: '/api/categorias', routeFile: 'categorias.js', tag: 'Categorias' },
  { basePath: '/api/insumos', routeFile: 'insumos.js', tag: 'Insumos' },
  { basePath: '/api/productos', routeFile: 'productos.js', tag: 'Productos' },
  { basePath: '/api/variantes', routeFile: 'variantes.js', tag: 'Variantes' },
  { basePath: '/api/recetas', routeFile: 'recetas.js', tag: 'Recetas' },
  { basePath: '/api/ubicaciones', routeFile: 'ubicaciones.js', tag: 'Ubicaciones' },
  { basePath: '/api/mesas', routeFile: 'mesas.js', tag: 'Mesas' },
  { basePath: '/api/cajas', routeFile: 'cajas.js', tag: 'Cajas' },
  { basePath: '/api/sesiones', routeFile: 'sesiones.js', tag: 'Sesiones' },
  { basePath: '/api/pedidos', routeFile: 'pedidos.js', tag: 'Pedidos' },
  { basePath: '/api/items-pedido', routeFile: 'items_pedido.js', tag: 'ItemsPedido' },
  { basePath: '/api/ventas', routeFile: 'ventas.js', tag: 'Ventas' },
  { basePath: '/api/gastos-caja', routeFile: 'gastos_caja.js', tag: 'GastosCaja' }
];

function joinPaths(basePath, routePath) {
  const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const route = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return route === '/' ? base : `${base}${route}`;
}

function convertToOpenApiPath(expressPath) {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function buildPathParameters(openApiPath) {
  const matches = [...openApiPath.matchAll(/\{([^}]+)\}/g)];

  return matches.map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' }
  }));
}

function buildOperation(method, openApiPath, tag) {
  const operation = {
    tags: [tag],
    summary: `${method.toUpperCase()} ${openApiPath}`,
    responses: {
      200: { description: 'Operacion exitosa' },
      400: { description: 'Solicitud invalida' },
      401: { description: 'Autenticacion requerida' },
      500: { description: 'Error interno' }
    },
    security: [{ UsuarioIdHeader: [] }]
  };

  const pathParameters = buildPathParameters(openApiPath);

  if (pathParameters.length > 0) {
    operation.parameters = pathParameters;
  }

  if (['post', 'put', 'patch'].includes(method)) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: true
          }
        }
      }
    };
  }

  return operation;
}

function collectRoutePaths(basePath, routeFile, tag) {
  const routesPath = path.join(__dirname, '..', 'routes', routeFile);
  const router = require(routesPath);
  const openApiPaths = {};

  if (!router || !Array.isArray(router.stack)) {
    return openApiPaths;
  }

  router.stack.forEach((layer) => {
    if (!layer.route || typeof layer.route.path !== 'string') {
      return;
    }

    const fullExpressPath = joinPaths(basePath, layer.route.path);
    const openApiPath = convertToOpenApiPath(fullExpressPath);

    if (!openApiPaths[openApiPath]) {
      openApiPaths[openApiPath] = {};
    }

    Object.entries(layer.route.methods).forEach(([method, enabled]) => {
      if (!enabled) {
        return;
      }

      openApiPaths[openApiPath][method] = buildOperation(method, openApiPath, tag);
    });
  });

  return openApiPaths;
}

function buildPaths() {
  const generatedPaths = {
    '/': {
      get: {
        tags: ['Sistema'],
        summary: 'Estado basico del servidor',
        security: [],
        responses: {
          200: { description: 'Servidor en ejecucion' }
        }
      }
    }
  };

  ROUTE_DEFINITIONS.forEach(({ basePath, routeFile, tag }) => {
    const routePaths = collectRoutePaths(basePath, routeFile, tag);

    Object.entries(routePaths).forEach(([openApiPath, methods]) => {
      generatedPaths[openApiPath] = {
        ...(generatedPaths[openApiPath] || {}),
        ...methods
      };
    });
  });

  return generatedPaths;
}

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'SmartTable API',
    version: '1.0.0',
    description: 'Documentacion generada automaticamente a partir de las rutas de Express.'
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 8080}`,
      description: 'Servidor local'
    }
  ],
  tags: [
    { name: 'Sistema' },
    { name: 'Roles' },
    { name: 'Usuarios' },
    { name: 'Proveedores' },
    { name: 'Categorias' },
    { name: 'Insumos' },
    { name: 'Productos' },
    { name: 'Variantes' },
    { name: 'Recetas' },
    { name: 'Ubicaciones' },
    { name: 'Mesas' },
    { name: 'Cajas' },
    { name: 'Sesiones' },
    { name: 'Pedidos' },
    { name: 'ItemsPedido' },
    { name: 'Ventas' },
    { name: 'GastosCaja' }
  ],
  components: {
    securitySchemes: {
      UsuarioIdHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-usuario-id',
        description: 'ID del usuario autenticado en SmartTable.'
      }
    }
  },
  paths: buildPaths()
};

const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: []
});

module.exports = {
  swaggerUi,
  swaggerSpec
};
