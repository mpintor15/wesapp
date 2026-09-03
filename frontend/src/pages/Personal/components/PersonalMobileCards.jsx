const PersonalMobileCards = ({ canDelete, canEdit, colaboradores, onDelete, onEdit }) => (
  <div className="records-mobile">
    {colaboradores.map((colaborador) => (
      <article key={colaborador.id} className="record-card">
        <div className="record-card-header">
          <h3>{colaborador.nombres_completos}</h3>
          <span
            className={`badge badge-${colaborador.estado === 'activo' ? 'active' : 'inactive'}`}
          >
            {colaborador.estado}
          </span>
        </div>
        <dl className="record-card-details">
          <div>
            <dt>Cédula</dt>
            <dd>{colaborador.cedula}</dd>
          </div>
          <div>
            <dt>Cargo</dt>
            <dd>{colaborador.cargo}</dd>
          </div>
          <div>
            <dt>Celular</dt>
            <dd>{colaborador.celular || '—'}</dd>
          </div>
          <div>
            <dt>Sueldo</dt>
            <dd>
              {colaborador.sueldo ? `$${Number.parseFloat(colaborador.sueldo).toFixed(2)}` : '—'}
            </dd>
          </div>
        </dl>
        <div className="record-card-actions">
          {canEdit ? (
            <button
              className="btn btn-neutral btn-sm"
              onClick={() => onEdit(colaborador)}
              type="button"
            >
              Editar
            </button>
          ) : null}
          {canDelete ? (
            <button
              className="btn btn-destructive btn-sm"
              onClick={() => onDelete(colaborador)}
              type="button"
            >
              Eliminar
            </button>
          ) : null}
        </div>
      </article>
    ))}
  </div>
);

export default PersonalMobileCards;
