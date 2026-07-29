export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PAGINATION = Object.freeze({
  page: 1,
  pageSize: 25,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
});

export const normalizePagination = (pagination, fallbackLength = 0) => ({
  ...DEFAULT_PAGINATION,
  totalItems: fallbackLength,
  totalPages: fallbackLength > 0 ? 1 : 0,
  ...pagination,
});

export const withPaginationParams = ({ page, pageSize, sortBy, sortOrder, filters = {} }) => {
  const params = {
    page: page || DEFAULT_PAGINATION.page,
    pageSize: pageSize || DEFAULT_PAGINATION.pageSize,
    ...filters,
  };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return params;
};
