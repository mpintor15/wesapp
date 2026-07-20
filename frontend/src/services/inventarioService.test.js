import api from './api';
import inventarioService from './inventarioService';
import { saveBlobWithPickerOrDownload } from './serviceUtils';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('./serviceUtils', () => ({
  extractError: jest.fn((error, fallback) => error?.response?.data?.message || fallback),
  getFilenameFromDisposition: jest.fn((_, fallback) => fallback),
  saveBlobWithPickerOrDownload: jest.fn(),
}));

describe('inventarioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deleteArticulo envía únicamente motivo de eliminación administrativa', async () => {
    api.delete.mockResolvedValue({ data: { success: true, message: 'ok' } });

    const result = await inventarioService.deleteArticulo(12, 'Motivo administrativo');

    expect(result.success).toBe(true);
    expect(api.delete).toHaveBeenCalledWith('/inventario/articulos/12', {
      data: { motivo: 'Motivo administrativo' },
    });
  });

  test('gestiona CRUD de ubicaciones con el cliente HTTP central', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ id: 1, nombre: 'Bodega' }] },
    });
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Ubicación creada exitosamente',
        data: { id: 2, nombre: 'Bodega Norte' },
      },
    });
    api.put.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Ubicación actualizada exitosamente',
        data: { id: 2, nombre: 'Bodega Sur' },
      },
    });
    api.delete.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Ubicación eliminada exitosamente',
        data: { id: 2, nombre: 'Bodega Sur' },
      },
    });

    await expect(inventarioService.getUbicaciones()).resolves.toEqual({
      success: true,
      data: [{ id: 1, nombre: 'Bodega' }],
    });
    await inventarioService.createUbicacion({ nombre: 'Bodega Norte' });
    await inventarioService.updateUbicacion(2, { nombre: 'Bodega Sur' });
    await inventarioService.deleteUbicacion(2);

    expect(api.get).toHaveBeenCalledWith('/inventario/ubicaciones');
    expect(api.post).toHaveBeenCalledWith('/inventario/ubicaciones', {
      nombre: 'Bodega Norte',
    });
    expect(api.put).toHaveBeenCalledWith('/inventario/ubicaciones/2', {
      nombre: 'Bodega Sur',
    });
    expect(api.delete).toHaveBeenCalledWith('/inventario/ubicaciones/2');
  });

  test('preserva error 409 al crear ubicación duplicada', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'Ya existe una ubicación con ese nombre' },
      },
    });

    const result = await inventarioService.createUbicacion({ nombre: 'Bodega' });

    expect(result).toEqual({
      success: false,
      code: undefined,
      message: 'Ya existe una ubicación con ese nombre',
      status: 409,
    });
  });

  test('anula y elimina movimientos con motivo', async () => {
    api.post.mockResolvedValue({ data: { success: true, message: 'anulado' } });
    api.delete.mockResolvedValue({ data: { success: true, message: 'eliminado' } });

    await inventarioService.anularMovimiento(7, 'Motivo suficiente');
    await inventarioService.eliminarMovimiento(7, 'Motivo suficiente');

    expect(api.post).toHaveBeenCalledWith('/inventario/movimientos/7/anular', {
      motivo: 'Motivo suficiente',
    });
    expect(api.delete).toHaveBeenCalledWith('/inventario/movimientos/7', {
      data: { motivo: 'Motivo suficiente' },
    });
  });

  test('anula y elimina bajas con motivo', async () => {
    api.post.mockResolvedValue({ data: { success: true, message: 'anulada' } });
    api.delete.mockResolvedValue({ data: { success: true, message: 'eliminada' } });

    await inventarioService.anularBaja(5, 'Motivo suficiente');
    await inventarioService.eliminarBaja(5, 'Motivo suficiente');

    expect(api.post).toHaveBeenCalledWith('/inventario/bajas/5/anular', {
      motivo: 'Motivo suficiente',
    });
    expect(api.delete).toHaveBeenCalledWith('/inventario/bajas/5', {
      data: { motivo: 'Motivo suficiente' },
    });
  });

  test('descarga PDF sin llamar a regeneración', async () => {
    api.get.mockResolvedValue({
      data: new Blob(['pdf']),
      headers: {},
    });
    saveBlobWithPickerOrDownload.mockResolvedValue({ success: true });

    const result = await inventarioService.downloadMovimientoPdf(9);

    expect(result.success).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/inventario/movimientos/9/pdf', {
      responseType: 'blob',
    });
    expect(api.post).not.toHaveBeenCalledWith('/inventario/movimientos/9/pdf/regenerar');
  });

  test('regenera PDF usando la ruta administrativa explícita', async () => {
    api.post.mockResolvedValue({ data: { success: true, message: 'regenerado' } });

    const result = await inventarioService.regenerateMovimientoPdf(9);

    expect(result.success).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/inventario/movimientos/9/pdf/regenerar');
  });

  test('preserva código estable de error del backend', async () => {
    api.delete.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'PARTIAL_ARTICLE_DELETE_DEPRECATED' },
      },
    });

    const result = await inventarioService.deleteArticulo(3, 'Motivo suficiente');

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        status: 409,
        code: 'PARTIAL_ARTICLE_DELETE_DEPRECATED',
        message:
          'La reducción parcial mediante eliminación ya no está disponible. Use una baja o un movimiento.',
      })
    );
  });
});
