const { PAGINATION_DEFAULTS } = require('../config/pagination');
const { createHttpError } = require('./http');

const parseIntegerParam = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (!/^\d+$/.test(String(value))) {
    throw createHttpError(400, `${fieldName} debe ser un entero`);
  }
  return Number(value);
};

const normalizePaginationQuery = (query = {}, { sortBy, allowedSorts = {} } = {}) => {
  const page = parseIntegerParam(query.page, 'page') ?? PAGINATION_DEFAULTS.page;
  const pageSize = parseIntegerParam(query.pageSize, 'pageSize') ?? PAGINATION_DEFAULTS.pageSize;

  if (page < 1) {
    throw createHttpError(400, 'page debe ser mayor o igual a 1');
  }
  if (pageSize < PAGINATION_DEFAULTS.minPageSize || pageSize > PAGINATION_DEFAULTS.maxPageSize) {
    throw createHttpError(
      400,
      `pageSize debe estar entre ${PAGINATION_DEFAULTS.minPageSize} y ${PAGINATION_DEFAULTS.maxPageSize}`
    );
  }

  const sortOrder = String(query.sortOrder || 'desc').toLowerCase();
  if (!['asc', 'desc'].includes(sortOrder)) {
    throw createHttpError(400, 'sortOrder debe ser asc o desc');
  }

  const requestedSort = query.sortBy ? String(query.sortBy) : sortBy;
  if (requestedSort && !Object.prototype.hasOwnProperty.call(allowedSorts, requestedSort)) {
    throw createHttpError(400, 'sortBy no es válido');
  }

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    search: query.search ? String(query.search).trim() : '',
    sortBy: requestedSort,
    sortExpression: requestedSort ? allowedSorts[requestedSort] : undefined,
    sortOrder,
  };
};

const buildPaginationMetadata = ({ page, pageSize, totalItems }) => {
  const normalizedTotal = Number(totalItems || 0);
  const totalPages = normalizedTotal === 0 ? 0 : Math.ceil(normalizedTotal / pageSize);

  return {
    page,
    pageSize,
    totalItems: normalizedTotal,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

module.exports = {
  buildPaginationMetadata,
  normalizePaginationQuery,
  PAGINATION_DEFAULTS,
};
