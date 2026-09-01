jest.mock('../config/database', () => ({ query: jest.fn() }));

const db = require('../config/database');
const repository = require('../repositories/bitacorasRepository');

beforeEach(() => jest.clearAllMocks());

describe('bitacorasRepository', () => {
  test('historial asignado usa EXISTS, filtros, orden estable y paginación', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 12 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }, { id: 1 }] });

    const result = await repository.findHistory({
      filters: {
        ubicacionId: 4,
        fechaDesde: '2026-08-01',
        fechaHasta: '2026-08-20',
        estado: 'REGISTRADA',
        autor: 'ana',
      },
      hasGlobalScope: false,
      userId: 7,
      pagination: { pageSize: 10, offset: 10 },
    });

    const [countSql, countParams] = db.query.mock.calls[0];
    const [dataSql, dataParams] = db.query.mock.calls[1];
    expect(countSql).toContain('FROM usuario_ubicaciones uu');
    expect(countSql).toContain('uu.usuario_id = $1');
    expect(dataSql).toContain('FROM usuario_ubicaciones uu');
    expect(dataSql).toContain('uu.usuario_id = $1');
    expect(dataSql).toContain('uu.ubicacion_id = br.ubicacion_id');
    expect(countSql).toContain('br.ubicacion_id = $2');
    expect(countSql).toContain(String.raw`br.ocurrido_at < ($4::date + INTERVAL '1 day')`);
    expect(countSql).toContain('br.estado = $5');
    expect(countSql).toContain('autor_c.nombres_completos ILIKE $6');
    expect(countSql).toContain('autor_u.usuario ILIKE $6');
    expect(dataSql).toContain('autor_c.nombres_completos ILIKE $6');
    expect(dataSql).toContain('autor_u.usuario ILIKE $6');
    expect(countParams).toEqual([7, 4, '2026-08-01', '2026-08-20', 'REGISTRADA', '%ana%']);
    expect(dataSql).toContain('ORDER BY br.ocurrido_at DESC, br.id DESC');
    expect(dataSql).toContain('LEFT JOIN manzanas m ON m.id = br.manzana_id');
    expect(dataSql).toContain('LEFT JOIN villas v ON v.id = br.villa_id');
    expect(countSql).not.toContain('JOIN manzanas');
    expect(dataSql).toContain('LIMIT $7 OFFSET $8');
    expect(dataParams).toEqual([7, 4, '2026-08-01', '2026-08-20', 'REGISTRADA', '%ana%', 10, 10]);
    expect(result).toEqual({ items: [{ id: 2 }, { id: 1 }], total: 12 });
  });

  test.each([
    ['Manzana', 'findLockedBlock', 'FROM manzanas', 8],
    ['Villa', 'findLockedVilla', 'FROM villas', 9],
    ['Residente principal', 'findActivePrincipalResidentForVilla', 'FROM residentes', 9],
  ])('bloquea %s activa durante validación transaccional', async (_label, method, table, id) => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id }] }) };
    await repository[method]({
      client,
      [method === 'findLockedBlock' ? 'blockId' : 'villaId']: id,
    });
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain(table);
    expect(sql).toContain('FOR SHARE');
    expect(params).toEqual([id]);
  });

  test('opciones urbanas filtran solo activos y conservan relación', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await repository.findActiveBlocksForLocation({ locationId: 3 });
    await repository.findActiveVillasForBlock({ blockId: 8 });
    expect(db.query.mock.calls[0][0]).toContain(
      String.raw`ubicacion_id = $1 AND estado = 'activo'`
    );
    expect(db.query.mock.calls[1][0]).toContain(
      String.raw`v.manzana_id = $1 AND v.estado = 'activo'`
    );
    expect(db.query.mock.calls[1][0]).toContain('INNER JOIN residentes r');
    expect(db.query.mock.calls[1][0]).toContain('r.es_principal = TRUE');
    expect(db.query.mock.calls[1][0]).toContain('r.activo = TRUE');
  });

  test.each([
    ['Manzana', 'findVisibleBlock', { blockId: 8 }, 'm.ubicacion_id'],
    ['Ubicación', 'findVisibleLocation', { locationId: 3 }, 'u.id'],
  ])(
    'resuelve %s dentro del scope sin revelar existencia global',
    async (_label, method, ids, parent) => {
      db.query.mockResolvedValue({ rows: [] });
      await repository[method]({ ...ids, hasGlobalScope: false, userId: 7 });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('FROM usuario_ubicaciones uu');
      expect(sql).toContain(`uu.ubicacion_id = ${parent}`);
      expect(params).toEqual([Object.values(ids)[0], 7]);
    }
  );

  test('bloquea la asignación concreta con el helper productivo', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ usuario_id: 7, ubicacion_id: 4 }],
      }),
    };

    const result = await repository.findLockedUserLocationAssignment({
      client,
      userId: 7,
      locationId: 4,
    });

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('WHERE usuario_id = $1 AND ubicacion_id = $2');
    expect(sql).toContain('FOR KEY SHARE');
    expect(params).toEqual([7, 4]);
    expect(result).toEqual({ usuario_id: 7, ubicacion_id: 4 });
  });

  test('historial global no consulta asignaciones', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await repository.findHistory({
      filters: {},
      hasGlobalScope: true,
      userId: 7,
      pagination: { pageSize: 25, offset: 0 },
    });
    expect(db.query.mock.calls[0][0]).not.toContain('usuario_ubicaciones');
    expect(db.query.mock.calls[1][0]).toContain('LIMIT $1 OFFSET $2');
  });

  test('ubicaciones visibles limitadas usa la asignación y devuelve campos mínimos', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1, nombre: 'Punto' }] });
    await repository.findVisibleLocations({ hasGlobalScope: false, userId: 7 });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('uu.ubicacion_id = u.id');
    expect(sql).toContain('u.cliente_id');
    expect(sql).toContain('u.tipo_punto');
    expect(params).toEqual([7]);
  });

  test('consulta formulario activo con campos, tipos versionados ordenados', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 5, ubicacion_id: 3, version: 2, estado: 'ACTIVE' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 8, field_key: 'motivo', label: 'Motivo', sort_order: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 40, form_version_id: 5, nombre: 'Peatón', sort_order: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ form_field_id: 8, tipo_id: 40 }],
      });

    const result = await repository.findActiveVisitFormForLocation({ locationId: 3 });

    expect(db.query.mock.calls[0][0]).toContain(String.raw`estado = 'ACTIVE'`);
    expect(db.query.mock.calls[0][0]).toContain('published_at IS NOT NULL');
    expect(db.query.mock.calls[0][0]).toContain('ORDER BY version DESC');
    expect(db.query.mock.calls[1][0]).toContain('FROM bitacora_visit_form_fields');
    expect(db.query.mock.calls[1][0]).toContain('ORDER BY sort_order ASC, id ASC');
    expect(db.query.mock.calls[2][0]).toContain('FROM bitacora_visit_form_tipos');
    expect(db.query.mock.calls[3][0]).toContain('FROM bitacora_visit_form_field_tipos');
    expect(result).toEqual({
      id: 5,
      ubicacion_id: 3,
      version: 2,
      estado: 'ACTIVE',
      tipos: [{ id: 40, form_version_id: 5, nombre: 'Peatón', sort_order: 1 }],
      fields: [{ id: 8, field_key: 'motivo', label: 'Motivo', sort_order: 1, tipos: [40] }],
    });
  });

  test('lista versiones de formularios con Urbanización, creador y scope', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5, version: 2, estado: 'ACTIVE' }] });

    const result = await repository.findVisitForms({
      hasGlobalScope: false,
      userId: 7,
      filters: {
        nombre: 'Ingreso',
        locationId: 3,
        creator: 'monitor',
        estado: 'ACTIVE',
      },
      pagination: { pageSize: 20, offset: 0 },
    });

    const [sql, params] = db.query.mock.calls[1];
    expect(sql).toContain('FROM bitacora_visit_form_versions bfv');
    expect(sql).toContain('u.nombre AS ubicacion_nombre');
    expect(sql).toContain('creator.usuario AS creador');
    expect(sql).toContain('uu.ubicacion_id = bfv.ubicacion_id');
    expect(sql).toContain('bfv.titulo ILIKE');
    expect(sql).toContain('bfv.ubicacion_id =');
    expect(sql).toContain('creator.usuario ILIKE');
    expect(sql).toContain('bfv.estado =');
    expect(sql).toContain('ORDER BY bfv.published_at DESC');
    expect(params).toEqual([7, '%Ingreso%', 3, '%monitor%', 'ACTIVE', 20, 0]);
    expect(result).toEqual({
      items: [{ id: 5, version: 2, estado: 'ACTIVE' }],
      total: 1,
    });
  });

  test('lista únicamente creadores de formularios visibles por scope', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 12, usuario: 'monitor_norte' }] });

    const result = await repository.findVisitFormCreators({
      hasGlobalScope: false,
      userId: 7,
    });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('SELECT DISTINCT creator.id, creator.usuario');
    expect(sql).toContain('uu.ubicacion_id = bfv.ubicacion_id');
    expect(sql).toContain('creator.id = bfv.created_by');
    expect(params).toEqual([7]);
    expect(result).toEqual([{ id: 12, usuario: 'monitor_norte' }]);
  });

  test('publicar formulario archiva activo anterior e inserta nueva versión, tipos y campos', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // advisory lock
        .mockResolvedValueOnce({ rows: [] }) // FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ next_version: 3 }] }) // MAX(version)
        .mockResolvedValueOnce({ rows: [] }) // archive previous ACTIVE
        .mockResolvedValueOnce({
          rows: [{ id: 9, ubicacion_id: 3, version: 3, estado: 'ACTIVE' }],
        }) // INSERT version
        .mockResolvedValueOnce({ rows: [{ id: 40 }] }) // INSERT tipo 'Peatón'
        .mockResolvedValueOnce({ rows: [{ id: 20 }] }) // INSERT field 'motivo'
        .mockResolvedValueOnce({ rows: [] }) // SET published_at
        .mockResolvedValueOnce({
          rows: [{ id: 9, ubicacion_id: 3, version: 3, estado: 'ACTIVE' }],
        }) // findActiveVisitFormForLocation: version
        .mockResolvedValueOnce({ rows: [{ id: 20, field_key: 'motivo' }] }) // ...: fields
        .mockResolvedValueOnce({ rows: [{ id: 40, form_version_id: 9, nombre: 'Peatón' }] }) // ...: tipos
        .mockResolvedValueOnce({ rows: [] }), // ...: field_tipos junction (none, aplica_a TODOS)
    };

    await repository.publishVisitFormForLocation({
      client,
      locationId: 3,
      title: 'Formulario',
      showDateTime: false,
      userId: 7,
      tiposVisita: ['Peatón'],
      fields: [
        {
          field_key: 'motivo',
          label: 'Motivo',
          type: 'text',
          required: true,
          aplica_a: 'TODOS',
        },
      ],
    });

    expect(client.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(client.query.mock.calls[0][1]).toEqual([29004, 3]);
    expect(client.query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[2][0]).toContain('MAX(version)');
    expect(client.query.mock.calls[3][0]).toContain(String.raw`SET estado = 'ARCHIVED'`);
    expect(client.query.mock.calls[4][0]).toContain('INSERT INTO bitacora_visit_form_versions');
    expect(client.query.mock.calls[5][0]).toContain('INSERT INTO bitacora_visit_form_tipos');
    expect(client.query.mock.calls[5][1]).toEqual([9, 'Peatón', 1]);
    expect(client.query.mock.calls[6][0]).toContain('INSERT INTO bitacora_visit_form_fields');
    expect(client.query.mock.calls[6][1]).toEqual([
      9,
      'motivo',
      'Motivo',
      'text',
      true,
      'TODOS',
      '[]',
      1,
    ]);
    expect(client.query.mock.calls[7][0]).toContain('SET published_at = CURRENT_TIMESTAMP');
  });

  test('publicar formulario con aplica_a específico inserta la asignación en la tabla puente', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ next_version: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 9, ubicacion_id: 3, version: 1, estado: 'ACTIVE' }],
        }) // INSERT version
        .mockResolvedValueOnce({ rows: [{ id: 40 }] }) // INSERT tipo 'Peatón'
        .mockResolvedValueOnce({ rows: [{ id: 41 }] }) // INSERT tipo 'Vehículo'
        .mockResolvedValueOnce({ rows: [{ id: 21 }] }) // INSERT field 'placa'
        .mockResolvedValueOnce({ rows: [] }) // INSERT field_tipos (placa -> Vehículo)
        .mockResolvedValueOnce({ rows: [] }) // SET published_at
        .mockResolvedValueOnce({
          rows: [{ id: 9, ubicacion_id: 3, version: 1, estado: 'ACTIVE' }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 21, field_key: 'placa' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 40, form_version_id: 9, nombre: 'Peatón' },
            { id: 41, form_version_id: 9, nombre: 'Vehículo' },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ form_field_id: 21, tipo_id: 41 }] }),
    };

    await repository.publishVisitFormForLocation({
      client,
      locationId: 3,
      title: 'Formulario',
      showDateTime: false,
      userId: 7,
      tiposVisita: ['Peatón', 'Vehículo'],
      fields: [
        {
          field_key: 'placa',
          label: 'Placa',
          type: 'placa',
          required: true,
          aplica_a: ['Vehículo'],
        },
      ],
    });

    expect(client.query.mock.calls[5][1]).toEqual([9, 'Peatón', 1]);
    expect(client.query.mock.calls[6][1]).toEqual([9, 'Vehículo', 2]);
    expect(client.query.mock.calls[7][0]).toContain('INSERT INTO bitacora_visit_form_fields');
    expect(client.query.mock.calls[7][1]).toEqual([
      9,
      'placa',
      'Placa',
      'placa',
      true,
      'SELECCIONADOS',
      '[]',
      1,
    ]);
    expect(client.query.mock.calls[8][0]).toContain('INSERT INTO bitacora_visit_form_field_tipos');
    expect(client.query.mock.calls[8][1]).toEqual([21, 9, 41]);
  });

  test('acquireVisitFormPublishLock toma el advisory lock por Ubicación', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await repository.acquireVisitFormPublishLock({ client, locationId: 3 });

    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, $2)', [29004, 3]);
  });

  test('findLockedVisitFormVersion bloquea la versión para actualizarla de forma segura', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 9, ubicacion_id: 3, estado: 'ACTIVE' }],
      }),
    };

    const form = await repository.findLockedVisitFormVersion({ client, formId: 9 });

    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[0][1]).toEqual([9]);
    expect(form).toEqual({ id: 9, ubicacion_id: 3, estado: 'ACTIVE' });
  });

  test('archiveVisitFormVersion solo transiciona ACTIVE -> ARCHIVED sin tocar otros campos', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 9, ubicacion_id: 3, estado: 'ARCHIVED' }],
      }),
    };

    const updated = await repository.archiveVisitFormVersion({ client, formId: 9 });

    expect(client.query.mock.calls[0][0]).toContain(String.raw`SET estado = 'ARCHIVED'`);
    expect(client.query.mock.calls[0][0]).toContain(
      String.raw`WHERE id = $1 AND estado = 'ACTIVE'`
    );
    expect(client.query.mock.calls[0][1]).toEqual([9]);
    expect(updated).toEqual({ id: 9, ubicacion_id: 3, estado: 'ARCHIVED' });
  });

  test('visitas usa scope, filtros y conserva respuestas snapshot', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, respuestas: [] }] });

    await repository.findVisits({
      filters: {
        estado: 'ABIERTA',
        creator: 'ana',
        fechaDesde: '2026-08-01',
        fechaHasta: '2026-08-31',
        search: 'carlos',
      },
      hasGlobalScope: false,
      userId: 7,
      pagination: { pageSize: 25, offset: 0 },
    });

    const [countSql, countParams] = db.query.mock.calls[0];
    const [dataSql, dataParams] = db.query.mock.calls[1];
    expect(countSql).toContain('uu.ubicacion_id = bv.ubicacion_id');
    expect(countSql).toContain('bv.estado = $2');
    expect(countSql).toContain('bv.visitante_nombre ILIKE $6');
    expect(countSql).toContain('bv.placa ILIKE $6');
    expect(dataSql).toContain('jsonb_agg');
    expect(dataSql).toContain('bvr.label_snapshot');
    expect(dataSql).toContain('LIMIT $7 OFFSET $8');
    expect(countParams).toEqual([7, 'ABIERTA', '%ana%', '2026-08-01', '2026-08-31', '%carlos%']);
    expect(dataParams).toEqual([...countParams, 25, 0]);
  });

  test('findVisitCreators lista solo creadores reales de visitas visibles por scope', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 4, nombre: 'Guardia Uno' }],
    });

    const rows = await repository.findVisitCreators({ hasGlobalScope: false, userId: 7 });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('DISTINCT c.id, c.nombres_completos AS nombre');
    expect(sql).toContain('FROM bitacora_visitas bv');
    expect(sql).toContain('uu.ubicacion_id = bv.ubicacion_id');
    expect(params).toEqual([7]);
    expect(rows).toEqual([{ id: 4, nombre: 'Guardia Uno' }]);
  });

  test('checkout bloquea visita y actualiza salida sin borrar', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 8 }] }) };

    await repository.findLockedVisit({ client, visitId: 8 });
    await repository.closeVisit({
      client,
      visitId: 8,
      actorUserId: 7,
      actorCollaboratorId: 4,
      exitLogId: 99,
    });

    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE OF bv');
    expect(client.query.mock.calls[1][0]).toContain(String.raw`SET estado = 'CERRADA'`);
    expect(client.query.mock.calls[1][0]).toContain('salida_bitacora_registro_id = $4');
    expect(client.query.mock.calls[1][1]).toEqual([8, 7, 4, 99]);
  });

  test('anulación bloquea visita, persiste motivo y no borra', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 8 }] }) };

    await repository.findLockedVisit({ client, visitId: 8 });
    await repository.cancelVisit({
      client,
      visitId: 8,
      actorUserId: 7,
      actorCollaboratorId: 4,
      exitLogId: 99,
      motivo: 'Visitante no llegó',
    });

    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE OF bv');
    expect(client.query.mock.calls[1][0]).toContain(String.raw`SET estado = 'ANULADA'`);
    expect(client.query.mock.calls[1][0]).toContain('salida_bitacora_registro_id = $4');
    expect(client.query.mock.calls[1][0]).toContain('motivo_anulacion = $5');
    expect(client.query.mock.calls[1][1]).toEqual([8, 7, 4, 99, 'Visitante no llegó']);
  });
});
