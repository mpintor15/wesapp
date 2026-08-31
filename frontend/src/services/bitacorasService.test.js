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

  test('normaliza errores siguiendo el patrón compartido del frontend', async () => {
    api.get.mockRejectedValue({
      response: { status: 403, data: { message: 'Acceso denegado' } },
    });

    await expect(bitacorasService.getUbicaciones()).resolves.toEqual(
      expect.objectContaining({ success: false, status: 403, message: 'Acceso denegado' })
    );
  });
});
