import React from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { act, flushPromises } from '../../../testUtils/renderHook';
import inventarioService from '../../../services/inventarioService';
import UrbanizacionMastersModal from './UrbanizacionMastersModal';

jest.mock('../../../services/inventarioService', () => ({
  __esModule: true,
  default: {
    getManzanas: jest.fn(),
    createManzana: jest.fn(),
    updateManzana: jest.fn(),
    getVillas: jest.fn(),
    createVilla: jest.fn(),
    updateVilla: jest.fn(),
    getResidentePrincipal: jest.fn(),
    createResidentePrincipal: jest.fn(),
    updateResidentePrincipal: jest.fn(),
  },
}));

const success = (data) => ({ success: true, data });

const renderModal = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <UrbanizacionMastersModal
        ubicacion={{ id: 4, nombre: 'Conjunto Norte', tipo_punto: 'URBANIZACION' }}
        onClose={jest.fn()}
      />
    );
  });
  await flushPromises();
  const button = (text) =>
    Array.from(document.body.querySelectorAll('button')).find((item) =>
      item.textContent.includes(text)
    );
  return {
    container,
    root,
    button,
    field: (selector) => document.body.querySelector(selector),
    text: () => document.body.textContent,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  inventarioService.getManzanas.mockResolvedValue(success([]));
  inventarioService.getVillas.mockResolvedValue(success([]));
  inventarioService.getResidentePrincipal.mockResolvedValue(success(null));
});

test('muestra estado vacío y crea una Manzana', async () => {
  inventarioService.createManzana.mockResolvedValue(success({ id: 1 }));
  const page = await renderModal();
  expect(page.text()).toContain('todavía no tiene Manzanas');

  act(() => {
    Simulate.change(page.field('#manzana-nombre'), { target: { value: ' Etapa A ' } });
  });
  await act(async () => {
    Simulate.submit(page.field('#manzana-nombre').closest('form'));
  });
  await flushPromises();
  expect(inventarioService.createManzana).toHaveBeenCalledWith(4, { nombre: 'Etapa A' });
  page.unmount();
});

test('crea Villa y permite desactivar/reactivar con confirmación', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.getVillas.mockResolvedValue(
    success([{ id: 3, identificador: 'Villa 1', estado: 'activo' }])
  );
  inventarioService.createVilla.mockResolvedValue(success({ id: 4 }));
  inventarioService.updateVilla.mockResolvedValue(success({ id: 3, estado: 'inactivo' }));
  const page = await renderModal();

  act(() => {
    Simulate.change(page.field('#villa-2'), { target: { value: 'Villa 2' } });
  });
  await act(async () => {
    Simulate.submit(page.field('#villa-2').closest('form'));
  });
  await flushPromises();
  expect(inventarioService.createVilla).toHaveBeenCalledWith(2, { identificador: 'Villa 2' });

  const exactButton = (text) =>
    Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === text
    );
  await act(async () => exactButton('Desactivar').click());
  const confirmButton = Array.from(document.body.querySelectorAll('button'))
    .filter((button) => button.textContent.trim() === 'Desactivar')
    .at(-1);
  await act(async () => confirmButton.click());
  await flushPromises();
  expect(inventarioService.updateVilla).toHaveBeenCalledWith(3, { estado: 'inactivo' });
  page.unmount();
});

test('edita el nombre de una Manzana', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.updateManzana.mockResolvedValue(success({ id: 2, nombre: 'Etapa Norte' }));
  const page = await renderModal();

  await act(async () => page.button('Editar Manzana').click());
  act(() => {
    Simulate.change(page.field('#urbanizacion-edit-value'), {
      target: { value: 'Etapa Norte' },
    });
  });
  await act(async () => {
    Simulate.submit(page.field('#urbanizacion-edit-value').closest('form'));
  });
  await flushPromises();
  expect(inventarioService.updateManzana).toHaveBeenCalledWith(2, { nombre: 'Etapa Norte' });
  page.unmount();
});

test('reactiva Manzana y Villa mediante confirmación visible', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'inactivo' }])
  );
  inventarioService.getVillas.mockResolvedValue(
    success([{ id: 3, identificador: 'Villa 1', estado: 'inactivo' }])
  );
  inventarioService.updateManzana.mockResolvedValue(success({ id: 2, estado: 'activo' }));
  inventarioService.updateVilla.mockResolvedValue(success({ id: 3, estado: 'activo' }));
  const page = await renderModal();

  await act(async () => page.button('Reactivar Manzana').click());
  let confirmButton = Array.from(document.body.querySelectorAll('button'))
    .filter((button) => button.textContent.trim() === 'Reactivar')
    .at(-1);
  await act(async () => confirmButton.click());
  await flushPromises();
  expect(inventarioService.updateManzana).toHaveBeenCalledWith(2, { estado: 'activo' });

  const villaReactivate = Array.from(document.body.querySelectorAll('button')).find(
    (button) => button.textContent.trim() === 'Reactivar'
  );
  await act(async () => villaReactivate.click());
  confirmButton = Array.from(document.body.querySelectorAll('button'))
    .filter((button) => button.textContent.trim() === 'Reactivar')
    .at(-1);
  await act(async () => confirmButton.click());
  await flushPromises();
  expect(inventarioService.updateVilla).toHaveBeenCalledWith(3, { estado: 'activo' });
  page.unmount();
});

test('presenta error de carga con reintento accesible', async () => {
  inventarioService.getManzanas.mockResolvedValueOnce({ success: false, message: 'Sin conexión' });
  const page = await renderModal();
  expect(page.field('[role="alert"]').textContent).toContain('Sin conexión');
  expect(page.button('Reintentar')).not.toBeUndefined();
  page.unmount();
});

test('muestra Villa sin Residente y crea el principal', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.getVillas.mockResolvedValue(
    success([{ id: 3, identificador: 'Villa 1', estado: 'activo' }])
  );
  inventarioService.createResidentePrincipal.mockResolvedValue(success({ id: 8 }));
  const page = await renderModal();
  expect(page.text()).toContain('Sin Residente principal');
  await act(async () => page.button('Crear Residente').click());
  act(() => {
    Simulate.change(page.field('#residente-nombre'), { target: { value: 'Ana Pérez' } });
    Simulate.change(page.field('#residente-contacto'), { target: { value: '099123' } });
  });
  await act(async () => Simulate.submit(page.field('#residente-nombre').closest('form')));
  await flushPromises();
  expect(inventarioService.createResidentePrincipal).toHaveBeenCalledWith(3, {
    nombre: 'Ana Pérez',
    contacto: '099123',
  });
  page.unmount();
});

test('edita y reemplaza Residente principal con confirmación', async () => {
  const resident = { id: 8, nombre: 'Ana', contacto: '099', activo: true };
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.getVillas.mockResolvedValue(
    success([{ id: 3, identificador: 'Villa 1', estado: 'activo' }])
  );
  inventarioService.getResidentePrincipal.mockResolvedValue(success(resident));
  inventarioService.updateResidentePrincipal.mockResolvedValue(success(resident));
  inventarioService.createResidentePrincipal.mockResolvedValue(success({ id: 9 }));
  const page = await renderModal();

  await act(async () => page.button('Editar Residente').click());
  act(() => {
    Simulate.change(page.field('#residente-contacto'), { target: { value: '098' } });
  });
  await act(async () => Simulate.submit(page.field('#residente-nombre').closest('form')));
  await flushPromises();
  expect(inventarioService.updateResidentePrincipal).toHaveBeenCalledWith(8, {
    nombre: 'Ana',
    contacto: '098',
  });

  await act(async () => page.button('Reemplazar Residente').click());
  const continueButton = Array.from(document.body.querySelectorAll('button')).find(
    (button) => button.textContent.trim() === 'Continuar'
  );
  await act(async () => continueButton.click());
  act(() => {
    Simulate.change(page.field('#residente-nombre'), { target: { value: 'Luis' } });
    Simulate.change(page.field('#residente-contacto'), { target: { value: '097' } });
  });
  await act(async () => Simulate.submit(page.field('#residente-nombre').closest('form')));
  await flushPromises();
  expect(inventarioService.createResidentePrincipal).toHaveBeenCalledWith(3, {
    nombre: 'Luis',
    contacto: '097',
    reemplazar: true,
  });
  page.unmount();
});

test('desactiva y reactiva Residente principal mostrando estado', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.getVillas.mockResolvedValue(
    success([{ id: 3, identificador: 'Villa 1', estado: 'activo' }])
  );
  inventarioService.getResidentePrincipal.mockResolvedValue(
    success({ id: 8, nombre: 'Ana', contacto: '099', activo: true })
  );
  inventarioService.updateResidentePrincipal.mockResolvedValue(success({ id: 8, activo: false }));
  const activePage = await renderModal();
  await act(async () => activePage.button('Desactivar Residente').click());
  let confirm = Array.from(document.body.querySelectorAll('button'))
    .filter((button) => button.textContent.trim() === 'Desactivar')
    .at(-1);
  await act(async () => confirm.click());
  await flushPromises();
  expect(inventarioService.updateResidentePrincipal).toHaveBeenCalledWith(8, { activo: false });
  activePage.unmount();

  jest.clearAllMocks();
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.getVillas.mockResolvedValue(
    success([{ id: 3, identificador: 'Villa 1', estado: 'activo' }])
  );
  inventarioService.getResidentePrincipal.mockResolvedValue(
    success({ id: 8, nombre: 'Ana', contacto: '099', activo: false })
  );
  inventarioService.updateResidentePrincipal.mockResolvedValue(success({ id: 8, activo: true }));
  const inactivePage = await renderModal();
  expect(inactivePage.text()).toContain('inactivo');
  await act(async () => inactivePage.button('Reactivar Residente').click());
  confirm = Array.from(document.body.querySelectorAll('button'))
    .filter((button) => button.textContent.trim() === 'Reactivar')
    .at(-1);
  await act(async () => confirm.click());
  await flushPromises();
  expect(inventarioService.updateResidentePrincipal).toHaveBeenCalledWith(8, { activo: true });
  inactivePage.unmount();
});
