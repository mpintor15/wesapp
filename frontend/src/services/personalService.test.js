import api from './api';
import personalService from './personalService';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

describe('personalService.getColaboradores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('pasa page/pageSize/filtros al backend y normaliza la metadata de paginación', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [{ id: 1, nombres_completos: 'Ana Torres' }],
        pagination: {
          page: 2,
          pageSize: 25,
          totalItems: 30,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      },
    });

    const result = await personalService.getColaboradores({
      page: 2,
      pageSize: 25,
      search: 'ana',
      estado: 'activo',
      cargo: 'Guardia',
    });

    expect(api.get).toHaveBeenCalledWith('/personal/colaboradores', {
      params: { page: 2, pageSize: 25, search: 'ana', estado: 'activo', cargo: 'Guardia' },
    });
    expect(result).toEqual({
      success: true,
      data: [{ id: 1, nombres_completos: 'Ana Torres' }],
      pagination: {
        page: 2,
        pageSize: 25,
        totalItems: 30,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });
  });

  test('sin pagination en la respuesta, cae al fallback derivado del largo de datos', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ id: 1 }, { id: 2 }] },
    });

    const result = await personalService.getColaboradores({});

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});
