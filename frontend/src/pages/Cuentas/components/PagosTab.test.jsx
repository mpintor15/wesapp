import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '../../../testUtils/renderHook';
import PagosTab from './PagosTab';

const renderTab = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <PagosTab
        filtersDraft={{}}
        filters={{}}
        rows={[]}
        filteredCount={0}
        loading={false}
        sort={{ field: 'fecha', direction: 'desc' }}
        currentPage={1}
        totalPages={1}
        onFilterChange={jest.fn()}
        onApplyFilters={jest.fn()}
        onClearFilters={jest.fn()}
        onToggleFilter={jest.fn()}
        onSort={jest.fn()}
        onOpenDetail={jest.fn()}
        onPageChange={jest.fn()}
      />
    );
  });

  return {
    container,
    text: () => container.textContent,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('PagosTab', () => {
  test('muestra ayuda histórica no accionable para pagos', async () => {
    const tab = await renderTab();

    expect(tab.text()).toContain(
      'Los pagos registrados se conservan como parte del historial contable.'
    );
    expect(tab.text()).not.toContain('Anular pago');
    expect(tab.text()).not.toContain('Eliminar pago');

    tab.unmount();
  });
});
