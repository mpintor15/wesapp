import React from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { act, flushPromises } from '../../../testUtils/renderHook';
import inventarioService from '../../../services/inventarioService';
import UrbanizacionMastersModal from './UrbanizacionMastersModal';

const mockShowToast = jest.fn();

jest.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('../../../services/inventarioService', () => ({
  __esModule: true,
  default: {
    getManzanas: jest.fn(),
    createManzana: jest.fn(),
    updateManzana: jest.fn(),
    deleteManzana: jest.fn(),
    getVillas: jest.fn(),
    createVilla: jest.fn(),
    updateVilla: jest.fn(),
    deleteVilla: jest.fn(),
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

  const exactVillaButton = (text) =>
    Array.from(document.body.querySelectorAll('.urbanizacion-villa-heading button')).find(
      (button) => button.textContent.trim() === text
    );
  await act(async () => exactVillaButton('Desactivar').click());
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

  const exactActionButton = (selector, text) =>
    Array.from(document.body.querySelectorAll(selector)).find(
      (button) => button.textContent.trim() === text
    );
  await act(async () =>
    exactActionButton('.urbanizacion-manzana-header button', 'Reactivar').click()
  );
  let confirmButton = Array.from(document.body.querySelectorAll('button'))
    .filter((button) => button.textContent.trim() === 'Reactivar')
    .at(-1);
  await act(async () => confirmButton.click());
  await flushPromises();
  expect(inventarioService.updateManzana).toHaveBeenCalledWith(2, { estado: 'activo' });

  const villaReactivate = exactActionButton('.urbanizacion-villa-heading button', 'Reactivar');
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
    Simulate.change(page.field('#residente-nombre-3'), { target: { value: 'Ana Pérez' } });
    Simulate.change(page.field('#residente-contacto-3'), { target: { value: '0991234567' } });
  });
  await act(async () => Simulate.submit(page.field('#residente-nombre-3').closest('form')));
  await flushPromises();
  expect(inventarioService.createResidentePrincipal).toHaveBeenCalledWith(3, {
    nombre: 'Ana Pérez',
    contacto: '0991234567',
  });
  page.unmount();
});

test('abre el formulario inline únicamente debajo de la Villa seleccionada y permite cancelarlo', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.getVillas.mockResolvedValue(
    success([
      { id: 3, identificador: 'Villa 1', estado: 'activo' },
      { id: 4, identificador: 'Villa 2', estado: 'activo' },
    ])
  );
  const page = await renderModal();
  const villaCards = page.container.querySelectorAll('.urbanizacion-villa-card');

  const createResident = Array.from(villaCards[1].querySelectorAll('button')).find(
    (button) => button.textContent.trim() === 'Crear Residente'
  );
  await act(async () => createResident.click());

  expect(villaCards[0].querySelector('.urbanizacion-resident-form')).toBeNull();
  expect(villaCards[1].querySelector('.urbanizacion-resident-form')).not.toBeNull();
  expect(
    page.container.querySelector('.urbanizacion-masters > .urbanizacion-resident-form')
  ).toBeNull();
  await act(async () =>
    villaCards[1].querySelector('.urbanizacion-resident-form .btn-secondary').click()
  );
  expect(villaCards[1].querySelector('.urbanizacion-resident-form')).toBeNull();
  page.unmount();
});

test.each([
  '09123',
  '0812345678',
  '+593991234567',
  '099-123-4567',
  '09912345678',
  '09abcdefgh',
  '099 123 4567',
])('no envía un contacto inválido desde el frontend: %s', async (contacto) => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.getVillas.mockResolvedValue(
    success([{ id: 3, identificador: 'Villa 1', estado: 'activo' }])
  );
  const page = await renderModal();
  await act(async () => page.button('Crear Residente').click());
  act(() => {
    Simulate.change(page.field('#residente-nombre-3'), { target: { value: 'Ana' } });
    Simulate.change(page.field('#residente-contacto-3'), { target: { value: contacto } });
  });
  await act(async () => Simulate.submit(page.field('#residente-nombre-3').closest('form')));
  expect(inventarioService.createResidentePrincipal).not.toHaveBeenCalled();
  expect(page.text()).toContain('El contacto');
  page.unmount();
});

test('edita y reemplaza Residente principal con confirmación', async () => {
  const resident = { id: 8, nombre: 'Ana', contacto: '0991234567', activo: true };
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
    Simulate.change(page.field('#residente-contacto-3'), { target: { value: '0981234567' } });
  });
  await act(async () => Simulate.submit(page.field('#residente-nombre-3').closest('form')));
  await flushPromises();
  expect(inventarioService.updateResidentePrincipal).toHaveBeenCalledWith(8, {
    nombre: 'Ana',
    contacto: '0981234567',
  });

  await act(async () => page.button('Reemplazar Residente').click());
  const continueButton = Array.from(document.body.querySelectorAll('button')).find(
    (button) => button.textContent.trim() === 'Continuar'
  );
  await act(async () => continueButton.click());
  act(() => {
    Simulate.change(page.field('#residente-nombre-3'), { target: { value: 'Luis' } });
    Simulate.change(page.field('#residente-contacto-3'), { target: { value: '0971234567' } });
  });
  await act(async () => Simulate.submit(page.field('#residente-nombre-3').closest('form')));
  await flushPromises();
  expect(inventarioService.createResidentePrincipal).toHaveBeenCalledWith(3, {
    nombre: 'Luis',
    contacto: '0971234567',
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
    success({ id: 8, nombre: 'Ana', contacto: '0991234567', activo: true })
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
    success({ id: 8, nombre: 'Ana', contacto: '0991234567', activo: false })
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

test('confirma y elimina una Manzana, luego refresca la interfaz', async () => {
  inventarioService.getManzanas
    .mockResolvedValueOnce(success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }]))
    .mockResolvedValueOnce(success([]));
  inventarioService.deleteManzana.mockResolvedValue(success({ id: 2 }));
  const page = await renderModal();

  await act(async () => page.field('[aria-label="Eliminar Manzana Etapa A"]').click());
  expect(page.text()).toContain('¿Eliminar esta Manzana? Esta acción no se puede deshacer.');
  const confirm = document.body.querySelector('.confirm-actions .btn-danger');
  await act(async () => confirm.click());
  await flushPromises();

  expect(inventarioService.deleteManzana).toHaveBeenCalledWith(2);
  expect(inventarioService.getManzanas).toHaveBeenCalledTimes(2);
  expect(page.text()).toContain('todavía no tiene Manzanas');
  page.unmount();
});

test('cancela la eliminación de Manzana y conserva la entidad', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  const page = await renderModal();

  await act(async () => page.field('[aria-label="Eliminar Manzana Etapa A"]').click());
  await act(async () => page.button('Cancelar').click());

  expect(inventarioService.deleteManzana).not.toHaveBeenCalled();
  expect(page.text()).toContain('Etapa A');
  page.unmount();
});

test('muestra el 409 de Manzana sin cerrar el modal ni perder el estado', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.deleteManzana.mockResolvedValue({
    success: false,
    status: 409,
    message: 'No se puede eliminar la Manzana porque tiene Villas registradas.',
  });
  const page = await renderModal();

  await act(async () => page.field('[aria-label="Eliminar Manzana Etapa A"]').click());
  await act(async () => document.body.querySelector('.confirm-actions .btn-danger').click());
  await flushPromises();

  expect(page.field('[role="dialog"]')).not.toBeNull();
  expect(mockShowToast).toHaveBeenCalledWith(
    'No se puede eliminar la Manzana porque tiene Villas registradas.',
    'error'
  );
  expect(page.text()).not.toContain('tiene Villas registradas');
  expect(page.text()).toContain('Etapa A');
  page.unmount();
});

test('elimina la última Villa y actualiza contador y estado vacío', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.getVillas
    .mockResolvedValueOnce(success([{ id: 3, identificador: 'Villa 1', estado: 'activo' }]))
    .mockResolvedValueOnce(success([]));
  inventarioService.deleteVilla.mockResolvedValue(success({ id: 3 }));
  const page = await renderModal();

  await act(async () => page.field('[aria-label="Eliminar Villa Villa 1"]').click());
  expect(page.text()).toContain('¿Eliminar esta Villa? Esta acción no se puede deshacer.');
  await act(async () => document.body.querySelector('.confirm-actions .btn-danger').click());
  await flushPromises();

  expect(inventarioService.deleteVilla).toHaveBeenCalledWith(3);
  expect(page.text()).toContain('0 Villas');
  expect(page.text()).toContain('Sin Villas registradas.');
  page.unmount();
});

test('cancela y maneja el 409 de eliminación de Villa', async () => {
  inventarioService.getManzanas.mockResolvedValue(
    success([{ id: 2, nombre: 'Etapa A', estado: 'activo' }])
  );
  inventarioService.getVillas.mockResolvedValue(
    success([{ id: 3, identificador: 'Villa 1', estado: 'activo' }])
  );
  const page = await renderModal();

  await act(async () => page.field('[aria-label="Eliminar Villa Villa 1"]').click());
  await act(async () => page.button('Cancelar').click());
  expect(inventarioService.deleteVilla).not.toHaveBeenCalled();

  inventarioService.deleteVilla.mockResolvedValue({
    success: false,
    status: 409,
    message: 'No se puede eliminar la Villa porque tiene Residentes registrados.',
  });
  await act(async () => page.field('[aria-label="Eliminar Villa Villa 1"]').click());
  await act(async () => document.body.querySelector('.confirm-actions .btn-danger').click());
  await flushPromises();

  expect(mockShowToast).toHaveBeenCalledWith(
    'No se puede eliminar la Villa porque tiene Residentes registrados.',
    'error'
  );
  expect(page.text()).not.toContain('tiene Residentes registrados');
  expect(page.text()).toContain('Villa 1');
  page.unmount();
});
