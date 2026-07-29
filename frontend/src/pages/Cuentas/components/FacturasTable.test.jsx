import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '../../../testUtils/renderHook';
import FacturasTable from './FacturasTable';

const baseProps = {
  filteredCount: 1,
  filters: {},
  sort: { field: 'num_factura', direction: 'asc' },
  currentPage: 1,
  totalPages: 1,
  totals: {
    subtotal: 0,
    iva: 0,
    total: 0,
    retencion_fuente: 0,
    retencion_iva: 0,
    por_cobrar: 0,
    total_abonos: 0,
    saldo_pendiente: 0,
  },
  canManageFacturas: true,
  onSort: jest.fn(),
  onShowAnulacion: jest.fn(),
  onEdit: jest.fn(),
  onCancel: jest.fn(),
};

const renderTable = async (row) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<FacturasTable {...baseProps} rows={[row]} />);
  });

  return {
    container,
    text: () => container.textContent,
    buttons: () => Array.from(container.querySelectorAll('button')),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('FacturasTable', () => {
  const row = {
    num_factura: 1001,
    fecha_factura: '2026-01-10',
    cliente: 'Cliente QA',
    subtotal: '100.00',
    iva: '15.00',
    retencion_fuente: '0.00',
    retencion_iva: '0.00',
    por_cobrar: '115.00',
    total_abonos: '0.00',
    saldo_pendiente: '115.00',
  };

  test('factura activa muestra acción Anular factura', async () => {
    const table = await renderTable({ ...row, cancelada: false });

    expect(table.text()).toContain('Activa');
    expect(table.buttons().some((button) => button.title === 'Anular factura')).toBe(true);

    table.unmount();
  });

  test('factura anulada muestra estado y no acciones incompatibles', async () => {
    const table = await renderTable({ ...row, cancelada: true });

    expect(table.text()).toContain('Anulada');
    expect(table.buttons().some((button) => button.title === 'Editar Factura')).toBe(false);
    expect(table.buttons().some((button) => button.title === 'Anular factura')).toBe(false);
    expect(table.buttons().some((button) => button.title === 'Ver detalle de anulación')).toBe(
      true
    );

    table.unmount();
  });
});
