import {
  DEFAULT_PAGINATION,
  PAGE_SIZE_OPTIONS,
  normalizePagination,
  withPaginationParams,
} from './pagination';

describe('pagination utils', () => {
  test('expone opciones y defaults del contrato compartido', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100]);
    expect(DEFAULT_PAGINATION).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(Object.isFrozen(DEFAULT_PAGINATION)).toBe(true);
  });

  test('normaliza metadata ausente sin forzar páginas para resultados vacíos', () => {
    expect(normalizePagination(undefined, 0)).toEqual(DEFAULT_PAGINATION);
    expect(normalizePagination(undefined, 3)).toEqual({
      ...DEFAULT_PAGINATION,
      totalItems: 3,
      totalPages: 1,
    });
  });

  test('preserva metadata explícita del backend sobre el fallback local', () => {
    expect(
      normalizePagination(
        {
          page: 2,
          pageSize: 50,
          totalItems: 120,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
        50
      )
    ).toEqual({
      page: 2,
      pageSize: 50,
      totalItems: 120,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  test('construye parámetros sin mutar filtros ni agregar orden vacío', () => {
    const filters = { search: 'Radio', estado: 'activa' };

    expect(withPaginationParams({ page: 2, pageSize: 100, filters })).toEqual({
      page: 2,
      pageSize: 100,
      search: 'Radio',
      estado: 'activa',
    });
    expect(filters).toEqual({ search: 'Radio', estado: 'activa' });
  });

  test('incluye sortBy y sortOrder solo cuando están definidos', () => {
    expect(
      withPaginationParams({
        page: 1,
        pageSize: 25,
        sortBy: 'fecha',
        sortOrder: 'desc',
        filters: {},
      })
    ).toEqual({
      page: 1,
      pageSize: 25,
      sortBy: 'fecha',
      sortOrder: 'desc',
    });
  });
});
