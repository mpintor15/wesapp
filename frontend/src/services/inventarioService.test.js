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

jest.mock('./serviceUtils', () => {
  const actual = jest.requireActual('./serviceUtils');
  return {
    ...actual,
    saveBlobWithPickerOrDownload: jest.fn(),
  };
});

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
    await inventarioService.createUbicacion({ nombre: 'Bodega Norte', cliente_id: 1 });
    await inventarioService.updateUbicacion(2, { nombre: 'Bodega Sur', cliente_id: 1 });
    await inventarioService.deleteUbicacion(2);

    expect(api.get).toHaveBeenCalledWith('/inventario/ubicaciones', { params: {} });
    expect(api.post).toHaveBeenCalledWith('/inventario/ubicaciones', {
      nombre: 'Bodega Norte',
      cliente_id: 1,
    });
    expect(api.put).toHaveBeenCalledWith('/inventario/ubicaciones/2', {
      nombre: 'Bodega Sur',
      cliente_id: 1,
    });
    expect(api.delete).toHaveBeenCalledWith('/inventario/ubicaciones/2');
  });

  test('lista ubicaciones filtrando por cliente', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    await inventarioService.getUbicaciones({ cliente_id: 10 });

    expect(api.get).toHaveBeenCalledWith('/inventario/ubicaciones', {
      params: { cliente_id: 10 },
    });
  });

  test('gestiona Manzanas y Villas con rutas jerárquicas', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [] } });
    api.post.mockResolvedValue({ data: { success: true, data: { id: 2 } } });
    api.put.mockResolvedValue({ data: { success: true, data: { id: 2 } } });

    await inventarioService.getManzanas(4);
    await inventarioService.createManzana(4, { nombre: 'A' });
    await inventarioService.updateManzana(2, { estado: 'inactivo' });
    await inventarioService.getVillas(2);
    await inventarioService.createVilla(2, { identificador: '1' });
    await inventarioService.updateVilla(7, { estado: 'activo' });

    expect(api.get).toHaveBeenNthCalledWith(1, '/inventario/ubicaciones/4/manzanas');
    expect(api.post).toHaveBeenNthCalledWith(1, '/inventario/ubicaciones/4/manzanas', {
      nombre: 'A',
    });
    expect(api.put).toHaveBeenNthCalledWith(1, '/inventario/ubicaciones/manzanas/2', {
      estado: 'inactivo',
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/inventario/ubicaciones/manzanas/2/villas');
    expect(api.post).toHaveBeenNthCalledWith(2, '/inventario/ubicaciones/manzanas/2/villas', {
      identificador: '1',
    });
    expect(api.put).toHaveBeenNthCalledWith(2, '/inventario/ubicaciones/villas/7', {
      estado: 'activo',
    });
  });

  test('gestiona Residente principal con rutas de Villa', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: null } });
    api.post.mockResolvedValue({ data: { success: true, data: { id: 8 } } });
    api.put.mockResolvedValue({ data: { success: true, data: { id: 8 } } });
    await inventarioService.getResidentePrincipal(3);
    await inventarioService.createResidentePrincipal(3, { nombre: 'Ana', contacto: '099' });
    await inventarioService.updateResidentePrincipal(8, { activo: false });
    expect(api.get).toHaveBeenCalledWith('/inventario/ubicaciones/villas/3/residente-principal');
    expect(api.post).toHaveBeenCalledWith('/inventario/ubicaciones/villas/3/residente-principal', {
      nombre: 'Ana',
      contacto: '099',
    });
    expect(api.put).toHaveBeenCalledWith('/inventario/ubicaciones/residentes/8', {
      activo: false,
    });
  });

  test('getUbicacionesAgrupadas conserva parámetros y metadata agrupada', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            tipo: 'cliente',
            cliente_id: 1,
            cliente_nombre: 'ACME',
            cliente_estado: 'activo',
            ubicaciones: [],
            resumen: { total: 0, en_uso: 0, disponibles: 0 },
          },
        ],
        meta: {
          page: 2,
          pageSize: 25,
          totalGroups: 10,
          filteredGroups: 10,
          totalLocations: 14,
          filteredLocations: 8,
          totalPages: 1,
        },
      },
    });

    const result = await inventarioService.getUbicacionesAgrupadas({
      search: 'ACME',
      page: 2,
      pageSize: 25,
    });

    expect(api.get).toHaveBeenCalledWith('/inventario/ubicaciones/agrupadas', {
      params: { search: 'ACME', page: 2, pageSize: 25 },
    });
    expect(result.data[0].cliente_nombre).toBe('ACME');
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 25,
      totalGroups: 10,
      filteredGroups: 10,
      totalLocations: 14,
      filteredLocations: 8,
      totalPages: 1,
    });
  });

  test('getArticulos conserva parámetros y metadata de paginación del backend', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [{ id: 1, nombre_articulo: 'Radio' }],
        pagination: {
          page: 2,
          pageSize: 50,
          totalItems: 76,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      },
    });

    const result = await inventarioService.getArticulos({
      page: 2,
      pageSize: 50,
      search: 'Radio',
      sortBy: 'nombre_articulo',
      sortOrder: 'asc',
    });

    expect(api.get).toHaveBeenCalledWith('/inventario/articulos', {
      params: {
        page: 2,
        pageSize: 50,
        search: 'Radio',
        sortBy: 'nombre_articulo',
        sortOrder: 'asc',
      },
    });
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 50,
      totalItems: 76,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  test('getMovimientos conserva parámetros paginados y metadata vacía', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [],
        pagination: {
          page: 3,
          pageSize: 25,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      },
    });

    const result = await inventarioService.getMovimientos({
      page: 3,
      pageSize: 25,
      destino_id: 4,
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(api.get).toHaveBeenCalledWith('/inventario/movimientos', {
      params: {
        page: 3,
        pageSize: 25,
        destino_id: 4,
        from: '2026-01-01',
        to: '2026-01-31',
      },
    });
    expect(result.data).toEqual([]);
    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.totalItems).toBe(0);
  });

  test('catálogo de artículos no usa parámetros de paginación', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ id: 5, nombre_articulo: 'Casco' }] },
    });

    const result = await inventarioService.getArticulosCatalogo();

    expect(result.data).toEqual([{ id: 5, nombre_articulo: 'Casco' }]);
    expect(api.get).toHaveBeenCalledWith('/inventario/articulos/catalogo');
  });

  test('preserva error 409 al crear ubicación duplicada', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'Ya existe una ubicación con ese nombre' },
      },
    });

    const result = await inventarioService.createUbicacion({ nombre: 'Bodega', cliente_id: 1 });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        code: undefined,
        message: 'Ya existe una ubicación con ese nombre',
        status: 409,
        isNetworkError: false,
      })
    );
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

  test('exportaciones de inventario conservan filtros sin page ni pageSize implícitos', async () => {
    api.get.mockResolvedValue({
      data: new Blob(['excel']),
      headers: {},
    });
    saveBlobWithPickerOrDownload.mockResolvedValue({ success: true });

    await inventarioService.exportArticulosExcel({ tipo: 'equipo', search: 'radio' });
    await inventarioService.exportMovimientosExcel({ destino_id: 7, from: '2026-01-01' });

    expect(api.get).toHaveBeenNthCalledWith(1, '/inventario/articulos/excel', {
      params: { tipo: 'equipo', search: 'radio' },
      responseType: 'blob',
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/inventario/movimientos/excel', {
      params: { destino_id: 7, from: '2026-01-01' },
      responseType: 'blob',
    });
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
