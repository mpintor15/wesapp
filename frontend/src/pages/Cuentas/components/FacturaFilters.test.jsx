import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '../../../testUtils/renderHook';
import FacturaFilters from './FacturaFilters';

const baseProps = {
  filters: {
    search: '',
    fechaInicio: '',
    fechaFin: '',
    estado: '',
    conSaldo: true,
    ordenAlfabetico: true,
  },
  onFilterChange: jest.fn(),
  onApply: jest.fn(),
  onClear: jest.fn(),
  onToggle: jest.fn(),
};

const renderFilters = async (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<FacturaFilters {...baseProps} {...props} />);
  });

  return {
    button: (text) =>
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === text
      ),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('FacturaFilters', () => {
  test('refleja Con deuda y Agrupar por cliente activos en la UI', async () => {
    const filters = await renderFilters();

    expect(filters.button('Con deuda').classList.contains('active')).toBe(true);
    expect(filters.button('Agrupar por cliente').classList.contains('active')).toBe(true);

    filters.unmount();
  });
});
