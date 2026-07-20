import React from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { act, flushPromises } from '../../testUtils/renderHook';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import inventarioService from '../../services/inventarioService';
import Inventario from './Inventario';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../context/ToastContext', () => ({
  useToast: jest.fn(),
}));

jest.mock('../../hooks/useScrollToTopOnMount', () => jest.fn());

jest.mock('../../services/inventarioService', () => ({
  __esModule: true,
  default: {
    getUbicaciones: jest.fn(),
    createUbicacion: jest.fn(),
    getArticulos: jest.fn(),
    createArticulo: jest.fn(),
    updateArticulo: jest.fn(),
    deleteArticulo: jest.fn(),
    getMovimientos: jest.fn(),
    getBajasArticulos: jest.fn(),
    darBajaArticulo: jest.fn(),
    downloadMovimientoPdf: jest.fn(),
    regenerateMovimientoPdf: jest.fn(),
    exportArticulosExcel: jest.fn(),
    exportBajasArticulosExcel: jest.fn(),
    exportMovimientosExcel: jest.fn(),
  },
}));

const success = (data = []) => ({ success: true, data });

const renderPage = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Inventario />);
    await flushPromises();
  });

  const query = (selector) => container.querySelector(selector);
  const button = (text) =>
    Array.from(container.querySelectorAll('button')).find((item) =>
      item.textContent.includes(text)
    );

  return {
    container,
    query,
    button,
    text: () => container.textContent,
    change: (selector, value) => {
      act(() => {
        Simulate.change(query(selector), { target: { name: query(selector).name, value } });
      });
    },
    click: async (element) => {
      await act(async () => {
        element.click();
        await flushPromises();
      });
    },
    submitClosestForm: async (selector) => {
      await act(async () => {
        Simulate.submit(query(selector).closest('form'));
        await flushPromises();
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('Inventario ubicación inline en formulario de artículos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: 1, usuario: 'gerente', tipo_usuario: 'gerente' },
    });
    useToast.mockReturnValue({ showToast: jest.fn() });
    inventarioService.getUbicaciones.mockResolvedValue(success([{ id: 1, nombre: 'Bodega' }]));
    inventarioService.getArticulos.mockResolvedValue(success([]));
    inventarioService.getMovimientos.mockResolvedValue(success([]));
    inventarioService.getBajasArticulos.mockResolvedValue(success([]));
  });

  test('crea una ubicación desde el formulario y conserva los datos del artículo', async () => {
    inventarioService.createUbicacion.mockResolvedValue(
      success({ id: 2, nombre: 'Patio', articulos_activos: 0, articulos_totales: 0 })
    );
    const page = await renderPage();

    await page.click(page.button('Crear artículo'));
    page.change('#art-tipo', 'equipo');
    page.change('#art-nombre', 'Chaleco');
    page.change('#art-cantidad', '3');

    await page.click(page.button('+ Nueva ubicación'));
    page.change('#quick-ubicacion-nombre', '  Patio  ');
    await page.submitClosestForm('#quick-ubicacion-nombre');

    expect(inventarioService.createUbicacion).toHaveBeenCalledWith({ nombre: 'Patio' });
    expect(inventarioService.getUbicaciones).toHaveBeenCalledTimes(1);
    expect(page.query('#art-ubicacion').value).toBe('Patio');
    expect(page.query('#art-nombre').value).toBe('Chaleco');
    expect(page.query('#art-cantidad').value).toBe('3');

    page.unmount();
  });

  test('muestra error de duplicado al crear ubicación y mantiene abierto el formulario', async () => {
    inventarioService.createUbicacion.mockResolvedValue({
      success: false,
      status: 409,
      message: 'Ya existe una ubicación con ese nombre',
    });
    const page = await renderPage();

    await page.click(page.button('Crear artículo'));
    await page.click(page.button('+ Nueva ubicación'));
    page.change('#quick-ubicacion-nombre', 'Bodega');
    await page.submitClosestForm('#quick-ubicacion-nombre');

    expect(page.text()).toContain('Ya existe una ubicación con ese nombre');
    expect(page.query('#quick-ubicacion-nombre')).not.toBeNull();
    expect(page.query('#art-ubicacion').value).toBe('');

    page.unmount();
  });
});
