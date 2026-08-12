const TabularWorkspace = ({ children, className = '', controls, pagination, summary }) => (
  <section className={`tabular-workspace ${className}`.trim()}>
    {controls ? <div className="tabular-workspace__controls">{controls}</div> : null}
    {summary ? <div className="tabular-workspace__summary">{summary}</div> : null}
    <div className="tabular-workspace__data">{children}</div>
    {pagination ? <div className="tabular-workspace__pagination">{pagination}</div> : null}
  </section>
);

export default TabularWorkspace;
