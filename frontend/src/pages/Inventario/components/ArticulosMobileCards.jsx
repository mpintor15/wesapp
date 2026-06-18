import {
  formatDate,
  getCaducidadClass,
  getSerieDisplay,
  getTipoLabel,
} from '../utils/inventarioHelpers';

const ArticulosMobileCards = ({
  articulos,
  canDarBajaArticulo,
  canDeleteArticulo,
  onDarBaja,
  onDelete,
  showArticuloActions,
}) => (
  <div className="records-mobile">
    {articulos.map((articulo) => (
      <article key={articulo.id} className="inventory-card">
        <div className="inventory-card-header">
          <div>
            <h3>{articulo.nombre_articulo || 'Artículo sin nombre'}</h3>
            <div className="inventory-card-meta">
              <span>{getTipoLabel(articulo.tipo_articulo)}</span>
            </div>
          </div>
          <span>{articulo.ubicacion_nombre || '-'}</span>
        </div>
        <div className="inventory-card-grid">
          <div>
            <strong>Serie</strong>
            <span>{getSerieDisplay(articulo)}</span>
          </div>
          <div>
            <strong>Cantidad</strong>
            <span>{articulo.cantidad ?? '-'}</span>
          </div>
          <div>
            <strong>Marca / Modelo</strong>
            <span>{[articulo.marca, articulo.modelo].filter(Boolean).join(' / ') || '-'}</span>
          </div>
          <div>
            <strong>Talla / Calibre</strong>
            <span>{[articulo.talla, articulo.calibre].filter(Boolean).join(' / ') || '-'}</span>
          </div>
          <div>
            <strong>Pantalla / Versión</strong>
            <span>
              {[articulo.codigo_pantalla, articulo.version].filter(Boolean).join(' / ') || '-'}
            </span>
          </div>
          <div>
            <strong>Caducidad</strong>
            <span className={`cell-date ${getCaducidadClass(articulo.estado_caducidad)}`}>
              {formatDate(articulo.fecha_caducidad)}
            </span>
          </div>
        </div>
        {showArticuloActions && (
          <div className="inventory-card-actions">
            {canDarBajaArticulo && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onDarBaja(articulo)}
                type="button"
              >
                Dar de baja
              </button>
            )}
            {canDeleteArticulo && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(articulo)}
                type="button"
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </article>
    ))}
  </div>
);

export default ArticulosMobileCards;
