import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '../../../testUtils/renderHook';
import PagoDetailModal from './PagoDetailModal';

describe('PagoDetailModal', () => {
  test('muestra facturas anuladas como históricas sin saldo cobrable', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PagoDetailModal
          pago={{
            id: 8,
            cliente: 'Cliente QA',
            fecha: '2026-07-01',
            metodo_pago: 'transferencia',
            total: '25.00',
            facturas: [
              {
                abono_id: 11,
                num_factura: 3001,
                fecha_factura: '2026-06-01',
                valor_factura: '100.00',
                valor_abono: '25.00',
                saldo_pendiente: '0.00',
                cancelada: true,
              },
            ],
          }}
          onClose={jest.fn()}
        />
      );
    });

    expect(container.textContent).toContain('Anulada');
    expect(container.textContent).toContain('$0.00');

    act(() => root.unmount());
    container.remove();
  });
});
