import {
  formatDate,
  getCaducidadClass,
  getEstadoOperativoClass,
  getEstadoOperativoLabel,
  getSerieDisplay,
  getTipoLabel,
} from '../utils/inventarioHelpers';
import ArticulosMobileCards from './ArticulosMobileCards';
import PaginationControls from './PaginationControls';
import SortHeader from './SortHeader';

const ArticulosTable = ({
  articulos,
  articulosPage,
  articulosPageSize,
  articulosSort,
  articulosTotalPages,
  canDarBajaArticulo,
  canDeleteArticulo,
  canEditArticulo,
  emptyStateText,
  onDarBaja,
  onDelete,
  onEdit,
  onPageChange,
  onPageSizeChange,
  onSort,
  paginatedArticulos,
  showArticuloActions,
  articuloActionsClass,
}) => (
  <>
    <div className="table-responsive app-table-shell">
      <table className="app-table articulos-table">
        <thead>
          <tr>
            <SortHeader field="tipo_articulo" label="Tipo" sort={articulosSort} onSort={onSort} />
            <SortHeader
              field="nombre_articulo"
              label="Artículo"
              sort={articulosSort}
              onSort={onSort}
            />
            <SortHeader field="serie" label="Serie" sort={articulosSort} onSort={onSort} />
            <SortHeader field="cantidad" label="Cant." sort={articulosSort} onSort={onSort} />
            <SortHeader field="talla" label="Talla" sort={articulosSort} onSort={onSort} />
            <SortHeader field="marca" label="Marca" sort={articulosSort} onSort={onSort} />
            <SortHeader field="modelo" label="Modelo" sort={articulosSort} onSort={onSort} />
            <SortHeader field="calibre" label="Calibre" sort={articulosSort} onSort={onSort} />
            <SortHeader
              field="codigo_pantalla"
              label="Cód. Pant."
              sort={articulosSort}
              onSort={onSort}
            />
            <SortHeader field="version" label="Versión" sort={articulosSort} onSort={onSort} />
            <SortHeader
              field="fecha_caducidad"
              label="Caducidad"
              sort={articulosSort}
              onSort={onSort}
            />
            <SortHeader
              field="ubicacion_nombre"
              label="Ubicación"
              sort={articulosSort}
              onSort={onSort}
            />
            <SortHeader field="estado" label="Estado" sort={articulosSort} onSort={onSort} />
            {showArticuloActions && (
              <th className={`col-actions app-col-actions ${articuloActionsClass}`}></th>
            )}
          </tr>
        </thead>
        <tbody>
          {articulos.length > 0 ? (
            paginatedArticulos.map((articulo, idx) => (
              <tr key={articulo.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                <td className="cell-compact">{getTipoLabel(articulo.tipo_articulo)}</td>
                <td className="cell-articulo">{articulo.nombre_articulo || '-'}</td>
                <td className="cell-serie">{getSerieDisplay(articulo)}</td>
                <td className="cell-cantidad app-cell-qty">{articulo.cantidad ?? '-'}</td>
                <td className="cell-compact">{articulo.talla || '-'}</td>
                <td className="cell-compact">{articulo.marca || '-'}</td>
                <td className="cell-compact">{articulo.modelo || '-'}</td>
                <td className="cell-compact">{articulo.calibre || '-'}</td>
                <td className="cell-code">{articulo.codigo_pantalla || '-'}</td>
                <td className="cell-compact">{articulo.version || '-'}</td>
                <td
                  className={`cell-date app-cell-date ${getCaducidadClass(
                    articulo.estado_caducidad
                  )}`}
                >
                  {formatDate(articulo.fecha_caducidad)}
                </td>
                <td>{articulo.ubicacion_nombre || '-'}</td>
                <td>
                  <span
                    className={`status-badge ${getEstadoOperativoClass(articulo.estado)}`}
                    aria-label={`Estado: ${getEstadoOperativoLabel(articulo.estado)}`}
                  >
                    {getEstadoOperativoLabel(articulo.estado)}
                  </span>
                </td>
                {showArticuloActions && (
                  <td className={`col-actions app-col-actions ${articuloActionsClass}`}>
                    <div className="action-buttons app-table-actions">
                      {canEditArticulo && (
                        <button
                          className="action-btn action-btn-neutral"
                          onClick={() => onEdit(articulo)}
                          title="Editar artículo"
                          type="button"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            width="13"
                            height="13"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                      )}
                      {canDarBajaArticulo && (
                        <button
                          className="action-btn action-btn-baja"
                          onClick={() => onDarBaja(articulo)}
                          title="Dar de baja"
                          type="button"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            width="13"
                            height="13"
                          >
                            <circle cx="12" cy="12" r="8" />
                            <path d="M8 12h8" />
                          </svg>
                        </button>
                      )}
                      {canDeleteArticulo && (
                        <button
                          className="action-btn action-btn-del"
                          onClick={() => onDelete(articulo)}
                          title="Eliminar administrativamente"
                          type="button"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            width="13"
                            height="13"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={showArticuloActions ? 14 : 13} className="text-center">
                {emptyStateText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    {articulos.length > 0 && (
      <ArticulosMobileCards
        articulos={paginatedArticulos}
        canDarBajaArticulo={canDarBajaArticulo}
        canDeleteArticulo={canDeleteArticulo}
        canEditArticulo={canEditArticulo}
        onDarBaja={onDarBaja}
        onDelete={onDelete}
        onEdit={onEdit}
        showArticuloActions={showArticuloActions}
      />
    )}
    {articulosTotalPages > 1 && (
      <PaginationControls
        page={articulosPage}
        pageSize={articulosPageSize}
        totalPages={articulosTotalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    )}
  </>
);

export default ArticulosTable;
