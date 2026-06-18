import { isStockTipo } from '../utils/inventarioHelpers';

const MovimientoModal = ({
  catalogArticulos,
  filterArticulos,
  isSavingMovimiento,
  itemDropdownOpen,
  itemSearchTerms,
  movimientoErrors,
  movimientoForm,
  onAddItem,
  onCancel,
  onClearArticulo,
  onFormChange,
  onItemChange,
  onRemoveItem,
  onSelectArticulo,
  onSubmit,
  setItemDropdownOpen,
  setItemSearchTerms,
}) => (
  <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
    <div className="modal modal-movimiento">
      <div className="modal-header">
        <h3>Nuevo movimiento</h3>
        <button className="modal-close" onClick={onCancel} type="button">
          ×
        </button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          <div className="movimiento-items-section">
            <div className="movimiento-items-header">
              <h4>Artículos a mover</h4>
              <button className="btn btn-sm btn-primary" type="button" onClick={onAddItem}>
                Agregar
              </button>
            </div>
            {movimientoForm.items.map((item, index) => {
              const selectedArticulo = catalogArticulos.find(
                (a) => String(a.id) === String(item.articulo_id)
              );
              const isStockArticulo =
                selectedArticulo && isStockTipo(selectedArticulo.tipo_articulo);
              const disableCantidad = selectedArticulo && !isStockArticulo;
              const hasSize = Boolean(selectedArticulo?.talla);
              const maxCantidad =
                isStockArticulo && selectedArticulo?.cantidad ? selectedArticulo.cantidad : 1;
              const searchTerm = itemSearchTerms[index] || '';
              const isOpen = itemDropdownOpen[index] || false;
              const filteredList = filterArticulos(searchTerm);
              const hasSelection = Boolean(item.articulo_id);

              return (
                <div className="movimiento-item-row" key={`mov-item-${index}`}>
                  <div className="item-search-wrapper">
                    <div className="item-search-input-row">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemSearchTerms((prev) => prev.map((t, i) => (i === index ? val : t)));
                          setItemDropdownOpen((prev) =>
                            prev.map((v, i) => (i === index ? true : v))
                          );
                          if (hasSelection) onClearArticulo(index);
                        }}
                        onFocus={() => {
                          if (!hasSelection) {
                            setItemDropdownOpen((prev) =>
                              prev.map((v, i) => (i === index ? true : v))
                            );
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setItemDropdownOpen((prev) =>
                              prev.map((v, i) => (i === index ? false : v))
                            );
                          }, 150);
                        }}
                        placeholder="Buscar artículo..."
                        className={hasSelection ? 'search-selected' : ''}
                      />
                      {hasSelection && (
                        <button
                          type="button"
                          className="search-clear-btn"
                          onClick={() => {
                            onClearArticulo(index);
                            setItemDropdownOpen((prev) =>
                              prev.map((v, i) => (i === index ? true : v))
                            );
                          }}
                          title="Cambiar artículo"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {isOpen && !hasSelection && (
                      <ul className="item-search-dropdown">
                        {filteredList.length > 0 ? (
                          filteredList.map((a) => (
                            <li key={a.id} onMouseDown={() => onSelectArticulo(index, a)}>
                              <span className="dropdown-name">
                                {a.nombre_articulo || 'Artículo'}
                              </span>
                              {(a.tipo_articulo === 'radio' ? a.codigo_radio : a.numero_serie) && (
                                <span className="dropdown-serie">
                                  {a.tipo_articulo === 'radio' ? a.codigo_radio : a.numero_serie}
                                </span>
                              )}
                              {a.talla && <span className="dropdown-talla">Talla: {a.talla}</span>}
                              {isStockTipo(a.tipo_articulo) && a.cantidad && (
                                <span className="dropdown-qty">x{a.cantidad}</span>
                              )}
                              {a.ubicacion_nombre && (
                                <span className="dropdown-ubi">{a.ubicacion_nombre}</span>
                              )}
                            </li>
                          ))
                        ) : (
                          <li className="dropdown-empty">Sin resultados</li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div className="item-cantidad">
                    <input
                      type="number"
                      min="1"
                      max={maxCantidad}
                      value={item.cantidad}
                      disabled={disableCantidad}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10) || 1;
                        onItemChange(index, 'cantidad', Math.min(val, maxCantidad));
                      }}
                      placeholder="Cant."
                    />
                  </div>
                  {hasSize && (
                    <div className="item-talla">
                      <input
                        type="text"
                        value={item.talla || ''}
                        readOnly
                        className="talla-readonly"
                        title={`Talla fija: ${item.talla}`}
                      />
                    </div>
                  )}
                  <button
                    className="btn btn-sm btn-danger"
                    type="button"
                    onClick={() => onRemoveItem(index)}
                    disabled={movimientoForm.items.length === 1}
                    title="Quitar artículo"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {movimientoErrors.items ? (
              <span className="field-error">{movimientoErrors.items}</span>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="mov-fecha">Fecha</label>
            <input
              id="mov-fecha"
              type="date"
              name="fecha_movimiento"
              value={movimientoForm.fecha_movimiento}
              onChange={onFormChange}
              required
            />
            {movimientoErrors.fecha_movimiento ? (
              <span className="field-error">{movimientoErrors.fecha_movimiento}</span>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="mov-destino">Ubicación Destino</label>
            <input
              id="mov-destino"
              type="text"
              name="ubicacion_destino_nombre"
              value={movimientoForm.ubicacion_destino_nombre}
              onChange={onFormChange}
              placeholder="Ej: Puesto Norte"
              required
            />
            {movimientoErrors.ubicacion_destino_nombre ? (
              <span className="field-error">{movimientoErrors.ubicacion_destino_nombre}</span>
            ) : null}
          </div>
        </div>
        <div className="modal-buttons">
          <button className="btn btn-primary" type="submit" disabled={isSavingMovimiento}>
            {isSavingMovimiento ? (
              <>
                <span className="spinner spinner--sm" />
                Guardando…
              </>
            ) : (
              'Guardar Movimiento'
            )}
          </button>
          <button
            className="btn btn-modal-clear"
            type="button"
            onClick={onCancel}
            disabled={isSavingMovimiento}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default MovimientoModal;
