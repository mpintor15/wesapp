import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import PersonalPageHeader from './PersonalPageHeader';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderHeader = (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <PersonalPageHeader
        canCreate
        canExport
        onBack={jest.fn()}
        onCreate={jest.fn()}
        onExport={jest.fn()}
        onRefresh={jest.fn()}
        {...props}
      />
    );
  });

  return {
    text: () => container.textContent,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('PersonalPageHeader', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('oculta acciones sin permisos granulares', () => {
    const view = renderHeader({ canCreate: false, canExport: false });

    expect(view.text()).not.toContain('Crear nuevo colaborador');
    expect(view.text()).not.toContain('Generar reporte de Personal');
    expect(view.text()).toContain('Personal');

    view.unmount();
  });
});
