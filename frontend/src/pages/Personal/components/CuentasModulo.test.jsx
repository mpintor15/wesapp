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
    getCatalogoCuentasModulo: jest.fn(),
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
    usuariosService.getCatalogoCuentasModulo.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'inventario',
          label: 'Inventario',
          tabs: [
            { id: 'inventario.articulos', label: 'Artículos', puedeEditar: true },
            { id: 'inventario.bajas', label: 'Bajas', puedeEditar: true },
          ],
        },
        {
          id: 'bitacoras',
          label: 'Bitácoras',
          tabs: [{ id: 'bitacoras.historial', label: 'Registro y visitas', puedeEditar: false }],
        },
      ],
    });
    usuariosService.getCuentasModulo.mockResolvedValue({
      success: true,
      data: [
        {
          id: 9,
          usuario: 'modulo1',
          nombre: 'Módulo 1 Monitoreo',
          apellido: null,
          activo: true,
          primer_login: true,
          accesos_cuenta: { 'inventario.articulos': 'ver' },
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
        nombre: 'Módulo 1 Monitoreo',
        temp_password: 'Temp-1234',
      },
    });
    await act(async () => root.render(<CuentasModulo canEdit onCloseCreate={jest.fn()} />));
    await flush();

    expect(usuariosService.getCuentasModulo).toHaveBeenCalled();
    expect(container.textContent).toContain('Módulo 1 Monitoreo');
    expect(container.textContent).toContain('@modulo1');
    expect(container.textContent).toContain('Pendiente');
    expect(container.textContent).toContain('1 tab · solo lectura');

    const button = (label) => container.querySelector(`button[title="${label}"]`);

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
      data: {
        usuario: 'modulo2.monitoreo',
        nombre: 'Módulo 2 Monitoreo',
        temp_password: 'Abc-999',
      },
    });
    const onCloseCreate = jest.fn();
    await act(async () =>
      root.render(<CuentasModulo canEdit={false} showCreate onCloseCreate={onCloseCreate} />)
    );
    await flush();
    expect(container.textContent).not.toContain('Acciones');

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
      setValue('cm-nombre', 'Módulo 2 Monitoreo');
    });
    // El usuario se sugiere solo a partir del nombre.
    expect(document.getElementById('cm-usuario').value).toBe('modulo2.monitoreo');
    expect(document.getElementById('cm-apellido')).toBeNull();
    const submit = () =>
      [...document.querySelectorAll('button[type="submit"]')]
        .find((b) => b.textContent === 'Crear cuenta')
        .click();

    // Sin accesos elegidos no se crea la cuenta.
    await act(async () => submit());
    await flush();
    expect(usuariosService.createCuentaModulo).not.toHaveBeenCalled();

    // Bitácoras solo admite consulta: no ofrece "Edición".
    const radios = (tabId) => [...document.querySelectorAll(`input[name="acceso-${tabId}"]`)];
    expect(radios('bitacoras.historial')).toHaveLength(2);
    expect(radios('inventario.articulos')).toHaveLength(3);
    await act(async () => radios('inventario.articulos')[2].click());
    await act(async () => radios('bitacoras.historial')[1].click());
    await act(async () => submit());
    await flush();

    expect(usuariosService.createCuentaModulo).toHaveBeenCalledWith({
      nombre: 'Módulo 2 Monitoreo',
      usuario: 'modulo2.monitoreo',
      accesos: { 'inventario.articulos': 'editar', 'bitacoras.historial': 'ver' },
    });
    expect(document.body.textContent).toContain('Abc-999');
    expect(onCloseCreate).toHaveBeenCalled();
  });
  test('edita los accesos de una cuenta existente', async () => {
    usuariosService.updateCuentaModulo.mockResolvedValue({ success: true });
    await act(async () => root.render(<CuentasModulo canEdit onCloseCreate={jest.fn()} />));
    await flush();

    await act(async () => container.querySelector('button[title="Editar accesos"]').click());
    await flush();
    const radios = [...document.querySelectorAll('input[name="acceso-inventario.bajas"]')];
    await act(async () => radios[1].click());
    await act(async () => {
      [...document.querySelectorAll('button[type="submit"]')]
        .find((b) => b.textContent === 'Guardar accesos')
        .click();
    });
    await flush();

    expect(usuariosService.updateCuentaModulo).toHaveBeenCalledWith(9, {
      accesos: { 'inventario.articulos': 'ver', 'inventario.bajas': 'ver' },
    });
  });
  test('no ofrece reenviar la invitación de una cuenta que ya inició sesión', async () => {
    usuariosService.getCuentasModulo.mockResolvedValue({
      success: true,
      data: [
        {
          id: 9,
          usuario: 'modulo1',
          nombre: 'Módulo 1 Monitoreo',
          apellido: null,
          activo: true,
          primer_login: false,
          accesos_cuenta: null,
        },
      ],
    });
    await act(async () => root.render(<CuentasModulo canEdit onCloseCreate={jest.fn()} />));
    await flush();

    expect(container.textContent).toContain('Activa');
    expect(container.querySelector('button[title="Reenviar invitación"]')).toBeNull();
    expect(container.querySelector('button[title="Desactivar"]')).not.toBeNull();
  });
});
