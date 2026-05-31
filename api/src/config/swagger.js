const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const ROUTE_DEFINITIONS = [
  { basePath: '/api/auth', routeFile: 'auth.js', tag: 'Auth' },
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
  const security = tag === 'Auth'
    ? (openApiPath.endsWith('/logout') ? [{ BearerAuth: [] }] : [])
    : [{ BearerAuth: [] }];

  const operation = {
    tags: [tag],
    summary: `${method.toUpperCase()} ${openApiPath}`,
    responses: {
      200: { description: 'Operacion exitosa' },
      400: { description: 'Solicitud invalida' },
      401: { description: 'Autenticacion requerida' },
      500: { description: 'Error interno' }
    },
    security
  };

  if (tag === 'Auth' && method === 'post' && openApiPath.endsWith('/login')) {
    operation.summary = 'Iniciar sesion';
    operation.description = 'Autentica al usuario usando nombre_completo y pin. No requiere token.';
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['nombre_completo', 'pin'],
            properties: {
              nombre_completo: {
                type: 'string',
                example: 'Admin Principal Lina'
              },
              pin: {
                oneOf: [
                  { type: 'string', example: '1234' },
                  { type: 'number', example: 1234 }
                ],
                description: 'PIN del usuario'
              }
            }
          },
          examples: {
            login: {
              value: {
                nombre_completo: 'Admin Principal Lina',
                pin: '1234'
              }
            }
          }
        }
      }
    };
    operation.responses = {
      200: {
        description: 'Login exitoso',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                usuario: {
                  type: 'object',
                  properties: {
                    nombre_completo: { type: 'string' },
                    rol: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      400: {
        description: 'Faltan campos requeridos',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string', example: 'nombre_completo y pin requeridos' }
              }
            }
          }
        }
      },
      401: {
        description: 'Credenciales invalidas',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string', example: 'Credenciales inválidas' }
              }
            }
          }
        }
      },
      500: { description: 'Error interno' }
    };
  }

  // Documentacion especifica para crear productos: incluir precio e insumos
  if (tag === 'Productos' && method === 'post' && openApiPath === '/api/productos') {
    operation.summary = 'Crear producto (con variante por defecto e insumos)';
    operation.description = 'Crea un producto y automáticamente crea una variante por defecto con el `precio` indicado. Además crea las recetas que enlazan la variante con los `insumos` proporcionados.';
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['categoria_id', 'nombre', 'precio', 'insumos'],
            properties: {
              categoria_id: { type: 'string', example: 'c3f1a2...' },
              nombre: { type: 'string', example: 'Cheesecake' },
              descripcion: { type: 'string', example: 'Postre frio de queso crema' },
              precio: { type: 'number', minimum: 0, example: 5000 },
              variante_nombre: { type: 'string', example: 'Porcion unica' },
              insumos: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['insumo_id', 'cantidad'],
                  properties: {
                    insumo_id: { type: 'string', example: 'a1b2c3...' },
                    cantidad: { type: 'number', minimum: 0.0001, example: 40 }
                  }
                }
              }
            }
          },
          examples: {
            producto_ejemplo: {
              value: {
                categoria_id: 'postresCategoriaId',
                nombre: 'Cheesecake',
                descripcion: 'Postre frío de queso crema',
                precio: 5000,
                insumos: [ { insumo_id: 'chocolateId', cantidad: 40 } ]
              }
            }
          }
        }
      }
    };

    operation.responses = {
      201: {
        description: 'Producto creado',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                categoria_id: { type: 'string' },
                nombre: { type: 'string' },
                descripcion: { type: 'string' },
                activo: { type: 'integer' },
                variantes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      nombre: { type: 'string' },
                      precio: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      400: { description: 'Solicitud inválida' },
      401: { description: 'Autenticación requerida' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Auth' && method === 'get' && openApiPath.endsWith('/usuarios')) {
    operation.summary = 'Listar usuarios activos para login';
    operation.description = 'Devuelve los usuarios activos disponibles para iniciar sesion.';
    operation.responses = {
      200: {
        description: 'Usuarios activos',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  nombre_completo: { type: 'string' },
                  rol: { type: 'string' }
                }
              }
            }
          }
        }
      },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Auth' && method === 'post' && openApiPath.endsWith('/logout')) {
    operation.summary = 'Cerrar sesion';
    operation.description = 'Finaliza la sesion activa del usuario autenticado.';
    operation.responses = {
      200: {
        description: 'Sesion cerrada correctamente',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Sesión cerrada correctamente' }
              }
            }
          }
        }
      },
      404: {
        description: 'No hay sesion activa',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string', example: 'No hay sesión activa' }
              }
            }
          }
        }
      },
      401: { description: 'Autenticacion requerida' },
      500: { description: 'Error interno' }
    };
  }

  const pathParameters = buildPathParameters(openApiPath);

  if (pathParameters.length > 0) {
    operation.parameters = pathParameters;
  }

  if (['post', 'put', 'patch'].includes(method) && !operation.requestBody) {
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
    { name: 'Auth' },
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
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT del usuario autenticado en SmartTable.'
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
