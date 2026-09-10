import { useState } from 'react';
import PropTypes from 'prop-types';

// En desktop el contenido siempre se muestra (el botón se oculta por CSS);
// en móvil arranca colapsado para no empujar la tabla fuera de la vista
// inicial, y el usuario lo expande con un toggle de al menos 44px de alto.
const CollapsibleFilters = ({ label = 'Filtros', children }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="collapsible-filters">
      <button
        type="button"
        className="collapsible-filters__toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{label}</span>
        <span
          className={`collapsible-filters__chevron${open ? ' is-open' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      <div className={`collapsible-filters__body${open ? ' is-open' : ''}`}>{children}</div>
    </div>
  );
};

CollapsibleFilters.propTypes = {
  label: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default CollapsibleFilters;
