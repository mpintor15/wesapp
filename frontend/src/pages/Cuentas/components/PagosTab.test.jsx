import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '../../../testUtils/renderHook';
import PagosTab from './PagosTab';

const renderTab = async (rows = []) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const renderRows = async (nextRows, selectionResetKey = 0) => {
    await act(async () => {
      root.render(
        <PagosTab
          filtersDraft={{}}
          filters={{}}
          rows={nextRows}
          filteredCount={nextRows.length}
          loading={false}
          sort={{ field: 'fecha', direction: 'desc' }}
          currentPage={1}
          totalPages={1}
          selectionResetKey={selectionResetKey}
          onFilterChange={jest.fn()}
          onApplyFilters={jest.fn()}
          onClearFilters={jest.fn()}
          onToggleFilter={jest.fn()}
          onSort={jest.fn()}
          onPageChange={jest.fn()}
        />
      );
    });
  };

  await renderRows(rows);

  return {
    container,
    text: () => container.textContent,
    rerender: renderRows,
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
    expect(tab.text()).toContain('Página 1 de 1');
    expect(
      Array.from(tab.container.querySelectorAll('.pagination button')).every(
        (button) => button.disabled
      )
    ).toBe(true);

    tab.unmount();
  });

  test('muestra facturas relacionadas inline al seleccionar un pago', async () => {
    const tab = await renderTab([
      {
        id: 9,
        fecha: '2026-01-10',
        cliente: 'Cliente QA',
        metodo_pago: 'efectivo',
        total: '25.00',
        facturas: [
          {
            num_factura: 3001,
            fecha_factura: '2026-01-01',
            valor_factura: '100.00',
            valor_abono: '25.00',
            saldo_pendiente: '75.00',
            cancelada: false,
          },
        ],
      },
    ]);

    expect(tab.text()).toContain('Selecciona un pago para visualizar las facturas asociadas.');
    await act(async () =>
      tab.container
        .querySelector('.payment-invoices-chip')
        .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    );
    expect(tab.text()).toContain('Factura #3001');
    expect(tab.text()).toContain('Aplicado');
    expect(tab.container.querySelector('[role="dialog"]')).toBeNull();

    tab.unmount();
  });

  test('sincroniza el pago seleccionado con filas nuevas y limpia selección ausente', async () => {
    const pago = {
      id: 9,
      fecha: '2026-01-10',
      cliente: 'Cliente anterior',
      metodo_pago: 'efectivo',
      total: '25.00',
      facturas: [],
    };
    const tab = await renderTab([pago]);

    await act(async () =>
      tab.container
        .querySelector('.payment-invoices-chip')
        .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    );
    expect(tab.text()).toContain('Este pago no tiene facturas asociadas.');

    await tab.rerender([
      {
        ...pago,
        cliente: 'Cliente actualizado',
        facturas: [
          {
            num_factura: 3001,
            fecha_factura: '2026-01-01',
            valor_factura: '100.00',
            valor_abono: '20.00',
            saldo_pendiente: '80.00',
            cancelada: false,
          },
          {
            num_factura: 3002,
            fecha_factura: '2026-01-02',
            valor_factura: '50.00',
            valor_abono: '5.00',
            saldo_pendiente: '45.00',
            cancelada: false,
          },
        ],
      },
    ]);

    expect(tab.text()).toContain('Cliente actualizado');
    expect(tab.container.querySelectorAll('.pago-invoice-card')).toHaveLength(2);

    await tab.rerender([]);
    expect(tab.text()).toContain('Selecciona un pago para visualizar las facturas asociadas.');

    tab.unmount();
  });

  test('limpia la selección y restaura el estado vacío tras un refresh explícito', async () => {
    const rows = [
      {
        id: 9,
        fecha: '2026-01-10',
        cliente: 'Cliente QA',
        metodo_pago: 'efectivo',
        total: '25.00',
        facturas: [],
      },
    ];
    const tab = await renderTab(rows);

    await act(async () =>
      tab.container
        .querySelector('.payment-invoices-chip')
        .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    );
    expect(tab.container.querySelector('tbody tr').getAttribute('aria-selected')).toBe('true');

    await tab.rerender(rows, 1);

    expect(tab.container.querySelector('tbody tr').getAttribute('aria-selected')).toBe('false');
    expect(tab.text()).toContain('Selecciona un pago para visualizar las facturas asociadas.');

    tab.unmount();
  });
});
