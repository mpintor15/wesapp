import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import usuariosService from '../../../services/usuariosService';
import CuentasModulo from './CuentasModulo';

jest.mock('../../../context/ToastContext', () => {
  const toast = { showToast: jest.fn() };
  return { useToast: () => toast };
});

jest.mock('../../../services/usuariosService', () => ({
  __esModule: true,
  default: {
    getCuentasModulo: jest.fn(),
    createCuentaModulo: jest.fn(),
    updateCuentaModulo: jest.fn(),
    reenviarInvitacionCuentaModulo: jest.fn(),
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('CuentasModulo', () => {
  let container;
  let root;

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    usuariosService.getCuentasModulo.mockResolvedValue({
      success: true,
      data: [
        {
          id: 9,
          usuario: 'modulo1',
          nombre: 'Módulo 1',
          apellido: 'Monitoreo',
          activo: true,
          primer_login: true,
        },
      ],
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test('lista solo cuentas compartidas y permite desactivar y reenviar invitación', async () => {
    usuariosService.updateCuentaModulo.mockResolvedValue({ success: true });
    usuariosService.reenviarInvitacionCuentaModulo.mockResolvedValue({
      success: true,
      data: {
        usuario: 'modulo1',
        nombre: 'Módulo 1',
        apellido: 'Monitoreo',
        temp_password: 'Temp-1234',
      },
    });
    await act(async () => root.render(<CuentasModulo canCreate canEdit />));
    await flush();

    expect(usuariosService.getCuentasModulo).toHaveBeenCalled();
    expect(container.textContent).toContain('Módulo 1 Monitoreo');
    expect(container.textContent).toContain('@modulo1');
    expect(container.textContent).toContain('Pendiente');

    const button = (label) =>
      [...container.querySelectorAll('button')].find((b) => b.textContent === label);

    await act(async () => button('Desactivar').click());
    expect(usuariosService.updateCuentaModulo).toHaveBeenCalledWith(9, { activo: false });

    await act(async () => button('Reenviar invitación').click());
    await flush();
    expect(usuariosService.reenviarInvitacionCuentaModulo).toHaveBeenCalledWith(9);
    expect(document.body.textContent).toContain('Temp-1234');
  });

  test('crea una cuenta con nombre, apellido y usuario y muestra la invitación', async () => {
    usuariosService.createCuentaModulo.mockResolvedValue({
      success: true,
      data: { usuario: 'm2', nombre: 'Módulo 2', apellido: 'Monitoreo', temp_password: 'Abc-999' },
    });
    await act(async () => root.render(<CuentasModulo canCreate canEdit={false} />));
    await flush();
    expect(container.textContent).not.toContain('Acciones');

    await act(async () =>
      [...container.querySelectorAll('button')]
        .find((b) => b.textContent === 'Crear cuenta de módulo')
        .click()
    );
    const setValue = (id, value) => {
      const input = document.getElementById(id);
      const setter = Object.getOwnPropertyDescriptor(
        globalThis.HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(input, value);
      input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    };
    await act(async () => {
      setValue('cm-nombre', 'Módulo 2');
      setValue('cm-apellido', 'Monitoreo');
      setValue('cm-usuario', 'm2');
    });
    await act(async () => {
      [...document.querySelectorAll('button[type="submit"]')]
        .find((b) => b.textContent === 'Crear cuenta')
        .click();
    });
    await flush();

    expect(usuariosService.createCuentaModulo).toHaveBeenCalledWith({
      nombre: 'Módulo 2',
      apellido: 'Monitoreo',
      usuario: 'm2',
    });
    expect(document.body.textContent).toContain('Abc-999');
  });
});
