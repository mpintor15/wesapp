const ButtonLoading = ({ children, loading, loadingText = 'Procesando…' }) => (
  <>
    {loading ? <span className="spinner spinner--sm" aria-hidden="true" /> : null}
    <span>{loading ? loadingText : children}</span>
  </>
);

export default ButtonLoading;
