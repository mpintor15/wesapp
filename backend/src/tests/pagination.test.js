const {
  buildPaginationMetadata,
  normalizePaginationQuery,
  PAGINATION_DEFAULTS,
} = require('../utils/pagination');

describe('pagination utils', () => {
  const allowedSorts = Object.freeze({
    nombre: 'nombre',
    fecha: 'fecha',
  });

  test('normaliza defaults sin mutar allowlists', () => {
    const before = { ...allowedSorts };
    const result = normalizePaginationQuery({}, { sortBy: 'fecha', allowedSorts });

    expect(result).toMatchObject({
      page: PAGINATION_DEFAULTS.page,
      pageSize: PAGINATION_DEFAULTS.pageSize,
      offset: 0,
      sortBy: 'fecha',
      sortExpression: 'fecha',
      sortOrder: 'desc',
    });
    expect(allowedSorts).toEqual(before);
  });

  test('acepta valores válidos y calcula offset', () => {
    expect(
      normalizePaginationQuery(
        { page: '3', pageSize: '50', search: ' radio ', sortBy: 'nombre', sortOrder: 'asc' },
        { allowedSorts }
      )
    ).toMatchObject({
      page: 3,
      pageSize: 50,
      offset: 100,
      search: 'radio',
      sortBy: 'nombre',
      sortExpression: 'nombre',
      sortOrder: 'asc',
    });
  });

  test.each([
    [{ page: '0' }, /page/i],
    [{ page: '1.5' }, /page/i],
    [{ pageSize: '9' }, /pageSize/i],
    [{ pageSize: '101' }, /pageSize/i],
    [{ pageSize: 'veinte' }, /pageSize/i],
    [{ sortOrder: 'sideways' }, /sortOrder/i],
    [{ sortBy: 'desconocido' }, /sortBy/i],
  ])('rechaza parámetros inválidos: %p', (query, message) => {
    expect(() => normalizePaginationQuery(query, { allowedSorts })).toThrow(message);
  });

  test.each([
    [{ page: 1, pageSize: 25, totalItems: 0 }, 0, false, false],
    [{ page: 2, pageSize: 25, totalItems: 60 }, 3, true, true],
    [{ page: 3, pageSize: 25, totalItems: 60 }, 3, false, true],
  ])(
    'construye metadata consistente para %p',
    (input, totalPages, hasNextPage, hasPreviousPage) => {
      expect(buildPaginationMetadata(input)).toEqual({
        page: input.page,
        pageSize: input.pageSize,
        totalItems: input.totalItems,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      });
    }
  );
});
