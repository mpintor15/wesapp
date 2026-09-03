import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import CuentasPageHeader from './CuentasPageHeader';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderHeader = (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <CuentasPageHeader
        activeTab="facturas"
        canCreateFactura
        canCreatePago
        canExportReportes
        onBack={jest.fn()}
        onCreateFactura={jest.fn()}
        onOpenBatchPayment={jest.fn()}
        onRefreshFacturas={jest.fn()}
        onRefreshPagos={jest.fn()}
        onShowFacturasReport={jest.fn()}
        onShowPagosReport={jest.fn()}
        {...props}
      />
    );
  });

  return {
    header: () => container.querySelector('header'),
    text: () => container.textContent,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('CuentasPageHeader', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('oculta reporte de facturas sin permiso de exportar reportes', () => {
    const view = renderHeader({ canExportReportes: false });

    expect(view.header().className).toContain('brand-header');
    expect(view.text()).not.toContain('Generar reporte de Facturas');
    expect(view.text()).toContain('Crear nueva factura');

    view.unmount();
  });

  test('oculta reporte de pagos sin permiso de exportar reportes', () => {
    const view = renderHeader({ activeTab: 'pagos', canExportReportes: false });

    expect(view.text()).not.toContain('Generar reporte de Pagos');
    expect(view.text()).toContain('Registrar pago');

    view.unmount();
  });

  test('muestra reportes cuando el permiso está concedido', () => {
    const facturas = renderHeader({ activeTab: 'facturas', canExportReportes: true });
    const pagos = renderHeader({ activeTab: 'pagos', canExportReportes: true });

    expect(facturas.text()).toContain('Generar reporte de Facturas');
    expect(pagos.text()).toContain('Generar reporte de Pagos');

    facturas.unmount();
    pagos.unmount();
  });
});
