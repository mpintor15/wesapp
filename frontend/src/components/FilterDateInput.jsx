import { useEffect, useRef, useState } from 'react';
import useIsMobile from '../hooks/useIsMobile';
import { displayToIsoDate, isoToDisplayDate, sanitizeDisplayDate } from '../utils/dateInput';

const FilterDateInput = ({
  ariaLabel,
  className = '',
  id,
  name,
  onBlur,
  onChange,
  value,
  ...props
}) => {
  const isMobile = useIsMobile();
  const [displayValue, setDisplayValue] = useState(() => isoToDisplayDate(value));
  const lastEmittedValue = useRef(value);
  const previousMobileState = useRef(isMobile);

  useEffect(() => {
    const breakpointChanged = previousMobileState.current !== isMobile;

    if (breakpointChanged || value !== lastEmittedValue.current) {
      setDisplayValue(isoToDisplayDate(value));
    }

    lastEmittedValue.current = value;
    previousMobileState.current = isMobile;
  }, [isMobile, value]);

  const handleChange = (event) => {
    if (!isMobile) {
      lastEmittedValue.current = event.target.value;
      onChange(event);
      return;
    }

    const nextDisplayValue = sanitizeDisplayDate(event.target.value);
    const nextIsoValue = displayToIsoDate(nextDisplayValue);

    setDisplayValue(nextDisplayValue);
    lastEmittedValue.current = nextIsoValue;
    onChange({
      target: {
        checked: false,
        name: event.target.name,
        type: 'text',
        value: nextIsoValue,
      },
    });
  };

  const handleBlur = (event) => {
    if (isMobile && displayValue && !displayToIsoDate(displayValue)) {
      setDisplayValue('');
    }

    onBlur?.(event);
  };

  return (
    <input
      {...props}
      aria-label={ariaLabel}
      className={`ff-date-input${className ? ` ${className}` : ''}`}
      id={id}
      inputMode={isMobile ? 'numeric' : undefined}
      maxLength={isMobile ? 10 : undefined}
      name={name}
      onBlur={handleBlur}
      onChange={handleChange}
      pattern={isMobile ? '[0-9]{2}/[0-9]{2}/[0-9]{4}' : undefined}
      placeholder={isMobile ? 'dd/mm/aaaa' : undefined}
      type={isMobile ? 'text' : 'date'}
      value={isMobile ? displayValue : value}
    />
  );
};

export default FilterDateInput;
