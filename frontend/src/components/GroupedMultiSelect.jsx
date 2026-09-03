import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './SelectionControls.css';

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const GroupedMultiSelect = ({
  emptyMessage = 'No hay opciones disponibles.',
  getGroupLabel,
  getOptionLabel,
  getOptionSearchText = getOptionLabel,
  inputId,
  loading = false,
  onChange,
  options,
  placeholder = 'Buscar…',
  value = [],
}) => {
  const generatedId = useId();
  const id = inputId || generatedId;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedIds = useMemo(() => new Set(value.map(String)), [value]);
  const groups = useMemo(() => {
    const term = normalize(query);
    const visible = options.filter(
      (option) => !term || normalize(getOptionSearchText(option)).includes(term)
    );
    return visible.reduce((result, option) => {
      const group = getGroupLabel(option) || 'Sin grupo';
      if (!result[group]) result[group] = [];
      result[group].push(option);
      return result;
    }, {});
  }, [getGroupLabel, getOptionSearchText, options, query]);

  const toggle = (option) => {
    const optionId = String(option.id);
    onChange(
      selectedIds.has(optionId)
        ? value.filter((item) => String(item) !== optionId)
        : [...value, optionId]
    );
  };

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  return (
    <div className="selection-control selection-control--multi" ref={rootRef}>
      <button
        className="selection-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((current) => !current)}
      >
        {value.length} {value.length === 1 ? 'punto seleccionado' : 'puntos seleccionados'}
      </button>
      {open ? (
        <div id={`${id}-panel`} className="selection-popover selection-multi-panel">
          <input
            id={id}
            autoFocus
            type="search"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
            }}
          />
          {loading ? (
            <p className="selection-empty" role="status">
              Cargando…
            </p>
          ) : null}
          {!loading && Object.keys(groups).length === 0 ? (
            <p className="selection-empty">{emptyMessage}</p>
          ) : null}
          {!loading
            ? Object.entries(groups).map(([group, groupOptions]) => (
                <section className="selection-group" key={group}>
                  <h4>{group}</h4>
                  {groupOptions.slice(0, 50).map((option) => (
                    <label className="selection-option-row" key={option.id}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(String(option.id))}
                        onChange={() => toggle(option)}
                      />
                      <span>{getOptionLabel(option)}</span>
                    </label>
                  ))}
                </section>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
};

export default GroupedMultiSelect;
