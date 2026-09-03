jest.mock('../config/database', () => ({ query: jest.fn() }));

const db = require('../config/database');
const repository = require('../repositories/bitacorasRepository');

beforeEach(() => jest.clearAllMocks());

describe('bitacorasRepository', () => {
  test('historial asignado usa EXISTS, filtros, orden estable y paginación', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 2, total_count: 12 },
        { id: 1, total_count: 12 },
      ],
    });

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

    expect(db.query).toHaveBeenCalledTimes(1);
    const [dataSql, dataParams] = db.query.mock.calls[0];
    expect(dataSql).toContain('COUNT(*) OVER()::int AS total_count');
    expect(dataSql).toContain('FROM usuario_ubicaciones uu');
    expect(dataSql).toContain('uu.usuario_id = $1');
    expect(dataSql).toContain('uu.ubicacion_id = br.ubicacion_id');
    expect(dataSql).toContain('br.ubicacion_id = $2');
    expect(dataSql).toContain(String.raw`br.ocurrido_at < ($4::date + INTERVAL '1 day')`);
    expect(dataSql).toContain('br.estado = $5');
    expect(dataSql).toContain('autor_c.nombres_completos ILIKE $6');
    expect(dataSql).toContain('autor_u.usuario ILIKE $6');
    expect(dataSql).toMatch(/ORDER BY br\.ocurrido_at DESC NULLS LAST,\s+br\.id DESC/);
    expect(dataSql).toContain('LEFT JOIN manzanas m ON m.id = br.manzana_id');
    expect(dataSql).toContain('LEFT JOIN villas v ON v.id = br.villa_id');
    expect(dataSql).toContain('LIMIT $7 OFFSET $8');
    expect(dataParams).toEqual([7, 4, '2026-08-01', '2026-08-20', 'REGISTRADA', '%ana%', 10, 10]);
    expect(result).toEqual({ items: [{ id: 2 }, { id: 1 }], total: 12 });
  });

  test('regresión: historial (Registro) excluye auditoría generada por Visitas (origen)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await repository.findHistory({
      filters: {},
      hasGlobalScope: true,
      userId: 7,
      pagination: { pageSize: 25, offset: 0 },
    });
    expect(db.query).toHaveBeenCalledTimes(1);
    const [dataSql] = db.query.mock.calls[0];
    // eslint-disable-next-line quotes -- prettier prefers double quotes here to avoid escaping
    expect(dataSql).toContain("br.origen = 'MANUAL'");
  });

  test('regresión: el contador de Registro en el resumen también excluye origen VISITA', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 3 }] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });
    await repository.getBitacorasResumen({
      hasGlobalScope: true,
      userId: 7,
      includeHistorial: true,
      includeFormularios: false,
    });
    const [registrosSql] = db.query.mock.calls[0];
    // eslint-disable-next-line quotes -- prettier prefers double quotes here to avoid escaping
    expect(registrosSql).toContain("br.origen = 'MANUAL'");
  });

  test('regresión: insertBitacoraRegistro (auditoría de Visitas) persiste origen VISITA', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1, origen: 'VISITA' }] }) };
    await repository.insertBitacoraRegistro({
      client,
      locationId: 3,
      blockId: 8,
      villaId: 9,
      actorUserId: 7,
      actorCollaboratorId: 4,
      occurredAt: new Date(),
      detail: 'Ingreso visita: Ana · Peatón · Casa A - 1',
    });
    // eslint-disable-next-line quotes -- prettier prefers double quotes here to avoid escaping
    expect(client.query.mock.calls[0][0]).toContain("'VISITA'");
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
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, total_count: 1 }] });
    await repository.findHistory({
      filters: {},
      hasGlobalScope: true,
      userId: 7,
      pagination: { pageSize: 25, offset: 0 },
    });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).not.toContain('usuario_ubicaciones');
    expect(db.query.mock.calls[0][0]).toContain('LIMIT $1 OFFSET $2');
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
      .mockResolvedValueOnce({ rows: [] }) // groups
      .mockResolvedValueOnce({ rows: [] }) // group_fields
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
    expect(db.query.mock.calls[2][0]).toContain('requiere_salida');
    expect(db.query.mock.calls[3][0]).toContain('FROM bitacora_visit_form_groups');
    expect(db.query.mock.calls[4][0]).toContain('FROM bitacora_visit_form_group_fields');
    expect(db.query.mock.calls[5][0]).toContain('FROM bitacora_visit_form_field_tipos');
    expect(result).toEqual({
      id: 5,
      ubicacion_id: 3,
      version: 2,
      estado: 'ACTIVE',
      tipos: [{ id: 40, form_version_id: 5, nombre: 'Peatón', sort_order: 1 }],
      fields: [{ id: 8, field_key: 'motivo', label: 'Motivo', sort_order: 1, tipos: [40] }],
      groups: [],
    });
  });

  test('lista versiones de formularios con Urbanización, creador y scope', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 5, version: 2, estado: 'ACTIVE', total_count: 1 }],
    });

    const result = await repository.findVisitForms({
      hasGlobalScope: false,
      userId: 7,
      filters: {
        nombre: 'Ingreso',
        locationId: 3,
        creator: 'monitor',
        estado: 'ACTIVE',
      },
      pagination: {
        pageSize: 20,
        offset: 0,
        sortExpression: 'bfv.titulo',
        sortOrder: 'asc',
      },
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('COUNT(*) OVER()::int AS total_count');
    expect(sql).toContain('FROM bitacora_visit_form_versions bfv');
    expect(sql).toContain('u.nombre AS ubicacion_nombre');
    expect(sql).toContain('creator.usuario AS creador');
    expect(sql).toContain('uu.ubicacion_id = bfv.ubicacion_id');
    expect(sql).toContain('bfv.titulo ILIKE');
    expect(sql).toContain('bfv.ubicacion_id =');
    expect(sql).toContain('creator.usuario ILIKE');
    expect(sql).toContain('bfv.estado =');
    expect(sql).toContain('bfv.deleted_at IS NULL');
    expect(sql).toContain('ORDER BY bfv.titulo ASC NULLS LAST,');
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

  test.each([
    ['sin historial', 0, false],
    ['con historial archivado', 1, true],
  ])(
    'hasVisitFormHistory detecta cualquier versión previa (%s)',
    async (_label, rowCount, expected) => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [], rowCount }) };
      const result = await repository.hasVisitFormHistory({ client, locationId: 8 });
      expect(client.query.mock.calls[0][0]).toContain('FROM bitacora_visit_form_versions');
      expect(client.query.mock.calls[0][1]).toEqual([8]);
      expect(result).toBe(expected);
    }
  );

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
        .mockResolvedValueOnce({ rows: [] }) // ...: groups
        .mockResolvedValueOnce({ rows: [] }) // ...: group_fields
        .mockResolvedValueOnce({ rows: [] }), // ...: field_tipos junction (none, aplica_a TODOS)
    };

    await repository.publishVisitFormForLocation({
      client,
      locationId: 3,
      title: 'Formulario',
      showDateTime: false,
      userId: 7,
      tiposVisita: [{ nombre: 'Peatón', requiere_salida: true }],
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
    expect(client.query.mock.calls[5][1]).toEqual([9, 'Peatón', true, 1]);
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
        .mockResolvedValueOnce({ rows: [] }) // ...: groups
        .mockResolvedValueOnce({ rows: [] }) // ...: group_fields
        .mockResolvedValueOnce({ rows: [{ form_field_id: 21, tipo_id: 41 }] }),
    };

    await repository.publishVisitFormForLocation({
      client,
      locationId: 3,
      title: 'Formulario',
      showDateTime: false,
      userId: 7,
      tiposVisita: [
        { nombre: 'Peatón', requiere_salida: true },
        { nombre: 'Vehículo', requiere_salida: true },
      ],
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

    expect(client.query.mock.calls[5][1]).toEqual([9, 'Peatón', true, 1]);
    expect(client.query.mock.calls[6][1]).toEqual([9, 'Vehículo', true, 2]);
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

  test('publicar formulario con grupo repetible inserta grupo, campos y tabla puente de tipos', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // advisory lock
        .mockResolvedValueOnce({ rows: [] }) // FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ next_version: 1 }] }) // MAX(version)
        .mockResolvedValueOnce({ rows: [] }) // archive previous ACTIVE
        .mockResolvedValueOnce({
          rows: [{ id: 9, ubicacion_id: 3, version: 1, estado: 'ACTIVE' }],
        }) // INSERT version
        .mockResolvedValueOnce({ rows: [{ id: 40 }] }) // INSERT tipo 'Peatón'
        .mockResolvedValueOnce({ rows: [{ id: 41 }] }) // INSERT tipo 'Vehículo'
        .mockResolvedValueOnce({ rows: [{ id: 60 }] }) // INSERT group 'visitantes'
        .mockResolvedValueOnce({ rows: [] }) // INSERT group_tipos (visitantes -> Peatón)
        .mockResolvedValueOnce({ rows: [] }) // INSERT group_field 'nombre'
        .mockResolvedValueOnce({ rows: [] }) // INSERT group_field 'cedula'
        .mockResolvedValueOnce({ rows: [] }) // SET published_at
        .mockResolvedValueOnce({
          rows: [{ id: 9, ubicacion_id: 3, version: 1, estado: 'ACTIVE' }],
        }) // findActiveVisitFormForLocation: version
        .mockResolvedValueOnce({ rows: [] }) // ...: fields
        .mockResolvedValueOnce({
          rows: [
            { id: 40, form_version_id: 9, nombre: 'Peatón' },
            { id: 41, form_version_id: 9, nombre: 'Vehículo' },
          ],
        }) // ...: tipos
        .mockResolvedValueOnce({ rows: [{ id: 60, form_version_id: 9, group_key: 'visitantes' }] }) // ...: groups
        .mockResolvedValueOnce({
          rows: [
            { id: 70, group_id: 60, field_key: 'nombre', type: 'text' },
            { id: 71, group_id: 60, field_key: 'cedula', type: 'cedula' },
          ],
        }) // ...: group_fields
        .mockResolvedValueOnce({ rows: [] }) // ...: field_tipos junction (no scalar fields)
        .mockResolvedValueOnce({ rows: [{ group_id: 60, tipo_id: 40 }] }), // ...: group_tipos junction
    };

    await repository.publishVisitFormForLocation({
      client,
      locationId: 3,
      title: 'Formulario',
      showDateTime: false,
      userId: 7,
      tiposVisita: [
        { nombre: 'Peatón', requiere_salida: true },
        { nombre: 'Vehículo', requiere_salida: true },
      ],
      fields: [],
      groups: [
        {
          group_key: 'visitantes',
          label: 'Visitantes',
          min_count: 1,
          aplica_a: ['Peatón'],
          fields: [
            { field_key: 'nombre', label: 'Nombre', type: 'text', required: true, options: [] },
            { field_key: 'cedula', label: 'Cédula', type: 'cedula', required: true, options: [] },
          ],
        },
      ],
    });

    expect(client.query.mock.calls[7][0]).toContain('INSERT INTO bitacora_visit_form_groups');
    expect(client.query.mock.calls[7][1]).toEqual([
      9,
      'visitantes',
      'Visitantes',
      1,
      'SELECCIONADOS',
      1,
    ]);
    expect(client.query.mock.calls[8][0]).toContain('INSERT INTO bitacora_visit_form_group_tipos');
    expect(client.query.mock.calls[8][1]).toEqual([60, 9, 40]);
    expect(client.query.mock.calls[9][0]).toContain('INSERT INTO bitacora_visit_form_group_fields');
    expect(client.query.mock.calls[9][1]).toEqual([
      60,
      9,
      'nombre',
      'Nombre',
      'text',
      true,
      '[]',
      1,
    ]);
    expect(client.query.mock.calls[10][1]).toEqual([
      60,
      9,
      'cedula',
      'Cédula',
      'cedula',
      true,
      '[]',
      2,
    ]);
  });

  test('resumen cuenta registros, visitas ABIERTA y formularios respetando el scope', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 12 }] })
      .mockResolvedValueOnce({ rows: [{ total: 3 }] })
      .mockResolvedValueOnce({ rows: [{ total: 4 }] });

    const result = await repository.getBitacorasResumen({
      hasGlobalScope: false,
      userId: 7,
      includeHistorial: true,
      includeFormularios: true,
    });

    expect(db.query.mock.calls[0][0]).toContain('FROM bitacora_registros br');
    expect(db.query.mock.calls[0][0]).toContain('uu.usuario_id = $1');
    expect(db.query.mock.calls[0][1]).toEqual([7]);
    expect(db.query.mock.calls[1][0]).toContain('FROM bitacora_visitas bv');
    expect(db.query.mock.calls[1][0]).toContain('bv.estado = $2');
    expect(db.query.mock.calls[1][1]).toEqual([7, 'ABIERTA']);
    expect(db.query.mock.calls[2][0]).toContain('FROM bitacora_visit_form_versions bfv');
    expect(db.query.mock.calls[2][0]).toContain('bfv.deleted_at IS NULL');
    expect(db.query.mock.calls[2][1]).toEqual([7]);
    expect(result).toEqual({ registros: 12, visitas: 3, formularios: 4 });
  });

  test('resumen omite formularios cuando includeFormularios es falso', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 5 }] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const result = await repository.getBitacorasResumen({
      hasGlobalScope: true,
      userId: 9,
      includeHistorial: true,
      includeFormularios: false,
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ registros: 5, visitas: 1, formularios: null });
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

  test('findVisitFormVersionDetail carga la versión histórica por id sin depender de ACTIVE', async () => {
    const executor = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 9, ubicacion_id: 3, version: 1, estado: 'ARCHIVED' }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    const detail = await repository.findVisitFormVersionDetail({ formId: 9, executor });

    expect(executor.query.mock.calls[0][0]).toContain('WHERE id = $1');
    expect(executor.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
    expect(executor.query.mock.calls[0][0]).not.toContain(String.raw`estado = 'ACTIVE'`);
    expect(executor.query.mock.calls[0][1]).toEqual([9]);
    expect(detail).toEqual(
      expect.objectContaining({ id: 9, estado: 'ARCHIVED', tipos: [], fields: [], groups: [] })
    );
  });

  test('softDeleteVisitFormVersion solo marca una versión ARCHIVED y nunca borra físicamente', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 9, ubicacion_id: 3, estado: 'ARCHIVED', deleted_at: new Date() }],
      }),
    };

    const deleted = await repository.softDeleteVisitFormVersion({ client, formId: 9 });

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('SET deleted_at = CURRENT_TIMESTAMP');
    expect(sql).toContain(String.raw`estado = 'ARCHIVED'`);
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(params).toEqual([9]);
    expect(deleted).toEqual(expect.objectContaining({ id: 9, estado: 'ARCHIVED' }));
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
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, respuestas: [], total_count: 1 }] });

    const result = await repository.findVisits({
      filters: {
        estado: 'ABIERTA',
        creator: 'ana',
        fechaDesde: '2026-08-01',
        fechaHasta: '2026-08-31',
        search: 'carlos',
      },
      hasGlobalScope: false,
      userId: 7,
      pagination: {
        pageSize: 25,
        offset: 0,
        sortExpression: 'bv.placa',
        sortOrder: 'asc',
      },
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [dataSql, dataParams] = db.query.mock.calls[0];
    expect(dataSql).toContain('COUNT(*) OVER()::int AS total_count');
    expect(dataSql).toContain('uu.ubicacion_id = bv.ubicacion_id');
    expect(dataSql).toContain('bv.estado = $2');
    expect(dataSql).toContain('bv.visitante_nombre ILIKE $6');
    expect(dataSql).toContain('bv.visitante_documento ILIKE $6');
    expect(dataSql).toContain('bv.placa ILIKE $6');
    expect(dataSql).toContain('jsonb_array_elements(search_group.respuestas)');
    expect(dataSql).toContain(String.raw`search_answer->>'field_key' IN ('nombre', 'cedula')`);
    expect(dataSql).toContain(String.raw`search_response.type_snapshot = 'placa'`);
    expect(dataSql).toContain(String.raw`COALESCE(m.nombre, '') || COALESCE(v.identificador, '')`);
    expect(dataSql).toContain('jsonb_agg');
    expect(dataSql).toContain('bvr.label_snapshot');
    expect(dataSql).toContain('tv.requiere_salida');
    expect(dataSql).toContain('bitacora_visita_grupo_registros');
    expect(dataSql).toContain('AS visitantes');
    expect(dataSql).toMatch(/ORDER BY bv\.placa ASC NULLS LAST,\s+bv\.id ASC/);
    expect(dataSql).toContain('LIMIT $7 OFFSET $8');
    expect(dataParams).toEqual([
      7,
      'ABIERTA',
      '%ana%',
      '2026-08-01',
      '2026-08-31',
      '%carlos%',
      25,
      0,
    ]);
    expect(result).toEqual({ items: [{ id: 1, respuestas: [] }], total: 1 });
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
    expect(client.query.mock.calls[0][0]).toContain('tv.requiere_salida');
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
