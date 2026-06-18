const SortHeader = ({ field, label, sort, onSort, className = '' }) => (
  <th className={className}>
    <button type="button" className="th-sort-btn" onClick={() => onSort(field)}>
      {label}
      <span className={`th-sort-indicator${sort.field === field ? ' active' : ''}`}>
        {sort.field === field && sort.direction === 'desc' ? '↓' : '↑'}
      </span>
    </button>
  </th>
);

export default SortHeader;
