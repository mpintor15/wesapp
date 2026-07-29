import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import UsuariosTable from './UsuariosTable';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const usuarioPendiente = {
  id: 1,
  nombre: 'Ana',
  apellido: 'Vera',
  usuario: 'avera',
  tipo_usuario: 'secretario',
  activo: true,
  primer_login: true,
};

const renderTable = (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <UsuariosTable
        canDelete
        canEdit
        canInvite
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onInvite={jest.fn()}
        onSort={jest.fn()}
        tableSort={{ field: 'apellido', direction: 'asc' }}
        usuarios={[usuarioPendiente]}
        {...props}
      />
    );
  });

  return {
    text: () => container.textContent,
    query: (selector) => container.querySelector(selector),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('UsuariosTable', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('oculta acciones sin permisos granulares', () => {
    const view = renderTable({ canDelete: false, canEdit: false, canInvite: false });

    expect(view.query('[aria-label="Editar Ana Vera"]')).toBeNull();
    expect(view.query('[aria-label="Eliminar Ana Vera"]')).toBeNull();
    expect(view.query('[aria-label="Reenviar invitación a Ana Vera"]')).toBeNull();
    expect(view.text()).toContain('@avera');

    view.unmount();
  });
});
