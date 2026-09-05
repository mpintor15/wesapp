import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import UsuarioCreateModal from './UsuarioCreateModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const baseProps = {
  createErrors: {},
  colaboradores: [],
  colaboradoresError: '',
  colaboradoresLoading: false,
  formData: {
    nombre: '',
    apellido: '',
    colaborador_id: '1',
    usuario: '',
    tipo_usuario: '',
    ubicacion_ids: [],
  },
  isCreating: false,
  canManageAssignments: false,
  lockColaborador: true,
  ubicaciones: [],
  ubicacionesError: '',
  ubicacionesLoading: false,
  usuariosSinColaborador: [],
  usuariosSinColaboradorError: '',
  usuariosSinColaboradorLoading: false,
  onCancel: jest.fn(),
  onChange: jest.fn(),
  onLinkUsuarioChange: jest.fn(),
  onModeChange: jest.fn(),
  onSubmit: jest.fn((e) => e.preventDefault()),
};

const renderModal = (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<UsuarioCreateModal {...baseProps} {...props} />);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('UsuarioCreateModal', () => {
  test('sin showLinkOption no ofrece vincular un usuario existente', () => {
    const { container, unmount } = renderModal({ showLinkOption: false });

    expect(
      [...container.querySelectorAll('button')].find(
        (btn) => btn.textContent === 'Vincular usuario existente'
      )
    ).toBeUndefined();
    expect(container.querySelector('#u-nombre')).not.toBeNull();
    expect(container.querySelector('#u-link-usuario')).toBeNull();

    unmount();
  });

  test('con showLinkOption ofrece el selector de modo y respeta mode=vincular', () => {
    const { container, unmount } = renderModal({ showLinkOption: true, mode: 'vincular' });

    expect(
      [...container.querySelectorAll('button')].find(
        (btn) => btn.textContent === 'Vincular usuario existente'
      )
    ).toBeTruthy();
    expect(container.querySelector('#u-nombre')).toBeNull();
    expect(container.querySelector('#u-colaborador')).toBeNull();
    expect(container.querySelector('#u-link-usuario')).not.toBeNull();
    expect(container.querySelector('button[type="submit"]').textContent).toBe('Vincular usuario');

    unmount();
  });

  test('mode=crear (por defecto) muestra el formulario de creación', () => {
    const { container, unmount } = renderModal({ showLinkOption: true, mode: 'crear' });

    expect(container.querySelector('#u-nombre')).not.toBeNull();
    expect(container.querySelector('#u-link-usuario')).toBeNull();
    expect(container.querySelector('button[type="submit"]').textContent).toBe('Crear usuario');

    unmount();
  });
});
