import AppModal from '../../../components/AppModal';
import FilterDateInput from '../../../components/FilterDateInput';
import { isStockTipo } from '../utils/inventarioHelpers';

const MovimientoModal = ({
  catalogArticulos,
  canCreateDestinoUbicacion,
  clientes = [],
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
  ubicaciones = [],
}) => {
  const selectedClienteId = movimientoForm.cliente_destino_id
    ? String(movimientoForm.cliente_destino_id)
    : '';
  const destinationOptions = ubicaciones.filter(
    (ubicacion) => String(ubicacion.cliente_id || '') === selectedClienteId
  );

  return (
    <AppModal
      isOpen
      onClose={onCancel}
      title="Crear nuevo movimiento"
      size="md"
      closeOnBackdrop
      className="inventory-movimiento-modal"
    >
      <AppModal.Header />
      <form onSubmit={onSubmit}>
        <AppModal.Body>
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
                    className="btn btn-sm btn-destructive movimiento-item-remove"
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
            <FilterDateInput
              id="mov-fecha"
              name="fecha_movimiento"
              value={movimientoForm.fecha_movimiento}
              onChange={onFormChange}
              required
              className="inventory-date-input"
            />
            {movimientoErrors.fecha_movimiento ? (
              <span className="field-error">{movimientoErrors.fecha_movimiento}</span>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="mov-cliente-destino">Cliente destino</label>
            <select
              id="mov-cliente-destino"
              name="cliente_destino_id"
              value={movimientoForm.cliente_destino_id}
              onChange={onFormChange}
              required
            >
              <option value="">Selecciona un cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </select>
            {movimientoErrors.cliente_destino_id ? (
              <span className="field-error">{movimientoErrors.cliente_destino_id}</span>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="mov-destino">Ubicación Destino</label>
            {canCreateDestinoUbicacion ? (
              <>
                <input
                  id="mov-destino"
                  type="text"
                  name="ubicacion_destino_nombre"
                  value={movimientoForm.ubicacion_destino_nombre}
                  onChange={onFormChange}
                  placeholder="Ej: Puesto Norte"
                  required
                />
                <span className="inventory-location-field-meta">
                  Si no existe para el cliente seleccionado, se creará una nueva ubicación.
                </span>
              </>
            ) : (
              <>
                <select
                  id="mov-destino"
                  name="ubicacion_destino_id"
                  value={movimientoForm.ubicacion_destino_id || ''}
                  onChange={onFormChange}
                  required
                  disabled={!selectedClienteId}
                >
                  <option value="">
                    {selectedClienteId
                      ? 'Selecciona una ubicación existente'
                      : 'Selecciona primero un cliente'}
                  </option>
                  {destinationOptions.map((ubicacion) => (
                    <option key={ubicacion.id} value={ubicacion.id}>
                      {ubicacion.nombre}
                    </option>
                  ))}
                </select>
                <span className="inventory-location-field-meta">
                  Puedes trasladar a una ubicación existente, pero no crear una nueva desde este
                  formulario.
                </span>
              </>
            )}
            {movimientoErrors.ubicacion_destino_nombre ? (
              <span className="field-error">{movimientoErrors.ubicacion_destino_nombre}</span>
            ) : null}
          </div>
        </AppModal.Body>
        <AppModal.Footer className="inventory-modal-actions">
          <button className="btn btn-primary" type="submit" disabled={isSavingMovimiento}>
            {isSavingMovimiento ? (
              <>
                <span className="spinner spinner--sm" />
                Guardando…
              </>
            ) : (
              'Guardar movimiento'
            )}
          </button>
          <button
            className="btn btn-neutral"
            type="button"
            onClick={onCancel}
            disabled={isSavingMovimiento}
          >
            Cancelar
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
};

export default MovimientoModal;
