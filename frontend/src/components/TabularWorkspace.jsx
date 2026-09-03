const TabularWorkspace = ({
  children,
  className = '',
  controls,
  dataCard = false,
  pagination,
  summary,
}) => {
  const dataBlock = <div className="tabular-workspace__data">{children}</div>;
  const paginationBlock = pagination ? (
    <div className="tabular-workspace__pagination">{pagination}</div>
  ) : null;

  return (
    <section className={`tabular-workspace ${className}`.trim()}>
      {controls ? <div className="tabular-workspace__controls">{controls}</div> : null}
      {summary ? <div className="tabular-workspace__summary">{summary}</div> : null}
      {dataCard ? (
        <div className="tabular-workspace__data-card">
          {dataBlock}
          {paginationBlock}
        </div>
      ) : (
        <>
          {dataBlock}
          {paginationBlock}
        </>
      )}
    </section>
  );
};

export default TabularWorkspace;
