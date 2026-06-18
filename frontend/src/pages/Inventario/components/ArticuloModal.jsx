import { ARTICULO_TIPOS, isStockTipo } from '../utils/inventarioHelpers';

const FieldError = ({ children }) =>
  children ? <span className="field-error">{children}</span> : null;

const RadioField = ({ error, formData, onChange, name, id, label, placeholder }) => (
  <div className="form-group">
    <label htmlFor={id}>{label}</label>
    <input
      id={id}
      type="text"
      name={name}
      value={formData[name]}
      onChange={onChange}
      placeholder={placeholder}
      required
      autoComplete="off"
      data-lpignore="true"
      data-1p-ignore="true"
    />
    <FieldError>{error}</FieldError>
  </div>
);

const ArticuloModal = ({
  articuloErrors,
  formData,
  isSavingArticulo,
  onCancel,
  onFormChange,
  onSubmit,
  onTipoChange,
}) => (
  <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
    <div className="modal modal-articulo">
      <div className="modal-header">
        <h3>Nuevo artículo</h3>
        <button className="modal-close" onClick={onCancel} type="button">
          ×
        </button>
      </div>
      <form onSubmit={onSubmit} autoComplete="off" data-lpignore="true" data-1p-ignore="true">
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="art-tipo">Tipo</label>
              <select
                id="art-tipo"
                name="tipo_articulo"
                value={formData.tipo_articulo}
                onChange={onTipoChange}
                className={articuloErrors.tipo_articulo ? 'input-warning' : ''}
              >
                <option value="">Selecciona un tipo</option>
                {ARTICULO_TIPOS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {articuloErrors.tipo_articulo ? (
                <div className="inventory-field-warning" role="alert">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 9v4m0 4h.01M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{articuloErrors.tipo_articulo}</span>
                </div>
              ) : null}
            </div>

            <div className="form-group">
              <label htmlFor="art-nombre">Nombre del Artículo</label>
              <input
                id="art-nombre"
                type="text"
                name="nombre_articulo"
                value={formData.nombre_articulo}
                onChange={onFormChange}
                placeholder="Ej: Chaleco antibalas"
                required
              />
              <FieldError>{articuloErrors.nombre_articulo}</FieldError>
            </div>

            {isStockTipo(formData.tipo_articulo) && (
              <>
                <div className="form-group">
                  <label htmlFor="art-cantidad">Cantidad</label>
                  <input
                    id="art-cantidad"
                    type="number"
                    name="cantidad"
                    value={formData.cantidad}
                    onChange={onFormChange}
                    min="1"
                    placeholder="1"
                    required
                  />
                  <FieldError>{articuloErrors.cantidad}</FieldError>
                </div>
                {formData.tipo_articulo === 'equipo' && (
                  <div className="form-group">
                    <label htmlFor="art-talla">
                      Talla <span className="label-optional">(opcional)</span>
                    </label>
                    <input
                      id="art-talla"
                      type="text"
                      name="talla"
                      value={formData.talla}
                      onChange={onFormChange}
                      placeholder="S, M, L, XL..."
                    />
                  </div>
                )}
              </>
            )}

            {formData.tipo_articulo === 'placa_balistica' && (
              <>
                <div className="form-group">
                  <label htmlFor="art-serie-pb">Número de Serie</label>
                  <input
                    id="art-serie-pb"
                    type="text"
                    name="numero_serie"
                    value={formData.numero_serie}
                    onChange={onFormChange}
                    placeholder="Ej: PB-001"
                    required
                  />
                  <FieldError>{articuloErrors.numero_serie}</FieldError>
                </div>
                <div className="form-group">
                  <label htmlFor="art-caducidad">Fecha de Caducidad</label>
                  <input
                    id="art-caducidad"
                    type="date"
                    name="fecha_caducidad"
                    value={formData.fecha_caducidad}
                    onChange={onFormChange}
                    required
                  />
                  <FieldError>{articuloErrors.fecha_caducidad}</FieldError>
                </div>
              </>
            )}

            {formData.tipo_articulo === 'arma' && (
              <>
                <div className="form-group">
                  <label htmlFor="art-marca-arma">Marca</label>
                  <input
                    id="art-marca-arma"
                    type="text"
                    name="marca"
                    value={formData.marca}
                    onChange={onFormChange}
                    placeholder="Ej: Glock"
                    required
                  />
                  <FieldError>{articuloErrors.marca}</FieldError>
                </div>
                <div className="form-group">
                  <label htmlFor="art-modelo-arma">Modelo</label>
                  <input
                    id="art-modelo-arma"
                    type="text"
                    name="modelo"
                    value={formData.modelo}
                    onChange={onFormChange}
                    placeholder="Ej: G19"
                  />
                  <FieldError>{articuloErrors.modelo}</FieldError>
                </div>
                <div className="form-group">
                  <label htmlFor="art-serie-arma">Número de Serie</label>
                  <input
                    id="art-serie-arma"
                    type="text"
                    name="numero_serie"
                    value={formData.numero_serie}
                    onChange={onFormChange}
                    placeholder="Ej: ABC123"
                    required
                  />
                  <FieldError>{articuloErrors.numero_serie}</FieldError>
                </div>
                <div className="form-group">
                  <label htmlFor="art-calibre">Calibre</label>
                  <input
                    id="art-calibre"
                    type="text"
                    name="calibre"
                    value={formData.calibre}
                    onChange={onFormChange}
                    placeholder="Ej: 9mm"
                    required
                  />
                  <FieldError>{articuloErrors.calibre}</FieldError>
                </div>
              </>
            )}

            {formData.tipo_articulo === 'radio' && (
              <>
                <RadioField
                  error={articuloErrors.codigo_pantalla}
                  formData={formData}
                  onChange={onFormChange}
                  name="codigo_pantalla"
                  id="art-cod-pantalla"
                  label="Código Pantalla"
                  placeholder="Ej: P-001"
                />
                <RadioField
                  error={articuloErrors.codigo_radio}
                  formData={formData}
                  onChange={onFormChange}
                  name="codigo_radio"
                  id="art-cod-radio"
                  label="Número de Serie"
                  placeholder="Ej: R-001"
                />
                <RadioField
                  error={articuloErrors.version}
                  formData={formData}
                  onChange={onFormChange}
                  name="version"
                  id="art-version"
                  label="Versión"
                  placeholder="Ej: 2.1"
                />
                <RadioField
                  error={articuloErrors.marca}
                  formData={formData}
                  onChange={onFormChange}
                  name="marca"
                  id="art-marca-radio"
                  label="Marca"
                  placeholder="Ej: Motorola"
                />
                <RadioField
                  error={articuloErrors.modelo}
                  formData={formData}
                  onChange={onFormChange}
                  name="modelo"
                  id="art-modelo-radio"
                  label="Modelo"
                  placeholder="Ej: Motorola APX"
                />
              </>
            )}

            <div className="form-group">
              <label htmlFor="art-ubicacion">Ubicación</label>
              <input
                id="art-ubicacion"
                type="text"
                name="ubicacion_nombre"
                value={formData.ubicacion_nombre}
                onChange={onFormChange}
                placeholder="Ej: Bodega principal"
                required
              />
              <FieldError>{articuloErrors.ubicacion_nombre}</FieldError>
            </div>
          </div>
        </div>
        <div className="modal-buttons">
          <button className="btn btn-primary" type="submit" disabled={isSavingArticulo}>
            {isSavingArticulo ? (
              <>
                <span className="spinner spinner--sm" />
                Guardando…
              </>
            ) : (
              'Crear Artículo'
            )}
          </button>
          <button
            className="btn btn-modal-clear"
            type="button"
            onClick={onCancel}
            disabled={isSavingArticulo}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default ArticuloModal;
