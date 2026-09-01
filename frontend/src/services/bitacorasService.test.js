import api from './api';
import bitacorasService from './bitacorasService';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('bitacorasService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('obtiene Ubicaciones visibles con el cliente HTTP central', async () => {
    const body = { success: true, data: [{ id: 1, nombre: 'Punto' }] };
    api.get.mockResolvedValue({ data: body });

    await expect(bitacorasService.getUbicaciones()).resolves.toEqual(body);
    expect(api.get).toHaveBeenCalledWith('/bitacoras/ubicaciones');
  });

  test('crea un registro enviando únicamente el body permitido', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { id: 10 } } });

    await bitacorasService.createRegistro({
      ubicacion_id: 1,
      manzana_id: 3,
      villa_id: 4,
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad',
      autor_usuario_id: 99,
      estado: 'ANULADA',
      tipo_punto: 'URBANIZACION',
      created_at: undefined,
    });

    expect(api.post).toHaveBeenCalledWith('/bitacoras/registros', {
      ubicacion_id: 1,
      manzana_id: 3,
      villa_id: 4,
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad',
    });
  });

  test('crea un registro sin enviar claves urbanas vacías', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { id: 11 } } });

    await bitacorasService.createRegistro({
      ubicacion_id: 1,
      manzana_id: '',
      villa_id: null,
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad',
    });

    expect(api.post).toHaveBeenCalledWith('/bitacoras/registros', {
      ubicacion_id: 1,
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad',
    });
  });

  test('obtiene opciones urbanas usando endpoints de Bitácoras', async () => {
    api.get
      .mockResolvedValueOnce({ data: { success: true, data: [{ id: 3, nombre: 'A' }] } })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 4,
              identificador: 'A-1',
              residente_principal_nombre: 'Ana Titular',
              residente_principal_contacto: '0991234567',
            },
          ],
        },
      });

    await expect(bitacorasService.getManzanas(1)).resolves.toEqual({
      success: true,
      data: [{ id: 3, nombre: 'A' }],
    });
    await expect(bitacorasService.getVillas(3)).resolves.toEqual({
      success: true,
      data: [
        {
          id: 4,
          identificador: 'A-1',
          residente_principal_nombre: 'Ana Titular',
          residente_principal_contacto: '0991234567',
        },
      ],
    });

    expect(api.get).toHaveBeenNthCalledWith(1, '/bitacoras/ubicaciones/1/manzanas');
    expect(api.get).toHaveBeenNthCalledWith(2, '/bitacoras/manzanas/3/villas');
  });

  test('consulta historial con params soportados y elimina vacíos o desconocidos', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [], meta: {} } });

    await bitacorasService.getRegistros({
      page: 2,
      pageSize: 25,
      ubicacion_id: 4,
      fecha_desde: '2026-08-01',
      fecha_hasta: '',
      estado: 'REGISTRADA',
      autor: 'Ana',
      search: 'no permitido',
      sortBy: 'ocurrido_at',
    });

    expect(api.get).toHaveBeenCalledWith('/bitacoras/registros', {
      params: {
        page: 2,
        pageSize: 25,
        ubicacion_id: 4,
        fecha_desde: '2026-08-01',
        estado: 'REGISTRADA',
        autor: 'Ana',
      },
    });
  });

  test('gestiona visitas y formularios con endpoints Bitácoras y allowlists estrictas', async () => {
    api.get
      .mockResolvedValueOnce({ data: { success: true, data: [{ id: 4, version: 1 }] } })
      .mockResolvedValueOnce({ data: { success: true, data: { id: 5, fields: [] } } });
    api.post
      .mockResolvedValueOnce({ data: { success: true, data: { id: 6 } } })
      .mockResolvedValueOnce({ data: { success: true, data: { id: 7 } } })
      .mockResolvedValueOnce({ data: { success: true, data: { id: 8 } } });

    await bitacorasService.getFormulariosVisitas({ page: 2, nombre: 'Ingreso', extra: 'no' });
    await bitacorasService.getFormularioVisitasActivo(3);
    await bitacorasService.publishFormularioVisitas(3, {
      titulo: 'Formulario',
      mostrar_fecha_hora: false,
      tipos_visita: ['Peatón', 'Vehículo'],
      fields: [{ field_key: 'motivo', label: 'Motivo', type: 'text' }],
      estado: 'ACTIVE',
    });
    await bitacorasService.createVisita({
      ubicacion_id: 3,
      manzana_id: 4,
      villa_id: 5,
      visitante_nombre: 'Ana',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 901,
      placa: 'ABC123',
      respuestas: { motivo: 'Entrega' },
      residente_principal_id: 99,
      form_version_id: 10,
      registrado_por_usuario_id: 11,
      entrada_at: '2026-09-01T08:00:00Z',
      ocurrido_at: '2026-09-01T08:00:00Z',
    });
    await bitacorasService.closeVisita(7);

    expect(api.get).toHaveBeenNthCalledWith(1, '/bitacoras/formularios-visitas', {
      params: { page: 2, nombre: 'Ingreso' },
    });
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      '/bitacoras/ubicaciones/3/formulario-visitas/activo'
    );
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/bitacoras/ubicaciones/3/formulario-visitas/publicar',
      {
        titulo: 'Formulario',
        mostrar_fecha_hora: false,
        tipos_visita: ['Peatón', 'Vehículo'],
        fields: [{ field_key: 'motivo', label: 'Motivo', type: 'text' }],
      }
    );
    expect(api.post).toHaveBeenNthCalledWith(2, '/bitacoras/visitas', {
      ubicacion_id: 3,
      manzana_id: 4,
      villa_id: 5,
      visitante_nombre: 'Ana',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 901,
      placa: 'ABC123',
      respuestas: { motivo: 'Entrega' },
    });
    expect(api.post).toHaveBeenNthCalledWith(3, '/bitacoras/visitas/7/cerrar', {});
  });

  test('consulta visitas con filtros soportados y elimina desconocidos', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [], meta: {} } });

    await bitacorasService.getVisitas({
      page: 2,
      pageSize: 25,
      estado: 'ABIERTA',
      creator: 'Ana',
      fecha_desde: '2026-08-01',
      fecha_hasta: '',
      search: 'Luis',
      sortBy: 'entrada_at',
    });

    expect(api.get).toHaveBeenCalledWith('/bitacoras/visitas', {
      params: {
        page: 2,
        pageSize: 25,
        estado: 'ABIERTA',
        creator: 'Ana',
        fecha_desde: '2026-08-01',
        search: 'Luis',
      },
    });
  });

  test('exporta cada tab con su endpoint y allowlist de filtros', async () => {
    const exportSpy = jest.spyOn(bitacorasService, 'exportExcel').mockResolvedValue({
      success: true,
    });

    await bitacorasService.exportRegistros({ ubicacion_id: 3, autor: 'Ana', extra: 'no' });
    await bitacorasService.exportVisitas({ estado: 'ABIERTA', search: 'ABC', extra: 'no' });
    await bitacorasService.exportFormulariosVisitas({
      nombre: 'Ingreso',
      creator: 'monitor',
      extra: 'no',
    });

    expect(exportSpy).toHaveBeenNthCalledWith(
      1,
      '/bitacoras/registros/excel',
      { ubicacion_id: 3, autor: 'Ana' },
      'reporte_bitacoras.xlsx'
    );
    expect(exportSpy).toHaveBeenNthCalledWith(
      2,
      '/bitacoras/visitas/excel',
      { estado: 'ABIERTA', search: 'ABC' },
      'reporte_visitas.xlsx'
    );
    expect(exportSpy).toHaveBeenNthCalledWith(
      3,
      '/bitacoras/formularios-visitas/excel',
      { nombre: 'Ingreso', creator: 'monitor' },
      'reporte_formularios_visitas.xlsx'
    );

    exportSpy.mockRestore();
  });

  test('no envía placa cuando no se ingresa (opcional para cualquier tipo de visita)', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { id: 9 } } });

    await bitacorasService.createVisita({
      ubicacion_id: 3,
      manzana_id: 4,
      villa_id: 5,
      visitante_nombre: 'Ana',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 900,
      placa: undefined,
      respuestas: {},
    });

    expect(api.post).toHaveBeenCalledWith('/bitacoras/visitas', {
      ubicacion_id: 3,
      manzana_id: 4,
      villa_id: 5,
      visitante_nombre: 'Ana',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 900,
      respuestas: {},
    });
  });

  test('normaliza errores siguiendo el patrón compartido del frontend', async () => {
    api.get.mockRejectedValue({
      response: { status: 403, data: { message: 'Acceso denegado' } },
    });

    await expect(bitacorasService.getUbicaciones()).resolves.toEqual(
      expect.objectContaining({ success: false, status: 403, message: 'Acceso denegado' })
    );
  });
});
