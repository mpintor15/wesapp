import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import './SelectionControls.css';

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const SearchableSelect = forwardRef(
  (
    {
      disabled = false,
      emptyMessage = 'No hay opciones disponibles.',
      getOptionLabel,
      getOptionSearchText = getOptionLabel,
      inputId,
      loading = false,
      loadingMessage = 'Cargando…',
      onChange,
      options,
      placeholder = 'Buscar…',
      value,
      ...inputProps
    },
    ref
  ) => {
    const generatedId = useId();
    const id = inputId || generatedId;
    const listboxId = `${id}-listbox`;
    const rootRef = useRef(null);
    const selected = options.find((option) => String(option.id) === String(value));
    const [query, setQuery] = useState(selected ? getOptionLabel(selected) : '');
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    useEffect(() => {
      if (selected) setQuery(getOptionLabel(selected));
      else if (!value) setQuery('');
    }, [getOptionLabel, selected, value]);
    const filtered = useMemo(() => {
      const term = normalize(query);
      if (!term || (selected && query === getOptionLabel(selected))) return options;
      return options.filter((option) => normalize(getOptionSearchText(option)).includes(term));
    }, [getOptionLabel, getOptionSearchText, options, query, selected]);
    const renderedOptions = useMemo(() => filtered.slice(0, 50), [filtered]);

    const select = (option) => {
      onChange(String(option.id));
      setQuery(getOptionLabel(option));
      setOpen(false);
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

    const handleKeyDown = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((current) => {
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          return Math.max(0, Math.min(renderedOptions.length - 1, current + direction));
        });
      } else if (event.key === 'Enter' && open && renderedOptions[activeIndex]) {
        event.preventDefault();
        select(renderedOptions[activeIndex]);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    return (
      <div className="selection-control" ref={rootRef}>
        <input
          ref={ref}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={
            open && renderedOptions[activeIndex]
              ? `${id}-${renderedOptions[activeIndex].id}`
              : undefined
          }
          autoComplete="off"
          disabled={disabled || loading}
          placeholder={loading ? loadingMessage : placeholder}
          value={query}
          {...inputProps}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
            if (selected) onChange('');
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {open && !disabled && !loading ? (
          <ul id={listboxId} className="selection-popover" role="listbox">
            {filtered.length === 0 ? (
              <li className="selection-empty">{emptyMessage}</li>
            ) : (
              renderedOptions.map((option, index) => (
                <li
                  id={`${id}-${option.id}`}
                  key={option.id}
                  role="option"
                  aria-selected={String(option.id) === String(value)}
                  className={index === activeIndex ? 'is-active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(option)}
                >
                  {getOptionLabel(option)}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    );
  }
);

SearchableSelect.displayName = 'SearchableSelect';

export default SearchableSelect;
