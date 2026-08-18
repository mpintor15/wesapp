import ArticulosFilters from './ArticulosFilters';
import ArticulosTable from './ArticulosTable';

const ArticulosTab = ({
  articuloActionsClass,
  articulosPage,
  articulosSort,
  articulosTotalPages,
  canDarBajaArticulo,
  canDeleteArticulo,
  canEditArticulo,
  emptyStateText,
  filters,
  loading,
  onApplyFilters,
  onClearFilters,
  onDarBaja,
  onDelete,
  onEdit,
  onFilterChange,
  onPageChange,
  onSort,
  paginatedArticulos,
  showArticuloActions,
  sortedArticulos,
  ubicaciones,
}) => (
  <div className="tab-content tabular-workspace">
    <ArticulosFilters
      filters={filters}
      ubicaciones={ubicaciones}
      onApply={onApplyFilters}
      onChange={onFilterChange}
      onClear={onClearFilters}
    />

    {loading ? (
      <div className="loading">
        <div className="loading-spinner"></div>
        Cargando artículos...
      </div>
    ) : (
      <>
        <div className="table-result-count">
          Mostrando {paginatedArticulos.length} de {sortedArticulos.length} artículo(s)
        </div>

        <ArticulosTable
          articulos={sortedArticulos}
          articulosPage={articulosPage}
          articulosSort={articulosSort}
          articulosTotalPages={articulosTotalPages}
          canDarBajaArticulo={canDarBajaArticulo}
          canDeleteArticulo={canDeleteArticulo}
          canEditArticulo={canEditArticulo}
          emptyStateText={emptyStateText}
          onDarBaja={onDarBaja}
          onDelete={onDelete}
          onEdit={onEdit}
          onPageChange={onPageChange}
          onSort={onSort}
          paginatedArticulos={paginatedArticulos}
          showArticuloActions={showArticuloActions}
          articuloActionsClass={articuloActionsClass}
        />
      </>
    )}
  </div>
);

export default ArticulosTab;
