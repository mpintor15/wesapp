const SelectLoading = ({ message = 'Cargando opciones…' }) => (
  <span className="select-loading" role="status" aria-live="polite">
    <span className="spinner spinner--sm" aria-hidden="true" />
    {message}
  </span>
);

export default SelectLoading;
