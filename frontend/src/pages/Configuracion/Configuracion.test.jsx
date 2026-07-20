import React from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { act, flushPromises } from '../../testUtils/renderHook';
import Configuracion from './Configuracion';
import inventarioService from '../../services/inventarioService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 1, usuario: 'gerente', tipo_usuario: 'gerente' },
  })),
}));

jest.mock('../../context/ToastContext', () => ({
  useToast: jest.fn(() => ({ showToast: jest.fn() })),
}));

jest.mock('../../hooks/useScrollToTopOnMount', () => jest.fn());

jest.mock('../../services/inventarioService', () => ({
  __esModule: true,
  default: {
    getUbicaciones: jest.fn(),
    createUbicacion: jest.fn(),
    updateUbicacion: jest.fn(),
    deleteUbicacion: jest.fn(),
  },
}));

const ubicaciones = [
  { id: 1, nombre: 'Bodega Central', articulos_activos: 2, articulos_totales: 3 },
  { id: 2, nombre: 'Archivo', articulos_activos: 0, articulos_totales: 0 },
];

const success = (data) => ({ success: true, data });

const renderPage = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Configuracion />);
    await flushPromises();
  });

  return {
    container,
    buttons: () => Array.from(container.querySelectorAll('button')),
    button: (text) =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent.includes(text)
      ),
    input: () => container.querySelector('#ubicacion-nombre'),
    text: () => container.textContent,
    changeInput: (value) => {
      act(() => {
        Simulate.change(container.querySelector('#ubicacion-nombre'), {
          target: { value },
        });
      });
    },
    submitForm: async () => {
      await act(async () => {
        Simulate.submit(container.querySelector('form'));
        await flushPromises();
      });
    },
    click: async (element) => {
      await act(async () => {
        element.click();
        await flushPromises();
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('Configuracion ubicaciones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: 1, usuario: 'gerente', tipo_usuario: 'gerente' },
    });
    useToast.mockReturnValue({ showToast: jest.fn() });
    inventarioService.getUbicaciones.mockResolvedValue(success(ubicaciones));
  });

  test('renderiza lista, cantidades y estado de carga inicial', async () => {
    let resolveLoad;
    inventarioService.getUbicaciones.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoad = resolve;
      })
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<Configuracion />);
    });

    expect(container.textContent).toContain('Cargando ubicaciones');

    await act(async () => {
      resolveLoad(success(ubicaciones));
      await flushPromises();
    });

    expect(container.textContent).toContain('Bodega Central');
    expect(container.textContent).toContain('Archivo');
    expect(container.textContent).toContain('Artículos activos');
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('3');

    act(() => root.unmount());
    container.remove();
  });

  test('crea una ubicación y actualiza la tabla localmente', async () => {
    inventarioService.createUbicacion.mockResolvedValue({
      success: true,
      data: { id: 3, nombre: 'Patio', articulos_activos: 0, articulos_totales: 0 },
    });
    const page = await renderPage();

    await page.click(page.button('Crear ubicación'));
    page.changeInput('  Patio  ');
    await page.submitForm();

    expect(inventarioService.createUbicacion).toHaveBeenCalledWith({ nombre: 'Patio' });
    expect(page.text()).toContain('Patio');

    page.unmount();
  });

  test('edita una ubicación existente', async () => {
    inventarioService.updateUbicacion.mockResolvedValue({
      success: true,
      data: { id: 2, nombre: 'Archivo General', articulos_activos: 0, articulos_totales: 0 },
    });
    const page = await renderPage();
    const editButtons = page.buttons().filter((button) => button.title === 'Editar ubicación');

    await page.click(editButtons[1]);
    page.changeInput('Archivo General');
    await page.submitForm();

    expect(inventarioService.updateUbicacion).toHaveBeenCalledWith(2, {
      nombre: 'Archivo General',
    });
    expect(page.text()).toContain('Archivo General');

    page.unmount();
  });

  test('elimina una ubicación sin uso tras confirmar', async () => {
    inventarioService.deleteUbicacion.mockResolvedValue({ success: true });
    const page = await renderPage();

    await page.click(page.buttons().find((button) => button.title === 'Eliminar ubicación'));
    expect(page.text()).toContain('¿Eliminar la ubicación "Archivo"?');
    await page.click(page.button('Eliminar ubicación'));

    expect(inventarioService.deleteUbicacion).toHaveBeenCalledWith(2);
    expect(page.text()).not.toContain('Archivo');

    page.unmount();
  });

  test('muestra conflicto 409 del backend en el formulario', async () => {
    inventarioService.createUbicacion.mockResolvedValue({
      success: false,
      status: 409,
      message: 'Ya existe una ubicación con ese nombre',
    });
    const page = await renderPage();

    await page.click(page.button('Crear ubicación'));
    page.changeInput('Bodega Central');
    await page.submitForm();

    expect(page.text()).toContain('Ya existe una ubicación con ese nombre');
    expect(page.text()).toContain('Crear ubicación');

    page.unmount();
  });

  test('bloquea visualmente eliminación con artículos asociados', async () => {
    const page = await renderPage();

    expect(page.text()).toContain('Bloqueada');
    expect(page.buttons().filter((button) => button.title === 'Eliminar ubicación')).toHaveLength(
      1
    );

    page.unmount();
  });

  test('muestra error de carga y permite reintentar', async () => {
    inventarioService.getUbicaciones
      .mockResolvedValueOnce({ success: false, message: 'API caída' })
      .mockResolvedValueOnce(success(ubicaciones));
    const page = await renderPage();

    expect(page.text()).toContain('API caída');
    await page.click(page.button('Reintentar'));

    expect(inventarioService.getUbicaciones).toHaveBeenCalledTimes(2);
    expect(page.text()).toContain('Bodega Central');

    page.unmount();
  });
});
