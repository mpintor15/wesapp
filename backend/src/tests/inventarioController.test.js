const fs = require('fs');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../config/logger', () => ({
  error: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  logAuditStrict: jest.fn().mockResolvedValue(undefined),
  auditFromReq: jest.fn(() => ({ usuario_id: 1, ip: '127.0.0.1' })),
}));

const db = require('../config/database');
const { logAuditStrict } = require('../utils/audit');
const {
  getArticulos,
  getMovimientos,
  getBajasArticulos,
  createArticulo,
  updateArticulo,
  deleteArticulo,
  darBajaArticulo,
  exportArticulosExcel,
  exportMovimientosExcel,
  createMovimiento,
  anularMovimiento,
  anularBajaArticulo,
  deleteMovimientoAdministrativo,
  deleteBajaAdministrativa,
  downloadMovimientoPdf,
  regenerateMovimientoPdf,
} = require('../controllers/inventarioController');

describe('inventarioController.getBajasArticulos', () => {
  test('devuelve metadata estándar y pagina conservando filtros', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 9, nombre_articulo: 'Radio QA', total_count: 31 }],
    });
    const res = mockRes();

    await getBajasArticulos(
      mockReq({ query: { search: 'radio', page: '2', pageSize: '25' } }),
      res
    );

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2 OFFSET $3'), [
      '%radio%',
      25,
      25,
    ]);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 9, nombre_articulo: 'Radio QA' }],
      pagination: expect.objectContaining({
        page: 2,
        pageSize: 25,
        totalItems: 31,
        totalPages: 2,
      }),
    });
  });
});

const mockReq = ({ body = {}, params = {}, query = {}, user = { id: 1 } } = {}) => ({
  body,
  params,
  query,
  user,
  ip: '127.0.0.1',
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.sendFile = jest.fn().mockReturnValue(res);
  return res;
};

const makeClient = () => ({
  query: jest.fn(),
  release: jest.fn(),
});

const expectStatus = (res, status) => {
  expect(res.status).toHaveBeenCalledWith(status);
  return res.json.mock.calls[0][0];
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('inventarioController.createArticulo', () => {
  test('crea artículo de stock válido', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    const articulo = {
      id: 10,
      tipo_articulo: 'equipo',
      nombre_articulo: 'Chaleco',
      cantidad: 3,
      ubicacion_id: 2,
    };
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [articulo], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Chaleco',
          cantidad: 3,
          ubicacion_id: 2,
        },
      }),
      res
    );

    expectStatus(res, 201);
    expect(res.json.mock.calls[0][0].data).toMatchObject(articulo);
    expect(logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ tabla: 'articulos' })
    );
  });

  test('rechaza cantidad inválida en artículos de stock', async () => {
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Chaleco',
          cantidad: 0,
          ubicacion_id: 2,
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/cantidad/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('rechaza artículo sin ubicación', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Chaleco',
          cantidad: 1,
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/ubicación/i);
  });

  test('crea ubicación de artículo solo con cliente activo', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    const articulo = {
      id: 12,
      tipo_articulo: 'equipo',
      nombre_articulo: 'Casco',
      cantidad: 1,
      ubicacion_id: 9,
    };
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 4, nombre: 'Cliente Activo', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 9 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [articulo], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Casco',
          cantidad: 1,
          cliente_id: 4,
          ubicacion_nombre: '  Bodega   Cliente  ',
        },
        user: { id: 1, activo: true, tipo_usuario: 'supervisor' },
      }),
      res
    );

    expectStatus(res, 201);
    expect(client.query).toHaveBeenCalledWith(
      'INSERT INTO ubicaciones (nombre, cliente_id) VALUES ($1, $2) RETURNING id',
      ['Bodega Cliente', 4]
    );
    expect(res.json.mock.calls[0][0].data).toMatchObject(articulo);
  });

  test('usa ubicación existente por nombre sin exigir permiso adicional de ubicaciones', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    const articulo = {
      id: 13,
      tipo_articulo: 'equipo',
      nombre_articulo: 'Casco',
      cantidad: 1,
      ubicacion_id: 9,
    };
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 9 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 4, nombre: 'Cliente Activo', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [articulo], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Casco',
          cantidad: 1,
          cliente_id: 4,
          ubicacion_nombre: 'Bodega Cliente',
        },
        user: { id: 1, activo: true, tipo_usuario: 'supervisor' },
      }),
      res
    );

    expectStatus(res, 201);
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'INSERT INTO ubicaciones'
    );
  });

  test('rechaza crear ubicación implícita de artículo sin permiso y hace rollback', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Casco',
          cantidad: 1,
          cliente_id: 4,
          ubicacion_nombre: 'Bodega no autorizada',
        },
        user: { id: 2, activo: true, tipo_usuario: 'contador' },
      }),
      res
    );

    const body = expectStatus(res, 403);
    expect(body.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'INSERT INTO ubicaciones'
    );
  });

  test('rechaza crear ubicación de artículo sin cliente', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Casco',
          cantidad: 1,
          ubicacion_nombre: 'Bodega sin cliente',
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toBe('El cliente es obligatorio para crear una ubicación nueva');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'INSERT INTO ubicaciones'
    );
  });

  test('rechaza crear ubicación de artículo con cliente inactivo', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 4, nombre: 'Cliente Inactivo', estado: 'inactivo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'equipo',
          nombre_articulo: 'Casco',
          cantidad: 1,
          cliente_id: 4,
          ubicacion_nombre: 'Bodega bloqueada',
        },
        user: { id: 1, activo: true, tipo_usuario: 'supervisor' },
      }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('CLIENT_INACTIVE');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('reporta duplicados de número de serie como error de validación', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: '23505', constraint: 'articulos_numero_serie_key' })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createArticulo(
      mockReq({
        body: {
          tipo_articulo: 'arma',
          nombre_articulo: 'Pistola',
          numero_serie: 'ABC-1',
          ubicacion_id: 2,
        },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/Ya existe/);
  });
});

describe('inventarioController numeric IDs', () => {
  const invalidValues = ['abc', '12abc', '1e2', '1.5', '-1', '0', '', '   '];

  test.each(invalidValues)('rechaza id inválido al actualizar artículo: %p', async (id) => {
    const res = mockRes();

    await updateArticulo(mockReq({ params: { id }, body: { nombre_articulo: 'Radio' } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/id del artículo/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test.each(invalidValues)('rechaza id inválido al eliminar artículo: %p', async (id) => {
    const res = mockRes();

    await deleteArticulo(mockReq({ params: { id } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/id del artículo/i);
    expect(db.getClient).not.toHaveBeenCalled();
  });

  test('rechaza eliminación parcial obsoleta sin abrir transacción', async () => {
    const res = mockRes();

    await deleteArticulo(
      mockReq({
        params: { id: '10' },
        query: { cantidad: '1' },
        body: { motivo: 'Eliminación administrativa completa' },
      }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('PARTIAL_ARTICLE_DELETE_DEPRECATED');
    expect(db.getClient).not.toHaveBeenCalled();
  });

  test.each(invalidValues)('rechaza id inválido al dar de baja artículo: %p', async (id) => {
    const res = mockRes();

    await darBajaArticulo(
      mockReq({ params: { id }, body: { motivo: 'Dañado', cantidad: 1 } }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/id del artículo/i);
    expect(db.getClient).not.toHaveBeenCalled();
  });

  test.each(invalidValues)('rechaza id inválido al descargar PDF de movimiento: %p', async (id) => {
    const res = mockRes();

    await downloadMovimientoPdf(mockReq({ params: { id } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/id del movimiento/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test.each(invalidValues)('rechaza id inválido al regenerar PDF de movimiento: %p', async (id) => {
    const res = mockRes();

    await regenerateMovimientoPdf(mockReq({ params: { id } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/id del movimiento/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test.each(invalidValues)('rechaza ubicacion_id inválido en listado: %p', async (ubicacion_id) => {
    const res = mockRes();

    await getArticulos(mockReq({ query: { ubicacion_id } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/ubicación/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test.each(invalidValues)(
    'rechaza ubicacion_id inválido en exportación: %p',
    async (ubicacion_id) => {
      const res = mockRes();

      await exportArticulosExcel(mockReq({ query: { ubicacion_id } }), res);

      const body = expectStatus(res, 400);
      expect(body.message).toMatch(/ubicación/i);
      expect(db.query).not.toHaveBeenCalled();
    }
  );

  test.each(invalidValues)('rechaza destino_id inválido en exportación: %p', async (destino_id) => {
    const res = mockRes();

    await exportMovimientosExcel(mockReq({ query: { destino_id } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/destino/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('rechaza fecha imposible en exportación de movimientos sin consultar DB', async () => {
    const res = mockRes();

    await exportMovimientosExcel(mockReq({ query: { from: '2026-02-30' } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/fechas/i);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('rechaza rango invertido en exportación de movimientos sin consultar DB', async () => {
    const res = mockRes();

    await exportMovimientosExcel(mockReq({ query: { from: '2026-03-01', to: '2026-02-01' } }), res);

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/rango/i);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('inventarioController PDF de movimientos', () => {
  test('descarga un PDF existente sin regenerar ni escribir en base de datos', async () => {
    db.query.mockResolvedValue({
      rows: [{ pdf_path: 'storage/movimientos/movimiento-10.pdf' }],
      rowCount: 1,
    });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const createWriteStreamSpy = jest.spyOn(fs, 'createWriteStream');
    const res = mockRes();

    await downloadMovimientoPdf(mockReq({ params: { id: '10' } }), res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename=movimiento-10.pdf'
    );
    expect(res.sendFile).toHaveBeenCalledWith(expect.stringContaining('movimiento-10.pdf'));
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE movimientos SET pdf_path'),
      expect.any(Array)
    );
    expect(createWriteStreamSpy).not.toHaveBeenCalled();
  });

  test('descargar un PDF inexistente devuelve código controlado y no genera archivo', async () => {
    db.query.mockResolvedValue({
      rows: [{ pdf_path: 'storage/movimientos/movimiento-10.pdf' }],
      rowCount: 1,
    });
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const createWriteStreamSpy = jest.spyOn(fs, 'createWriteStream');
    const res = mockRes();

    await downloadMovimientoPdf(mockReq({ params: { id: '10' } }), res);

    const body = expectStatus(res, 409);
    expect(body.code).toBe('MOVEMENT_PDF_NOT_AVAILABLE');
    expect(res.sendFile).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(createWriteStreamSpy).not.toHaveBeenCalled();
  });

  test('descargar sin pdf_path devuelve código controlado y no genera archivo', async () => {
    db.query.mockResolvedValue({
      rows: [{ pdf_path: null }],
      rowCount: 1,
    });
    const createWriteStreamSpy = jest.spyOn(fs, 'createWriteStream');
    const res = mockRes();

    await downloadMovimientoPdf(mockReq({ params: { id: '10' } }), res);

    const body = expectStatus(res, 409);
    expect(body.code).toBe('MOVEMENT_PDF_NOT_AVAILABLE');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(createWriteStreamSpy).not.toHaveBeenCalled();
  });
});

describe('inventarioController.getMovimientos', () => {
  test('incluye estado de reversibilidad calculado por backend', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 10,
          estado: 'ACTIVO',
          reversible: false,
          reversal_status: 'INCOMPLETE',
        },
      ],
      rowCount: 1,
    });
    const res = mockRes();

    await getMovimientos(mockReq(), res);

    expect(db.query.mock.calls[0][0]).toContain('AS reversible');
    expect(db.query.mock.calls[0][0]).toContain('AS reversal_status');
    expect(res.json.mock.calls[0][0].data[0]).toMatchObject({
      reversible: false,
      reversal_status: 'INCOMPLETE',
    });
  });
});

describe('inventarioController.darBajaArticulo', () => {
  test('hace rollback si la baja supera el stock disponible', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 2, nombre_articulo: 'Chaleco' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await darBajaArticulo(
      mockReq({ params: { id: '10' }, body: { motivo: 'Dañado', cantidad: 3 } }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('INSUFFICIENT_STOCK');
    expect(body.message).toMatch(/stock disponible/);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('registra baja parcial y confirma transacción', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Chaleco',
            cantidad: 5,
            ubicacion_id: 2,
            ubicacion_nombre: 'Bodega',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 77 }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const res = mockRes();

    await darBajaArticulo(
      mockReq({ params: { id: '10' }, body: { motivo: 'Dañado', cantidad: 2 } }),
      res
    );

    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE articulos SET cantidad = $1 WHERE id = $2',
      [3, 10]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO inventario_stock_efectos/),
      [null, 77, 10, -2, 5, 3, 2, 2]
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ tabla: 'articulos_bajas' })
    );
  });
});

describe('inventarioController.createMovimiento', () => {
  test('rechaza movimiento sin items antes de iniciar transacción', async () => {
    const res = mockRes();

    await createMovimiento(
      mockReq({ body: { ubicacion_destino_id: 2, items: [] }, user: { id: 1 } }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/artículo/i);
    expect(db.getClient).not.toHaveBeenCalled();
  });

  test('rechaza crear destino de movimiento sin cliente destino', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          ubicacion_destino_nombre: 'Bodega nueva',
          items: [{ articulo_id: 10, cantidad: 1 }],
        },
        user: { id: 1 },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toBe('El cliente destino es obligatorio para crear una ubicación nueva');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'INSERT INTO ubicaciones'
    );
  });

  test('crea destino de movimiento bajo cliente activo y no reutiliza homónimos globales', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 4, nombre: 'Cliente Activo', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 8 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'arma',
            nombre_articulo: 'Pistola',
            cantidad: 1,
            ubicacion_id: 2,
            activo: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          cliente_destino_id: 4,
          ubicacion_destino_nombre: 'Bodega compartida',
          items: [{ articulo_id: 10, cantidad: 1 }],
        },
        user: { id: 1, activo: true, tipo_usuario: 'supervisor' },
      }),
      res
    );

    expectStatus(res, 201);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE cliente_id = $1'), [
      4,
      'Bodega compartida',
    ]);
    expect(client.query).toHaveBeenCalledWith(
      'INSERT INTO ubicaciones (nombre, cliente_id) VALUES ($1, $2) RETURNING id',
      ['Bodega compartida', 4]
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('resuelve destino existente por nombre sin exigir permiso de crear ubicación', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 8 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 4, nombre: 'Cliente Activo', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'arma',
            nombre_articulo: 'Pistola',
            cantidad: 1,
            ubicacion_id: 2,
            activo: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          cliente_destino_id: 4,
          ubicacion_destino_nombre: 'Bodega existente',
          items: [{ articulo_id: 10, cantidad: 1 }],
        },
        user: { id: 1, activo: true, tipo_usuario: 'contador' },
      }),
      res
    );

    expectStatus(res, 201);
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'INSERT INTO ubicaciones'
    );
  });

  test('rechaza crear destino implícito de movimiento sin permiso y hace rollback', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          cliente_destino_id: 4,
          ubicacion_destino_nombre: 'Bodega no autorizada',
          items: [{ articulo_id: 10, cantidad: 1 }],
        },
        user: { id: 2, activo: true, tipo_usuario: 'contador' },
      }),
      res
    );

    const body = expectStatus(res, 403);
    expect(body.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'INSERT INTO ubicaciones'
    );
  });

  test('si otra transacción crea el destino por nombre, movimientos.crear puede reutilizarlo sin insertar', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 8 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 4, nombre: 'Cliente Activo', estado: 'activo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'arma',
            nombre_articulo: 'Pistola',
            cantidad: 1,
            ubicacion_id: 2,
            activo: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          cliente_destino_id: 4,
          ubicacion_destino_nombre: 'Bodega carrera',
          items: [{ articulo_id: 10, cantidad: 1 }],
        },
        user: { id: 2, activo: true, tipo_usuario: 'secretario' },
      }),
      res
    );

    expectStatus(res, 201);
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'INSERT INTO ubicaciones'
    );
  });

  test('rechaza crear destino de movimiento con cliente inactivo', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: 4, nombre: 'Cliente Inactivo', estado: 'inactivo' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          cliente_destino_id: 4,
          ubicacion_destino_nombre: 'Bodega bloqueada',
          items: [{ articulo_id: 10, cantidad: 1 }],
        },
        user: { id: 1, activo: true, tipo_usuario: 'supervisor' },
      }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('CLIENT_INACTIVE');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('ubicacion_id existente sin cliente_destino_id usa la ubicación persistida', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 8, nombre: 'Destino', cliente_id: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'arma',
            nombre_articulo: 'Pistola',
            cantidad: 1,
            ubicacion_id: 2,
            activo: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: { ubicacion_destino_id: 8, items: [{ articulo_id: 10, cantidad: 1 }] },
        user: { id: 1 },
      }),
      res
    );

    expectStatus(res, 201);
    expect(client.query.mock.calls[1][0]).toContain('FROM ubicaciones');
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('FROM clientes'), [
      expect.anything(),
    ]);
    expect(client.query).not.toHaveBeenCalledWith(
      'INSERT INTO ubicaciones (nombre, cliente_id) VALUES ($1, $2) RETURNING id',
      expect.any(Array)
    );
  });

  test('ubicacion_id existente con cliente_destino_id coincidente permite movimiento', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 8, nombre: 'Destino', cliente_id: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'arma',
            nombre_articulo: 'Pistola',
            cantidad: 1,
            ubicacion_id: 2,
            activo: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          ubicacion_destino_id: 8,
          cliente_destino_id: 4,
          items: [{ articulo_id: 10, cantidad: 1 }],
        },
        user: { id: 1 },
      }),
      res
    );

    expectStatus(res, 201);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('ubicacion_id existente con cliente_destino_id distinto rechaza payload', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 8, nombre: 'Destino', cliente_id: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          ubicacion_destino_id: 8,
          cliente_destino_id: 5,
          items: [{ articulo_id: 10, cantidad: 1 }],
        },
        user: { id: 1 },
      }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('LOCATION_CLIENT_MISMATCH');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.map((call) => call[0]).join('\n')).not.toContain(
      'FROM articulos'
    );
  });

  test('ubicacion_id existente con nombre contradictorio rechaza payload ambiguo', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 8, nombre: 'Destino', cliente_id: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          ubicacion_destino_id: 8,
          ubicacion_destino_nombre: 'Otro destino',
          items: [{ articulo_id: 10, cantidad: 1 }],
        },
        user: { id: 1 },
      }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('LOCATION_PAYLOAD_CONFLICT');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('ubicacion_id inexistente devuelve error estructurado', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: { ubicacion_destino_id: 999, items: [{ articulo_id: 10, cantidad: 1 }] },
        user: { id: 1 },
      }),
      res
    );

    const body = expectStatus(res, 404);
    expect(body.code).toBe('LOCATION_NOT_FOUND');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('hace rollback si destino coincide con origen', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 2, nombre: 'Bodega', cliente_id: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 5, ubicacion_id: 2 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: { ubicacion_destino_id: 2, items: [{ articulo_id: 10, cantidad: 1 }] },
        user: { id: 1 },
      }),
      res
    );

    const body = expectStatus(res, 400);
    expect(body.message).toMatch(/destino no puede ser igual/i);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('hace rollback si la cantidad supera el stock', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 2, nombre: 'Bodega', cliente_id: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 1, ubicacion_id: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: { ubicacion_destino_id: 2, items: [{ articulo_id: 10, cantidad: 2 }] },
        user: { id: 1 },
      }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('INSUFFICIENT_STOCK');
    expect(body.message).toMatch(/stock disponible/);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('confirma movimiento aunque falle el PDF después del commit', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 2, nombre: 'Bodega', cliente_id: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Chaleco',
            cantidad: 5,
            ubicacion_id: 1,
            activo: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 99 }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    db.query.mockRejectedValueOnce(new Error('PDF falló'));
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: { ubicacion_destino_id: 2, items: [{ articulo_id: 10, cantidad: 2 }] },
        user: { id: 1 },
      }),
      res
    );

    expectStatus(res, 201);
    expect(res.json.mock.calls[0][0].pdf).toEqual({
      available: false,
      code: 'PDF_GENERATION_FAILED',
    });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).not.toHaveBeenCalledWith('ROLLBACK');
  });

  test('bloquea artículos en orden determinista para evitar doble consumo concurrente', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 2, nombre: 'Bodega', cliente_id: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Botas',
            cantidad: 4,
            ubicacion_id: 1,
            activo: true,
          },
          {
            id: 8,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Chaleco',
            cantidad: 4,
            ubicacion_id: 1,
            activo: true,
          },
        ],
        rowCount: 2,
      })
      .mockResolvedValueOnce({ rows: [{ id: 90 }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 91 }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: {
          ubicacion_destino_id: 2,
          items: [
            { articulo_id: 8, cantidad: 1 },
            { articulo_id: 3, cantidad: 1 },
          ],
        },
        user: { id: 1 },
      }),
      res
    );

    expect(client.query.mock.calls[2][0]).toMatch(/FOR UPDATE/);
    expect(client.query.mock.calls[2][1]).toEqual([[3, 8]]);
    expectStatus(res, 201);
  });

  test('falla de auditoría hace rollback antes de confirmar movimiento', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    logAuditStrict.mockRejectedValueOnce(new Error('audit down'));
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 2, nombre: 'Bodega', cliente_id: 4 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Chaleco',
            cantidad: 5,
            ubicacion_id: 1,
            activo: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 99 }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, fecha_movimiento: '2026-01-01' }], rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const res = mockRes();

    await createMovimiento(
      mockReq({
        body: { ubicacion_destino_id: 2, items: [{ articulo_id: 10, cantidad: 2 }] },
        user: { id: 1 },
      }),
      res
    );

    expectStatus(res, 500);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });
});

describe('inventarioController anulaciones y eliminación administrativa', () => {
  test('anula transferencia parcial usando exactamente IDs de origen y destino', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 44, estado: 'ACTIVO', reversion_datos_completos: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            movimiento_id: 44,
            articulo_id: 10,
            delta: -2,
            stock_anterior: 5,
            stock_posterior: 3,
            ubicacion_anterior_id: 1,
            ubicacion_posterior_id: 1,
          },
          {
            id: 2,
            movimiento_id: 44,
            articulo_id: 20,
            delta: 2,
            stock_anterior: 0,
            stock_posterior: 2,
            ubicacion_anterior_id: null,
            ubicacion_posterior_id: 2,
          },
        ],
        rowCount: 2,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Chaleco',
            cantidad: 3,
            ubicacion_id: 1,
            activo: true,
          },
          {
            id: 20,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Chaleco',
            cantidad: 2,
            ubicacion_id: 2,
            activo: true,
          },
        ],
        rowCount: 2,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 44, estado: 'ANULADO', anulado_por: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await anularMovimiento(
      mockReq({ params: { id: '44' }, body: { motivo: 'Error operativo confirmado' } }),
      res
    );

    expect(res.json.mock.calls[0][0].success).toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE articulos[\s\S]*WHERE id = \$4/),
      [5, true, 1, 10]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE articulos[\s\S]*WHERE id = \$4/),
      [0, false, null, 20]
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(logAuditStrict).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ tabla: 'movimientos', operacion: 'UPDATE' })
    );
  });

  test('segunda anulación de movimiento devuelve 409', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, estado: 'ANULADO' }], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await anularMovimiento(
      mockReq({ params: { id: '44' }, body: { motivo: 'Segundo intento inválido' } }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('MOVEMENT_ALREADY_VOIDED');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('anula salida sobre el mismo articulo_id', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 45, estado: 'ACTIVO', reversion_datos_completos: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            movimiento_id: 45,
            articulo_id: 10,
            delta: -5,
            stock_anterior: 9,
            stock_posterior: 4,
            ubicacion_anterior_id: 1,
            ubicacion_posterior_id: 1,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 4, ubicacion_id: 1, activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 45, estado: 'ANULADO' }], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await anularMovimiento(
      mockReq({ params: { id: '45' }, body: { motivo: 'Reversión de salida errónea' } }),
      res
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE articulos[\s\S]*WHERE id = \$4/),
      [9, true, 1, 10]
    );
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });

  test('anula entrada sobre el mismo articulo_id sin crear artículos', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 46, estado: 'ACTIVO', reversion_datos_completos: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            movimiento_id: 46,
            articulo_id: 10,
            delta: 5,
            stock_anterior: 0,
            stock_posterior: 5,
            ubicacion_anterior_id: null,
            ubicacion_posterior_id: 1,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 5, ubicacion_id: 1, activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 46, estado: 'ANULADO' }], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await anularMovimiento(
      mockReq({ params: { id: '46' }, body: { motivo: 'Reversión de entrada errónea' } }),
      res
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE articulos[\s\S]*WHERE id = \$4/),
      [0, false, null, 10]
    );
    expect(client.query).not.toHaveBeenCalledWith(expect.stringMatching(/^INSERT INTO articulos/i));
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });

  test('no confunde dos artículos con atributos equivalentes al anular', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 47, estado: 'ACTIVO', reversion_datos_completos: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            movimiento_id: 47,
            articulo_id: 20,
            delta: 2,
            stock_anterior: 0,
            stock_posterior: 2,
            ubicacion_anterior_id: null,
            ubicacion_posterior_id: 2,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Chaleco',
            talla: 'M',
            cantidad: 99,
            ubicacion_id: 2,
            activo: true,
          },
          {
            id: 20,
            tipo_articulo: 'equipo',
            nombre_articulo: 'Chaleco',
            talla: 'M',
            cantidad: 2,
            ubicacion_id: 2,
            activo: true,
          },
        ],
        rowCount: 2,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 47, estado: 'ANULADO' }], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await anularMovimiento(
      mockReq({ params: { id: '47' }, body: { motivo: 'Reversión con artículos equivalentes' } }),
      res
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/SELECT \*[\s\S]*WHERE id = ANY\(\$1::int\[\]\)/),
      [[20]]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE articulos[\s\S]*WHERE id = \$4/),
      [0, false, null, 20]
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringMatching(/nombre_articulo|ubicacion_id = \$11|ORDER BY id ASC\s+LIMIT 1/)
    );
  });

  test('movimiento histórico ambiguo devuelve error controlado', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 48, estado: 'ACTIVO', reversion_datos_completos: false }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await anularMovimiento(
      mockReq({ params: { id: '48' }, body: { motivo: 'Histórico sin trazabilidad exacta' } }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('MOVEMENT_REVERSAL_DATA_INCOMPLETE');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('fallo intermedio durante anulación revierte todos los cambios', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 49, estado: 'ACTIVO', reversion_datos_completos: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            movimiento_id: 49,
            articulo_id: 10,
            delta: -2,
            ubicacion_anterior_id: 1,
            ubicacion_posterior_id: 1,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 1, ubicacion_id: 1, activo: true }],
        rowCount: 1,
      })
      .mockRejectedValueOnce(new Error('update failed'))
      .mockResolvedValueOnce({});
    const res = mockRes();

    await anularMovimiento(
      mockReq({ params: { id: '49' }, body: { motivo: 'Falla simulada durante reversión' } }),
      res
    );

    expectStatus(res, 500);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });

  test('anulación con motivo corto devuelve 400 antes de transacción', async () => {
    const res = mockRes();

    await anularMovimiento(mockReq({ params: { id: '44' }, body: { motivo: 'corto' } }), res);

    expectStatus(res, 400);
    expect(db.getClient).not.toHaveBeenCalled();
  });

  test('anula baja y restaura stock registrando req.user.id', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            articulo_id: 10,
            estado: 'ACTIVO',
            reversion_datos_completos: true,
            tipo_articulo: 'equipo',
            cantidad: 2,
            ubicacion_id: 1,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            baja_id: 7,
            articulo_id: 10,
            delta: -2,
            stock_anterior: 3,
            stock_posterior: 1,
            ubicacion_anterior_id: 1,
            ubicacion_posterior_id: 1,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10, tipo_articulo: 'equipo', cantidad: 1, activo: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: 7, estado: 'ANULADO', anulado_por: 99 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await anularBajaArticulo(
      mockReq({
        params: { id: '7' },
        body: { motivo: 'Baja registrada por error', anulado_por: 1234 },
        user: { id: 99, usuario: 'gerente' },
      }),
      res
    );

    expect(res.json.mock.calls[0][0].data.anulado_por).toBe(99);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE articulos[\s\S]*WHERE id = \$4/),
      [3, true, 1, 10]
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('eliminación administrativa de movimiento requiere anulación previa', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 44, estado: 'ACTIVO' }], rowCount: 1 })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await deleteMovimientoAdministrativo(
      mockReq({ params: { id: '44' }, body: { motivo: 'Depuración administrativa' } }),
      res
    );

    const body = expectStatus(res, 409);
    expect(body.code).toBe('MOVEMENT_MUST_BE_VOIDED_FIRST');
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringMatching(/^DELETE/i),
      expect.anything()
    );
  });

  test('eliminación administrativa de baja no ejecuta SQL DELETE', async () => {
    const client = makeClient();
    db.getClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 7, estado: 'ANULADO' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 7, estado: 'ELIMINADO', eliminado_por: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({});
    const res = mockRes();

    await deleteBajaAdministrativa(
      mockReq({ params: { id: '7' }, body: { motivo: 'Depuración administrativa' } }),
      res
    );

    expect(res.json.mock.calls[0][0].data.estado).toBe('ELIMINADO');
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringMatching(/^DELETE/i),
      expect.anything()
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });
});
