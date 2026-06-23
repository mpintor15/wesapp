import { useEffect, useRef, useState } from 'react';
import useIsMobile from '../hooks/useIsMobile';

const isValidDate = (day, month, year) => {
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const numericYear = Number(year);
  const isLeapYear = numericYear % 4 === 0 && (numericYear % 100 !== 0 || numericYear % 400 === 0);
  const daysPerMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return (
    numericYear >= 1 &&
    numericMonth >= 1 &&
    numericMonth <= 12 &&
    numericDay >= 1 &&
    numericDay <= daysPerMonth[numericMonth - 1]
  );
};

const isoToDisplayDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';

  const [, year, month, day] = match;
  return isValidDate(day, month, year) ? `${day}/${month}/${year}` : '';
};

const displayToIsoDate = (value) => {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';

  const [, day, month, year] = match;
  return isValidDate(day, month, year) ? `${year}-${month}-${day}` : '';
};

const sanitizeDisplayDate = (value) => {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

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
