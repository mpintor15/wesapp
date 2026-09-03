import {
  buildArticuloFilterParams,
  buildArticuloPayload,
  buildBajaPayload,
  buildMovimientoPayload,
  canDeleteAdminRecord,
  canVoidRecord,
  filterArticulosForMovimiento,
  filterMovimientos,
  getBajaActionState,
  getArticuloLabel,
  getArticuloTypeFormData,
  getEstadoOperativoLabel,
  getMovimientoActionState,
  getNextSortState,
  getSerieDisplay,
  sortArticulos,
  validateArticuloForm,
  validateBajaForm,
  validateMotivoAdministrativo,
  validateMovimientoForm,
} from './inventarioHelpers';

describe('inventarioHelpers', () => {
  test('formatea etiqueta y serie según tipo de artículo', () => {
    const radio = {
      tipo_articulo: 'radio',
      nombre_articulo: 'Radio',
      codigo_radio: 'RAD-1',
      ubicacion_nombre: 'Bodega',
    };

    expect(getSerieDisplay(radio)).toBe('RAD-1');
    expect(getArticuloLabel({ ...radio, cantidad: 3 })).toBe('Radio - RAD-1 (Bodega)');
    expect(
      getArticuloLabel({ tipo_articulo: 'equipo', nombre_articulo: 'Chaleco', cantidad: 3 })
    ).toBe('Chaleco [x3]');
  });

  test('limpia campos al cambiar tipo de artículo', () => {
    const next = getArticuloTypeFormData(
      {
        tipo_articulo: 'equipo',
        nombre_articulo: 'Old',
        cantidad: '3',
        numero_serie: 'SER',
        codigo_radio: 'RAD',
      },
      'radio'
    );

    expect(next).toEqual(
      expect.objectContaining({
        tipo_articulo: 'radio',
        nombre_articulo: 'Radio',
        cantidad: '',
        numero_serie: '',
      })
    );
  });

  test('valida campos requeridos por tipo de artículo', () => {
    expect(
      validateArticuloForm({
        tipo_articulo: 'radio',
        nombre_articulo: 'Radio',
        ubicacion_nombre: 'Bodega',
        codigo_pantalla: '',
        codigo_radio: '',
        version: '',
        modelo: '',
        marca: '',
      })
    ).toEqual(
      expect.objectContaining({
        codigo_pantalla: expect.any(String),
        codigo_radio: expect.any(String),
        version: expect.any(String),
        modelo: expect.any(String),
        marca: expect.any(String),
      })
    );
  });

  test('normaliza payload de artículo stock y serializado', () => {
    expect(buildArticuloPayload({ tipo_articulo: 'equipo', cantidad: '5' })).toEqual(
      expect.objectContaining({ cantidad: 5 })
    );
    expect(buildArticuloPayload({ tipo_articulo: 'arma', cantidad: '' })).toEqual(
      expect.objectContaining({ cantidad: 1 })
    );
  });

  test('valida movimiento y transforma payload', () => {
    expect(
      validateMovimientoForm({
        tipo_movimiento: 'traslado',
        fecha_movimiento: '2026-07-09',
        cliente_destino_id: '',
        ubicacion_destino_id: '',
        ubicacion_destino_nombre: '',
        items: [{ articulo_id: '1', cantidad: '2' }],
      })
    ).toEqual(
      expect.objectContaining({
        cliente_destino_id: expect.any(String),
        ubicacion_destino_nombre: expect.any(String),
      })
    );
    expect(
      validateMovimientoForm({
        tipo_movimiento: 'traslado',
        fecha_movimiento: '2026-07-09',
        cliente_destino_id: '4',
        ubicacion_destino_id: '8',
        ubicacion_destino_nombre: '',
        items: [{ articulo_id: '1', cantidad: '2' }],
      }).ubicacion_destino_nombre
    ).toBeUndefined();

    expect(
      buildMovimientoPayload({
        fecha_movimiento: '2026-07-09',
        cliente_destino_id: '4',
        ubicacion_destino_id: '',
        ubicacion_destino_nombre: 'Bodega',
        items: [{ articulo_id: '1', cantidad: '2', talla: 'M' }],
      })
    ).toEqual({
      fecha_movimiento: '2026-07-09',
      cliente_destino_id: 4,
      ubicacion_destino_nombre: 'Bodega',
      items: [{ articulo_id: 1, cantidad: 2, talla: 'M' }],
    });

    expect(
      buildMovimientoPayload({
        fecha_movimiento: '2026-07-09',
        cliente_destino_id: '4',
        ubicacion_destino_id: '8',
        ubicacion_destino_nombre: '',
        items: [{ articulo_id: '1', cantidad: '2', talla: 'M' }],
      })
    ).toEqual({
      fecha_movimiento: '2026-07-09',
      cliente_destino_id: 4,
      ubicacion_destino_id: 8,
      items: [{ articulo_id: 1, cantidad: 2, talla: 'M' }],
    });
  });

  test('filtra artículos disponibles para movimiento por etiqueta', () => {
    const articulos = [
      { tipo_articulo: 'equipo', nombre_articulo: 'Chaleco', cantidad: 2 },
      { tipo_articulo: 'radio', nombre_articulo: 'Radio', codigo_radio: 'RAD-9' },
    ];

    expect(filterArticulosForMovimiento(articulos, 'rad-9')).toEqual([articulos[1]]);
  });

  test('valida baja y construye payload', () => {
    const target = { tipo_articulo: 'equipo', cantidad: 2 };
    expect(validateBajaForm(target, { motivo: '', cantidad: '1' })).toEqual({
      message: 'Ingresa un motivo',
    });
    expect(
      validateBajaForm(target, { motivo: 'Equipo dañado irreparable', cantidad: '3' })
    ).toEqual({
      message: 'La cantidad supera el stock disponible',
    });
    expect(
      buildBajaPayload(target, { motivo: ' Equipo dañado irreparable ', cantidad: '2' })
    ).toEqual({
      motivo: 'Equipo dañado irreparable',
      cantidad: 2,
    });
  });

  test('valida motivos administrativos entre 10 y 500 caracteres', () => {
    expect(validateMotivoAdministrativo('')).toBe('Ingresa un motivo');
    expect(validateMotivoAdministrativo(' corto ')).toBe(
      'El motivo debe tener al menos 10 caracteres'
    );
    expect(validateMotivoAdministrativo('a'.repeat(501))).toBe(
      'El motivo no puede exceder 500 caracteres'
    );
    expect(validateMotivoAdministrativo('Motivo suficiente')).toBe('');
  });

  test('calcula estados operativos y acciones de movimientos', () => {
    const permissions = {
      can: (action) =>
        [
          'movimientos.pdf.download',
          'movimientos.pdf.regenerate',
          'movimientos.void',
          'movimientos.deleteAdmin',
        ].includes(action),
    };

    expect(getEstadoOperativoLabel('ANULADO')).toBe('Anulado');
    expect(canVoidRecord({ estado: 'ACTIVO', reversible: true, reversal_status: 'COMPLETE' })).toBe(
      true
    );
    expect(canDeleteAdminRecord({ estado: 'ANULADO' })).toBe(true);

    expect(
      getMovimientoActionState(
        { estado: 'ACTIVO', reversible: true, reversal_status: 'COMPLETE' },
        permissions
      )
    ).toEqual(
      expect.objectContaining({
        canDownloadPdf: true,
        canRegeneratePdf: true,
        canVoid: true,
        canDelete: false,
      })
    );

    expect(
      getMovimientoActionState(
        { estado: 'ACTIVO', reversible: false, reversal_status: 'INCOMPLETE' },
        permissions
      )
    ).toEqual(expect.objectContaining({ canVoid: false, showDisabledVoid: true }));

    expect(getMovimientoActionState({ estado: 'ELIMINADO' }, permissions)).toEqual(
      expect.objectContaining({ hasAnyAction: false })
    );
  });

  test('calcula acciones de bajas según estado y permisos', () => {
    const permissions = {
      can: (action) => ['bajas.void', 'bajas.deleteAdmin'].includes(action),
    };

    expect(
      getBajaActionState(
        { estado: 'ACTIVO', reversible: true, reversal_status: 'COMPLETE' },
        permissions
      )
    ).toEqual(expect.objectContaining({ canVoid: true, canDelete: false }));
    expect(getBajaActionState({ estado: 'ANULADO' }, permissions)).toEqual(
      expect.objectContaining({ canVoid: false, canDelete: true })
    );
    expect(getBajaActionState({ estado: 'ELIMINADO' }, permissions)).toEqual(
      expect.objectContaining({ hasAnyAction: false })
    );
  });

  test('construye filtros compactos para artículos', () => {
    expect(
      buildArticuloFilterParams({
        tipo: 'radio',
        ubicacion_id: '',
        estado: 'vigente',
        search: 'rad',
      })
    ).toEqual({
      tipo: 'radio',
      estado: 'vigente',
      search: 'rad',
    });
  });

  test('ordena artículos por cantidad usando la coerción numérica actual', () => {
    const articulos = [{ cantidad: null }, { cantidad: 2 }, { cantidad: 10 }];
    expect(sortArticulos(articulos, { field: 'cantidad', direction: 'asc' })).toEqual([
      { cantidad: null },
      { cantidad: 2 },
      { cantidad: 10 },
    ]);
  });

  test('filtra movimientos por búsqueda, destino y rango de fechas', () => {
    const movimientos = [
      {
        articulos_movidos: 'Radio',
        ubicacion_origen: 'A',
        ubicacion_destino_id: 2,
        usuario: 'Ana',
        fecha_movimiento: '2026-07-09',
      },
      {
        articulos_movidos: 'Chaleco',
        ubicacion_origen: 'B',
        ubicacion_destino_id: 3,
        usuario: 'Luis',
        fecha_movimiento: '2026-08-01',
      },
    ];

    expect(
      filterMovimientos(movimientos, {
        search: 'radio',
        destino_id: '2',
        from: '2026-07-01',
        to: '2026-07-31',
      })
    ).toEqual([movimientos[0]]);
  });

  test('alterna estado de ordenamiento', () => {
    expect(getNextSortState({ field: 'cantidad', direction: 'asc' }, 'cantidad')).toEqual({
      field: 'cantidad',
      direction: 'desc',
    });
    expect(getNextSortState({ field: 'cantidad', direction: 'asc' }, 'nombre_articulo')).toEqual({
      field: 'nombre_articulo',
      direction: 'asc',
    });
  });
});
