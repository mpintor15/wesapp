import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_PAGINATION, withPaginationParams } from '../utils/pagination';

const cloneFilters = (filters) => ({ ...filters });

const defaultBuildFilters = (filters) => filters;

const defaultGetSortParams = ({ sort }) => ({
  sortBy: sort.field,
  sortOrder: sort.direction,
});

const defaultGetLocalRows = (rows) => rows;
const defaultPaginateRows = (rows) => rows;

const getNextDirection = (sort, field, getInitialSortDirection) => {
  if (sort.field === field) {
    return sort.direction === 'asc' ? 'desc' : 'asc';
  }
  return getInitialSortDirection ? getInitialSortDirection(field) : 'asc';
};

const usePaginatedTableState = ({
  initialFilters,
  initialPageSize = DEFAULT_PAGINATION.pageSize,
  initialSort,
  pagination = null,
  sourceRows = [],
  getLocalRows = defaultGetLocalRows,
  paginateRows = defaultPaginateRows,
  buildFilters = defaultBuildFilters,
  getSortParams = defaultGetSortParams,
  getInitialSortDirection,
}) => {
  const [filters, setFilters] = useState(() => cloneFilters(initialFilters));
  const [filtersDraft, setFiltersDraft] = useState(() => cloneFilters(initialFilters));
  const [sort, setSort] = useState(initialSort);
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGINATION.page);
  const [pageSize, setPageSizeValue] = useState(initialPageSize);

  const localRows = useMemo(
    () => (pagination ? sourceRows : getLocalRows(sourceRows, filters, sort)),
    [filters, getLocalRows, pagination, sort, sourceRows]
  );
  const rows = pagination ? sourceRows : paginateRows(localRows, currentPage, pageSize);
  const filteredRows = pagination ? sourceRows : localRows;
  const totalItems = pagination?.totalItems ?? localRows.length;
  const totalPages = pagination?.totalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));
  const params = useMemo(() => {
    const { sortBy, sortOrder } = getSortParams({ filters, sort });
    return withPaginationParams({
      page: currentPage,
      pageSize,
      sortBy,
      sortOrder,
      filters: buildFilters(filters),
    });
  }, [buildFilters, currentPage, filters, getSortParams, pageSize, sort]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(1, totalPages)));
  }, [totalPages]);

  const setPageSize = (nextPageSize) => {
    setPageSizeValue(nextPageSize);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    const nextSort = {
      field,
      direction: getNextDirection(sort, field, getInitialSortDirection),
    };
    setSort(nextSort);
    setCurrentPage(1);
    return nextSort;
  };

  const handleFilterChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFiltersDraft((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const toggleFilter = (field) => {
    setFiltersDraft((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const applyFilters = () => {
    setFilters(filtersDraft);
    setCurrentPage(1);
    return filtersDraft;
  };

  const clearFilters = () => {
    const cleared = cloneFilters(initialFilters);
    setFiltersDraft(cleared);
    setFilters(cleared);
    setCurrentPage(1);
    return cleared;
  };

  return {
    filters,
    filtersDraft,
    sort,
    currentPage,
    pageSize,
    filteredRows,
    rows,
    totalPages,
    totalItems,
    params,
    setCurrentPage,
    setPageSize,
    handleSort,
    handleFilterChange,
    toggleFilter,
    applyFilters,
    clearFilters,
  };
};

export default usePaginatedTableState;
