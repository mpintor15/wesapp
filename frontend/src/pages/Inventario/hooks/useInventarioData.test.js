import useInventarioData from './useInventarioData';
import clientesService from '../../../services/clientesService';
import inventarioService from '../../../services/inventarioService';
import { act, flushPromises, renderHook } from '../../../testUtils/renderHook';

jest.mock('../../../services/clientesService', () => ({
  __esModule: true,
  default: {
    listClientes: jest.fn(),
    listOpcionesUbicaciones: jest.fn(),
  },
}));

jest.mock('../../../services/inventarioService', () => ({
  __esModule: true,
  default: {
    getUbicaciones: jest.fn(),
    createUbicacion: jest.fn(),
    getArticulos: jest.fn(),
    getMovimientos: jest.fn(),
    getBajasArticulos: jest.fn(),
  },
}));

const success = (data = []) => ({ success: true, data });

describe('useInventarioData', () => {
  const showMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    inventarioService.getUbicaciones.mockResolvedValue(success([{ id: 1, nombre: 'Bodega' }]));
    clientesService.listOpcionesUbicaciones.mockResolvedValue(
      success([{ id: 3, nombre: 'ACME', estado: 'activo' }])
    );
    inventarioService.getArticulos.mockResolvedValue(
      success([{ id: 10, nombre_articulo: 'Radio' }])
    );
    inventarioService.getMovimientos.mockResolvedValue(success([{ id: 20 }]));
    inventarioService.getBajasArticulos.mockResolvedValue(success([{ id: 30 }]));
  });

  test('carga datos iniciales de inventario, movimientos y bajas', async () => {
    const hook = renderHook(() => useInventarioData({ showMessage }));

    await flushPromises();

    expect(inventarioService.getUbicaciones).toHaveBeenCalledTimes(1);
    expect(clientesService.listOpcionesUbicaciones).toHaveBeenCalledTimes(1);
    expect(clientesService.listClientes).not.toHaveBeenCalled();
    expect(inventarioService.getArticulos).toHaveBeenCalledWith();
    expect(inventarioService.getMovimientos).toHaveBeenCalledTimes(1);
    expect(inventarioService.getBajasArticulos).toHaveBeenCalledWith({});
    expect(hook.result.ubicaciones).toEqual([{ id: 1, nombre: 'Bodega' }]);
    expect(hook.result.clientes).toEqual([{ id: 3, nombre: 'ACME', estado: 'activo' }]);
    expect(hook.result.articulos).toEqual([{ id: 10, nombre_articulo: 'Radio' }]);
    expect(hook.result.catalogArticulos).toEqual([{ id: 10, nombre_articulo: 'Radio' }]);
    expect(hook.result.movimientos).toEqual([{ id: 20 }]);
    expect(hook.result.bajas).toEqual([{ id: 30 }]);
    expect(hook.result.loading).toBe(false);
    expect(hook.result.movimientosLoaded).toBe(true);
    expect(hook.result.bajasLoaded).toBe(true);

    hook.unmount();
  });

  test('conserva metadata paginada de artículos, movimientos y bajas', async () => {
    inventarioService.getArticulos.mockResolvedValue(
      success([{ id: 10, nombre_articulo: 'Radio' }])
    );
    inventarioService.getArticulos.mockResolvedValueOnce({
      success: true,
      data: [{ id: 10, nombre_articulo: 'Radio' }],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 31,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      },
    });
    inventarioService.getMovimientos.mockResolvedValueOnce({
      success: true,
      data: [{ id: 20 }],
      pagination: {
        page: 2,
        pageSize: 10,
        totalItems: 11,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });
    inventarioService.getBajasArticulos.mockResolvedValueOnce({
      success: true,
      data: [{ id: 30 }],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    const hook = renderHook(() => useInventarioData({ showMessage }));

    await flushPromises();

    expect(hook.result.articulosPagination).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 31,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(hook.result.movimientosPagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 11,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
    expect(hook.result.bajasPagination).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    hook.unmount();
  });

  test('permite cargar inventario con opciones limitadas de clientes', async () => {
    clientesService.listOpcionesUbicaciones.mockResolvedValue(
      success([
        { id: 3, nombre: 'ACME', estado: 'activo' },
        { id: 4, nombre: 'Cliente histórico', estado: 'inactivo' },
      ])
    );

    const hook = renderHook(() => useInventarioData({ showMessage }));

    await flushPromises();

    expect(clientesService.listOpcionesUbicaciones).toHaveBeenCalledTimes(1);
    expect(clientesService.listClientes).not.toHaveBeenCalled();
    expect(hook.result.clientes).toEqual([
      { id: 3, nombre: 'ACME', estado: 'activo' },
      { id: 4, nombre: 'Cliente histórico', estado: 'inactivo' },
    ]);
    expect(hook.result.loading).toBe(false);
    expect(showMessage).not.toHaveBeenCalled();

    hook.unmount();
  });

  test('reporta error de carga inicial con fallback existente', async () => {
    inventarioService.getUbicaciones.mockResolvedValue({ success: false });
    inventarioService.getArticulos.mockResolvedValue({ success: false });

    const hook = renderHook(() => useInventarioData({ showMessage }));

    await flushPromises();

    expect(showMessage).toHaveBeenCalledWith('error', 'Error al cargar inventario');
    expect(hook.result.loading).toBe(false);

    hook.unmount();
  });

  test('maneja error de opciones limitadas sin dejar loader infinito', async () => {
    clientesService.listOpcionesUbicaciones.mockResolvedValue({
      success: false,
      message: 'Error al obtener clientes para ubicaciones',
    });

    const hook = renderHook(() => useInventarioData({ showMessage }));

    await flushPromises();

    expect(clientesService.listClientes).not.toHaveBeenCalled();
    expect(hook.result.clientes).toEqual([]);
    expect(hook.result.ubicaciones).toEqual([{ id: 1, nombre: 'Bodega' }]);
    expect(hook.result.articulos).toEqual([{ id: 10, nombre_articulo: 'Radio' }]);
    expect(showMessage).toHaveBeenCalledWith('error', 'Error al obtener clientes para ubicaciones');
    expect(hook.result.loading).toBe(false);

    hook.unmount();
  });

  test('fetchArticulos refresca lista filtrada y catálogo cuando corresponde', async () => {
    const hook = renderHook(() => useInventarioData({ showMessage }));
    await flushPromises();
    jest.clearAllMocks();

    inventarioService.getArticulos
      .mockResolvedValueOnce(success([{ id: 11, nombre_articulo: 'Radio filtrado' }]))
      .mockResolvedValueOnce(success([{ id: 12, nombre_articulo: 'Catálogo' }]));

    await act(async () => {
      await hook.result.fetchArticulos({ tipo: 'radio' }, true);
    });

    expect(inventarioService.getArticulos).toHaveBeenNthCalledWith(1, { tipo: 'radio' });
    expect(inventarioService.getArticulos).toHaveBeenNthCalledWith(2);
    expect(hook.result.articulos).toEqual([{ id: 11, nombre_articulo: 'Radio filtrado' }]);
    expect(hook.result.catalogArticulos).toEqual([{ id: 12, nombre_articulo: 'Catálogo' }]);

    hook.unmount();
  });

  test('loadMovimientos y loadBajas recargan datos bajo demanda', async () => {
    const hook = renderHook(() => useInventarioData({ showMessage }));
    await flushPromises();
    jest.clearAllMocks();

    inventarioService.getMovimientos.mockResolvedValueOnce(success([{ id: 40 }]));
    inventarioService.getBajasArticulos.mockResolvedValueOnce(success([{ id: 50 }]));

    await act(async () => {
      await hook.result.loadMovimientos();
      await hook.result.loadBajas({ search: 'radio' });
    });

    expect(inventarioService.getMovimientos).toHaveBeenCalledTimes(1);
    expect(inventarioService.getBajasArticulos).toHaveBeenCalledWith({ search: 'radio' });
    expect(hook.result.movimientos).toEqual([{ id: 40 }]);
    expect(hook.result.bajas).toEqual([{ id: 50 }]);

    hook.unmount();
  });

  test('fetchArticulos y loadMovimientos pasan parámetros paginados sin transformar', async () => {
    const hook = renderHook(() => useInventarioData({ showMessage }));
    await flushPromises();
    jest.clearAllMocks();

    inventarioService.getArticulos.mockResolvedValueOnce(
      success([{ id: 13, nombre_articulo: 'Radio' }])
    );
    inventarioService.getMovimientos.mockResolvedValueOnce(success([{ id: 41 }]));

    await act(async () => {
      await hook.result.fetchArticulos(
        { page: 2, pageSize: 50, sortBy: 'nombre_articulo', search: 'Radio' },
        false
      );
      await hook.result.loadMovimientos({ page: 3, pageSize: 25, destino_id: 4 });
    });

    expect(inventarioService.getArticulos).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      sortBy: 'nombre_articulo',
      search: 'Radio',
    });
    expect(inventarioService.getMovimientos).toHaveBeenCalledWith({
      page: 3,
      pageSize: 25,
      destino_id: 4,
    });

    hook.unmount();
  });

  test('upsertUbicacion actualiza el catálogo local sin recargar ubicaciones', async () => {
    const hook = renderHook(() => useInventarioData({ showMessage }));
    await flushPromises();
    jest.clearAllMocks();

    act(() => {
      hook.result.upsertUbicacion({
        id: 2,
        nombre: 'Patio',
      });
    });

    expect(inventarioService.getUbicaciones).not.toHaveBeenCalled();
    expect(hook.result.ubicaciones).toEqual([
      { id: 1, nombre: 'Bodega' },
      { id: 2, nombre: 'Patio', articulos_activos: 0, articulos_totales: 0 },
    ]);

    hook.unmount();
  });
});
