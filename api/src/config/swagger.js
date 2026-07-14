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
  { basePath: '/api/medios-pago-transferencia', routeFile: 'medios_pago_transferencia.js', tag: 'MediosPagoTransferencia' },
  { basePath: '/api/ventas', routeFile: 'ventas.js', tag: 'Ventas' },
  { basePath: '/api/gastos-caja', routeFile: 'gastos_caja.js', tag: 'GastosCaja' },
  { basePath: '/api/reportes', routeFile: 'reportes.js', tag: 'Reportes' }
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
    description: match[1] === 'id'
      ? 'Identificador del recurso.'
      : `Identificador de ${match[1].replace(/_id$/, '').replace(/_/g, ' ')}.`,
    schema: {
      type: 'string',
      example: `${match[1]}_123`
    }
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

  if (tag === 'MediosPagoTransferencia' && method === 'post' && openApiPath === '/api/medios-pago-transferencia') {
    operation.summary = 'Crear medio de pago por transferencia';
    operation.description = 'Registra un medio de pago por transferencia que luego puede asociarse a ventas.';
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['nombre'],
            properties: {
              nombre: {
                type: 'string',
                example: 'Bancolombia'
              }
            }
          },
          examples: {
            medio_transferencia: {
              value: {
                nombre: 'Bancolombia'
              }
            }
          }
        }
      }
    };
    operation.responses = {
      201: {
        description: 'Medio de pago creado',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                nombre: { type: 'string' },
                activo: { type: 'integer' }
              }
            }
          }
        }
      },
      400: {
        description: 'Falta el nombre',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string', example: 'Campo nombre requerido' }
              }
            }
          }
        }
      },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Cajas' && method === 'get' && openApiPath.endsWith('/abiertas-con-colaboradores')) {
    operation.summary = 'Listar cajas abiertas con colaboradores';
    operation.description = 'Devuelve todas las cajas abiertas junto con las sesiones colaborador activas asociadas.';
    operation.responses = {
      200: {
        description: 'Listado de cajas abiertas con colaboradores',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  usuario_id: { type: 'string' },
                  estado: { type: 'string' },
                  colaboradores: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sesion_id: { type: 'string' },
                        usuario_id: { type: 'string' },
                        caja_id: { type: 'string' },
                        rol_sesion: { type: 'string', example: 'colaborador' },
                        inicio_at: { type: 'string' },
                        fin_at: { type: 'string', nullable: true },
                        nombre_completo: { type: 'string' },
                        email: { type: 'string' },
                        rol: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Cajas' && method === 'get' && /\/api\/cajas\/\{id\}\/colaboradores$/.test(openApiPath)) {
    operation.summary = 'Listar colaboradores de una caja';
    operation.description = 'Devuelve la caja y las sesiones colaborador activas asociadas.';
    operation.responses = {
      200: {
        description: 'Colaboradores de la caja',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                caja: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    usuario_id: { type: 'string' },
                    estado: { type: 'string' }
                  }
                },
                colaboradores: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      sesion_id: { type: 'string' },
                      usuario_id: { type: 'string' },
                      caja_id: { type: 'string' },
                      rol_sesion: { type: 'string', example: 'colaborador' },
                      inicio_at: { type: 'string' },
                      fin_at: { type: 'string', nullable: true },
                      nombre_completo: { type: 'string' },
                      email: { type: 'string' },
                      rol: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      404: { description: 'Caja no encontrada' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Cajas' && method === 'post' && openApiPath === '/api/cajas/abrir') {
    operation.summary = 'Abrir caja con sesion titular';
    operation.description = 'Abre una caja y crea la sesion titular asociada. Solo disponible para admin o cajero.';
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['usuario_id', 'monto_apertura'],
            properties: {
              usuario_id: { type: 'string', example: 'usuario_titular_123' },
              monto_apertura: { type: 'number', minimum: 0, example: 50000 },
              inicio_at: { type: 'string', nullable: true, example: '2026-07-01T10:00:00.000Z' }
            }
          },
          examples: {
            apertura_caja: {
              value: {
                usuario_id: 'usuario_titular_123',
                monto_apertura: 50000
              }
            }
          }
        }
      }
    };
    operation.responses = {
      201: {
        description: 'Caja abierta',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                usuario_id: { type: 'string' },
                monto_apertura: { type: 'number' },
                estado: { type: 'string' }
              }
            }
          }
        }
      },
      400: { description: 'Solicitud invalida' },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      409: {
        description: 'Conflicto de sesion o caja abierta',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Cajas' && method === 'post' && /\/api\/cajas\/\{id\}\/colaboradores$/.test(openApiPath)) {
    operation.summary = 'Agregar colaborador a una caja';
    operation.description = 'Crea una sesion colaborador para una caja ya abierta. Solo el titular de la caja o un admin puede usarlo.';
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['usuario_id'],
            properties: {
              usuario_id: { type: 'string', example: 'usuario_colaborador_123' },
              inicio_at: { type: 'string', nullable: true, example: '2026-07-01T11:00:00.000Z' }
            }
          },
          examples: {
            colaborador: {
              value: {
                usuario_id: 'usuario_colaborador_123'
              }
            }
          }
        }
      }
    };
    operation.responses = {
      201: {
        description: 'Colaborador agregado',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                usuario_id: { type: 'string' },
                caja_id: { type: 'string' },
                rol_sesion: { type: 'string', example: 'colaborador' },
                inicio_at: { type: 'string' },
                fin_at: { type: 'string', nullable: true }
              }
            }
          }
        }
      },
      400: { description: 'Solicitud invalida' },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      404: { description: 'Caja no encontrada' },
      409: {
        description: 'El usuario ya tiene una sesion activa',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Cajas' && method === 'post' && openApiPath.endsWith('/cerrar')) {
    operation.summary = 'Cerrar caja y sus sesiones';
    operation.description = 'Cierra la caja y finaliza en cascada todas las sesiones activas asociadas.';
    operation.responses = {
      200: {
        description: 'Caja cerrada',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                usuario_id: { type: 'string' },
                estado: { type: 'string', example: 'cerrada' },
                cierre_at: { type: 'string' }
              }
            }
          }
        }
      },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      404: { description: 'No encontrado' },
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

  if (tag === 'Ventas' && method === 'post' && openApiPath === '/api/ventas') {
    operation.summary = 'Registrar venta';
    operation.description = 'Registra el pago de un pedido usando efectivo, transferencia o ambos. La caja se toma del pedido y el cobrador debe tener una sesion activa en esa caja. Si hay transferencia, debe enviarse un medio_transferencia_id válido.';
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['pedido_id', 'pagos'],
            properties: {
              pedido_id: { type: 'string', example: 'pedido_123' },
              pagos: {
                type: 'object',
                required: ['monto_efectivo', 'monto_transferencia'],
                properties: {
                  monto_efectivo: {
                    type: 'number',
                    minimum: 0,
                    example: 0
                  },
                  monto_transferencia: {
                    type: 'number',
                    minimum: 0,
                    example: 32000
                  },
                  medio_transferencia_id: {
                    type: 'string',
                    nullable: true,
                    example: 'medio_transferencia_123'
                  },
                  comentario: {
                    type: 'string',
                    nullable: true,
                    example: 'Pago aprobado por Nequi'
                  }
                }
              }
            }
          },
          examples: {
            venta_transferencia: {
              value: {
                pedido_id: 'pedido_123',
                pagos: {
                  monto_efectivo: 0,
                  monto_transferencia: 32000,
                  medio_transferencia_id: 'medio_transferencia_123',
                  comentario: 'Pago aprobado por Nequi'
                }
              }
            }
          }
        }
      }
    };
    operation.responses = {
      201: {
        description: 'Venta registrada',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                pedido_id: { type: 'string' },
                caja_id: { type: 'string' },
                usuario_cobro_id: { type: 'string' },
                total: { type: 'number' },
                monto_efectivo: { type: 'number' },
                monto_transferencia: { type: 'number' },
                medio_transferencia_id: { type: 'string', nullable: true },
                comentario: { type: 'string', nullable: true },
                metodo_pago: { type: 'string' },
                pagado_at: { type: 'string' }
              }
            }
          }
        }
      },
      400: { description: 'Solicitud inválida' },
      401: { description: 'Autenticación requerida' },
      403: { description: 'No autorizado' },
      409: { description: 'El usuario no tiene una sesion activa en esa caja' },
      404: { description: 'No encontrado' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Pedidos' && method === 'post' && openApiPath === '/api/pedidos') {
    operation.summary = 'Crear pedido en la caja activa del usuario';
    operation.description = 'Crea un pedido usando la caja activa asociada a la sesion del usuario autenticado. No recibe caja_id en el cuerpo.';
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['usuario_id', 'items'],
            properties: {
              usuario_id: { type: 'string', example: 'usuario_mesero_123' },
              mesa_id: { type: 'string', nullable: true, example: 'mesa_123' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['variante_id', 'cantidad'],
                  properties: {
                    variante_id: { type: 'string', example: 'variante_123' },
                    cantidad: { type: 'number', minimum: 0.0001, example: 1 },
                    precio_unitario: { type: 'number', minimum: 0, nullable: true, example: 3500 },
                    nota: { type: 'string', nullable: true, example: 'Sin cebolla' }
                  }
                }
              }
            }
          }
        }
      }
    };
    operation.responses = {
      201: {
        description: 'Pedido creado',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                usuario_id: { type: 'string' },
                caja_id: { type: 'string' },
                mesa_id: { type: 'string', nullable: true },
                estado: { type: 'string' },
                created_at: { type: 'string' }
              }
            }
          }
        }
      },
      400: { description: 'Solicitud invalida' },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      409: { description: 'El usuario no tiene una sesion de caja activa' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Reportes' && method === 'get' && openApiPath.endsWith('/top-productos')) {
    operation.summary = 'Productos más vendidos';
    operation.description = 'Devuelve el ranking de productos más vendidos (por cantidad) calculado sobre ventas ya pagadas. Permite filtrar por periodo (semana/mes) relativo a una fecha de referencia, o por un rango de fechas explícito (desde/hasta). Solo disponible para admin.';
    operation.parameters = [
      {
        name: 'periodo',
        in: 'query',
        required: false,
        description: 'Periodo relativo a filtrar. Se ignora si se envían desde/hasta.',
        schema: { type: 'string', enum: ['semana', 'mes'], default: 'mes' }
      },
      {
        name: 'fecha',
        in: 'query',
        required: false,
        description: 'Fecha de referencia (YYYY-MM-DD) dentro de la semana/mes a consultar. Por defecto, hoy.',
        schema: { type: 'string', example: '2026-07-10' }
      },
      {
        name: 'desde',
        in: 'query',
        required: false,
        description: 'Fecha inicial (YYYY-MM-DD) para un rango personalizado. Requiere enviar también hasta.',
        schema: { type: 'string', example: '2026-07-01' }
      },
      {
        name: 'hasta',
        in: 'query',
        required: false,
        description: 'Fecha final (YYYY-MM-DD) para un rango personalizado. Requiere enviar también desde.',
        schema: { type: 'string', example: '2026-07-10' }
      },
      {
        name: 'limite',
        in: 'query',
        required: false,
        description: 'Cantidad de productos a devolver (top N). Por defecto 5.',
        schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 }
      }
    ];
    operation.responses = {
      200: {
        description: 'Ranking de productos más vendidos',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                periodo: { type: 'string', example: 'mes' },
                desde: { type: 'string', example: '2026-07-01 00:00:00' },
                hasta: { type: 'string', example: '2026-07-31 23:59:59' },
                productos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      producto_id: { type: 'string' },
                      producto: { type: 'string', example: 'Café' },
                      cantidad_vendida: { type: 'number', example: 42 },
                      total_vendido: { type: 'number', example: 176400 }
                    }
                  }
                }
              }
            }
          }
        }
      },
      400: { description: 'Filtros inválidos (periodo, fecha o límite)' },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Reportes' && method === 'get' && openApiPath.endsWith('/ventas-resumen')) {
    operation.summary = 'Resumen de ventas';
    operation.description = 'Devuelve la cantidad e importe total de ventas pagadas en un periodo (semana/mes) o rango de fechas, desglosado por medio de pago. Solo disponible para admin.';
    operation.parameters = [
      { name: 'periodo', in: 'query', required: false, description: 'Periodo relativo a filtrar. Se ignora si se envían desde/hasta.', schema: { type: 'string', enum: ['semana', 'mes'], default: 'mes' } },
      { name: 'fecha', in: 'query', required: false, description: 'Fecha de referencia (YYYY-MM-DD) dentro de la semana/mes a consultar. Por defecto, hoy.', schema: { type: 'string', example: '2026-07-10' } },
      { name: 'desde', in: 'query', required: false, description: 'Fecha inicial (YYYY-MM-DD) para un rango personalizado. Requiere enviar también hasta.', schema: { type: 'string', example: '2026-07-01' } },
      { name: 'hasta', in: 'query', required: false, description: 'Fecha final (YYYY-MM-DD) para un rango personalizado. Requiere enviar también desde.', schema: { type: 'string', example: '2026-07-10' } }
    ];
    operation.responses = {
      200: {
        description: 'Resumen de ventas del periodo',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                periodo: { type: 'string', example: 'mes' },
                desde: { type: 'string', example: '2026-07-01 00:00:00' },
                hasta: { type: 'string', example: '2026-07-31 23:59:59' },
                cantidad_ventas: { type: 'number', example: 120 },
                total_ventas: { type: 'number', example: 3500000 },
                total_efectivo: { type: 'number', example: 2000000 },
                total_transferencia: { type: 'number', example: 1500000 }
              }
            }
          }
        }
      },
      400: { description: 'Filtros inválidos (periodo, fecha o rango)' },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Reportes' && method === 'get' && openApiPath.endsWith('/gastos-resumen')) {
    operation.summary = 'Resumen de gastos de caja';
    operation.description = 'Devuelve la cantidad e importe total de gastos de caja registrados en un periodo (semana/mes) o rango de fechas. Solo disponible para admin.';
    operation.parameters = [
      { name: 'periodo', in: 'query', required: false, description: 'Periodo relativo a filtrar. Se ignora si se envían desde/hasta.', schema: { type: 'string', enum: ['semana', 'mes'], default: 'mes' } },
      { name: 'fecha', in: 'query', required: false, description: 'Fecha de referencia (YYYY-MM-DD) dentro de la semana/mes a consultar. Por defecto, hoy.', schema: { type: 'string', example: '2026-07-10' } },
      { name: 'desde', in: 'query', required: false, description: 'Fecha inicial (YYYY-MM-DD) para un rango personalizado. Requiere enviar también hasta.', schema: { type: 'string', example: '2026-07-01' } },
      { name: 'hasta', in: 'query', required: false, description: 'Fecha final (YYYY-MM-DD) para un rango personalizado. Requiere enviar también desde.', schema: { type: 'string', example: '2026-07-10' } }
    ];
    operation.responses = {
      200: {
        description: 'Resumen de gastos del periodo',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                periodo: { type: 'string', example: 'mes' },
                desde: { type: 'string', example: '2026-07-01 00:00:00' },
                hasta: { type: 'string', example: '2026-07-31 23:59:59' },
                cantidad_gastos: { type: 'number', example: 8 },
                total_gastos: { type: 'number', example: 450000 }
              }
            }
          }
        }
      },
      400: { description: 'Filtros inválidos (periodo, fecha o rango)' },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Reportes' && method === 'get' && openApiPath.endsWith('/dashboard')) {
    operation.summary = 'Resumen consolidado para el dashboard';
    operation.description = 'Devuelve en una sola respuesta el resumen de ventas, gastos, ingresos netos, el top de productos más vendidos y las alertas de stock bajo, para un periodo (semana/mes) o rango de fechas. Solo disponible para admin.';
    operation.parameters = [
      { name: 'periodo', in: 'query', required: false, description: 'Periodo relativo a filtrar. Se ignora si se envían desde/hasta.', schema: { type: 'string', enum: ['semana', 'mes'], default: 'mes' } },
      { name: 'fecha', in: 'query', required: false, description: 'Fecha de referencia (YYYY-MM-DD) dentro de la semana/mes a consultar. Por defecto, hoy.', schema: { type: 'string', example: '2026-07-10' } },
      { name: 'desde', in: 'query', required: false, description: 'Fecha inicial (YYYY-MM-DD) para un rango personalizado. Requiere enviar también hasta.', schema: { type: 'string', example: '2026-07-01' } },
      { name: 'hasta', in: 'query', required: false, description: 'Fecha final (YYYY-MM-DD) para un rango personalizado. Requiere enviar también desde.', schema: { type: 'string', example: '2026-07-10' } },
      { name: 'limite', in: 'query', required: false, description: 'Cantidad de productos a incluir en el top (top N). Por defecto 5.', schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 } }
    ];
    operation.responses = {
      200: {
        description: 'Resumen consolidado del negocio',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                periodo: { type: 'string', example: 'mes' },
                desde: { type: 'string', example: '2026-07-01 00:00:00' },
                hasta: { type: 'string', example: '2026-07-31 23:59:59' },
                ventas: {
                  type: 'object',
                  properties: {
                    cantidad: { type: 'number', example: 120 },
                    total: { type: 'number', example: 3500000 },
                    total_efectivo: { type: 'number', example: 2000000 },
                    total_transferencia: { type: 'number', example: 1500000 }
                  }
                },
                gastos: {
                  type: 'object',
                  properties: {
                    cantidad: { type: 'number', example: 8 },
                    total: { type: 'number', example: 450000 }
                  }
                },
                ingresos_netos: { type: 'number', example: 3050000 },
                top_productos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      producto_id: { type: 'string' },
                      producto: { type: 'string', example: 'Café' },
                      cantidad_vendida: { type: 'number', example: 42 },
                      total_vendido: { type: 'number', example: 176400 }
                    }
                  }
                },
                stock_bajo: {
                  type: 'object',
                  properties: {
                    cantidad: { type: 'number', example: 2 },
                    insumos: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          nombre: { type: 'string', example: 'Leche' },
                          cantidad_actual: { type: 'number', example: 300 },
                          stock_minimo: { type: 'number', example: 1000 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      400: { description: 'Filtros inválidos (periodo, fecha, rango o límite)' },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
      500: { description: 'Error interno' }
    };
  }

  if (tag === 'Reportes' && method === 'get' && openApiPath.endsWith('/dashboard/excel')) {
    operation.summary = 'Descargar el reporte del dashboard en Excel';
    operation.description = 'Genera y descarga un archivo .xlsx con el mismo contenido que /reportes/dashboard: resumen de ventas y gastos, ventas por categoría y por ubicación (ej. Salón Principal, Terraza), top de productos e insumos con stock bajo, para un periodo (semana/mes) o rango de fechas. Solo disponible para admin.';
    operation.parameters = [
      { name: 'periodo', in: 'query', required: false, description: 'Periodo relativo a filtrar. Se ignora si se envían desde/hasta.', schema: { type: 'string', enum: ['semana', 'mes'], default: 'mes' } },
      { name: 'fecha', in: 'query', required: false, description: 'Fecha de referencia (YYYY-MM-DD) dentro de la semana/mes a consultar. Por defecto, hoy.', schema: { type: 'string', example: '2026-07-10' } },
      { name: 'desde', in: 'query', required: false, description: 'Fecha inicial (YYYY-MM-DD) para un rango personalizado. Requiere enviar también hasta.', schema: { type: 'string', example: '2026-07-01' } },
      { name: 'hasta', in: 'query', required: false, description: 'Fecha final (YYYY-MM-DD) para un rango personalizado. Requiere enviar también desde.', schema: { type: 'string', example: '2026-07-10' } },
      { name: 'limite', in: 'query', required: false, description: 'Cantidad de productos a incluir en el top (top N). Por defecto 5.', schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 } }
    ];
    operation.responses = {
      200: {
        description: 'Archivo Excel (.xlsx) con el reporte consolidado',
        content: {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
            schema: { type: 'string', format: 'binary' }
          }
        }
      },
      400: { description: 'Filtros inválidos (periodo, fecha, rango o límite)' },
      401: { description: 'Autenticacion requerida' },
      403: { description: 'No autorizado' },
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
      description: 'Campos JSON que espera este endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            description: 'Completa los campos requeridos visibles en el esquema del endpoint.',
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
    { name: 'MediosPagoTransferencia' },
    { name: 'Sesiones' },
    { name: 'Pedidos' },
    { name: 'ItemsPedido' },
    { name: 'Ventas' },
    { name: 'GastosCaja' },
    { name: 'Reportes' }
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
