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
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad',
      autor_usuario_id: 99,
      estado: 'ANULADA',
      created_at: undefined,
    });

    expect(api.post).toHaveBeenCalledWith('/bitacoras/registros', {
      ubicacion_id: 1,
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad',
    });
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
