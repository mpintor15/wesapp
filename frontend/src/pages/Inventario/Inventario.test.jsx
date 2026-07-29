import React from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { act, flushPromises } from '../../testUtils/renderHook';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import clientesService from '../../services/clientesService';
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

jest.mock('../../services/clientesService', () => ({
  __esModule: true,
  default: {
    listClientes: jest.fn(),
    listOpcionesUbicaciones: jest.fn(),
  },
}));

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
    clientesService.listOpcionesUbicaciones.mockResolvedValue(
      success([{ id: 10, nombre: 'ACME', estado: 'activo' }])
    );
    inventarioService.getUbicaciones.mockResolvedValue(
      success([{ id: 1, nombre: 'Bodega', cliente_id: 10, cliente_nombre: 'ACME' }])
    );
    inventarioService.getArticulos.mockResolvedValue(success([]));
    inventarioService.getMovimientos.mockResolvedValue(success([]));
    inventarioService.getBajasArticulos.mockResolvedValue(success([]));
  });

  test('supervisor carga inventario con opciones limitadas de clientes', async () => {
    useAuth.mockReturnValue({
      user: { id: 2, usuario: 'supervisor', tipo_usuario: 'supervisor' },
    });

    const page = await renderPage();

    expect(clientesService.listOpcionesUbicaciones).toHaveBeenCalledTimes(1);
    expect(clientesService.listClientes).not.toHaveBeenCalled();

    await page.click(page.button('Crear artículo'));

    expect(page.query('#art-cliente').textContent).toContain('ACME');

    page.unmount();
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
    page.change('#art-cliente', '10');

    await page.click(page.button('+ Nueva ubicación'));
    expect(page.text()).toContain('Se creará como parte del artículo.');
    page.change('#quick-ubicacion-nombre', '  Patio  ');
    await page.submitClosestForm('#quick-ubicacion-nombre');

    expect(inventarioService.createUbicacion).toHaveBeenCalledWith({
      nombre: 'Patio',
      cliente_id: 10,
    });
    expect(inventarioService.getUbicaciones).toHaveBeenCalledTimes(1);
    expect(page.query('#art-ubicacion').value).toBe('2');
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
    page.change('#art-cliente', '10');
    await page.click(page.button('+ Nueva ubicación'));
    page.change('#quick-ubicacion-nombre', 'Bodega');
    await page.submitClosestForm('#quick-ubicacion-nombre');

    expect(page.text()).toContain('Ya existe una ubicación con ese nombre');
    expect(page.query('#quick-ubicacion-nombre')).not.toBeNull();
    expect(page.query('#art-ubicacion').value).toBe('');

    page.unmount();
  });

  test('no muestra creación rápida si solo puede usar ubicaciones existentes', async () => {
    useAuth.mockReturnValue({
      user: { id: 3, usuario: 'operador', tipo_usuario: 'custom', permisos: ['articulos.create'] },
    });
    const page = await renderPage();

    await page.click(page.button('Crear artículo'));
    page.change('#art-cliente', '10');

    expect(page.button('+ Nueva ubicación')).toBeFalsy();
    expect(page.text()).toContain(
      'Puedes seleccionar una ubicación existente, pero no crear una nueva desde este formulario.'
    );
    expect(page.query('#art-ubicacion')).not.toBeNull();

    page.unmount();
  });

  test('muestra creación rápida con permiso nuevo de ubicaciones aunque no use legacy', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 4,
        usuario: 'operador',
        tipo_usuario: 'custom',
        permisos: ['articulos.create', 'inventario.ubicaciones.crear'],
      },
    });
    const page = await renderPage();

    await page.click(page.button('Crear artículo'));
    page.change('#art-cliente', '10');

    expect(page.button('+ Nueva ubicación')).toBeTruthy();

    page.unmount();
  });

  test('edita artículo histórico sin perder su ubicación sin cliente', async () => {
    inventarioService.getUbicaciones.mockResolvedValue(
      success([{ id: 7, nombre: 'Bodega histórica', cliente_id: null, cliente_nombre: null }])
    );
    inventarioService.getArticulos.mockResolvedValue(
      success([
        {
          id: 99,
          tipo_articulo: 'equipo',
          nombre_articulo: 'Chaleco histórico',
          cantidad: 1,
          ubicacion_id: 7,
          ubicacion_nombre: 'Bodega histórica',
          cliente_id: null,
        },
      ])
    );
    const page = await renderPage();

    await page.click(page.container.querySelector('button[title="Editar artículo"]'));

    expect(page.query('#art-ubicacion').value).toBe('7');
    expect(page.text()).toContain('Esta ubicación histórica todavía no tiene cliente asignado.');

    page.unmount();
  });

  test('secretario conserva carga de ubicaciones de inventario durante transición', async () => {
    useAuth.mockReturnValue({
      user: { id: 2, usuario: 'secretario', tipo_usuario: 'secretario' },
    });

    const page = await renderPage();

    expect(inventarioService.getUbicaciones).toHaveBeenCalledTimes(1);
    expect(page.text()).toContain('Inventario');
    expect(page.button('Crear artículo')).toBeFalsy();

    page.unmount();
  });

  test('permiso operativo de artículos conserva carga del catálogo sin acceso administrativo', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 5,
        usuario: 'articulos-view',
        tipo_usuario: 'custom',
        permisos: ['inventario.articulos.ver'],
      },
    });

    const page = await renderPage();

    expect(inventarioService.getUbicaciones).toHaveBeenCalledTimes(1);
    expect(page.text()).toContain('Inventario');
    expect(page.button('Crear artículo')).toBeFalsy();

    page.unmount();
  });

  test('movimientos con permiso operativo sin ubicaciones.crear usa solo selector existente', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 6,
        usuario: 'movimientos-create',
        tipo_usuario: 'custom',
        permisos: ['inventario.movimientos.crear'],
      },
    });
    const page = await renderPage();

    await page.click(page.button('Movimientos'));
    await page.click(page.button('Crear nuevo movimiento'));
    page.change('#mov-cliente-destino', '10');

    expect(page.query('#mov-destino').tagName).toBe('SELECT');
    expect(page.query('#mov-destino').getAttribute('name')).toBe('ubicacion_destino_id');
    expect(page.text()).toContain(
      'Puedes trasladar a una ubicación existente, pero no crear una nueva desde este formulario.'
    );

    page.unmount();
  });

  test('movimientos con ubicaciones.crear permite destino nuevo por nombre', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 7,
        usuario: 'movimientos-create-location',
        tipo_usuario: 'custom',
        permisos: ['inventario.movimientos.crear', 'inventario.ubicaciones.crear'],
      },
    });
    const page = await renderPage();

    await page.click(page.button('Movimientos'));
    await page.click(page.button('Crear nuevo movimiento'));
    page.change('#mov-cliente-destino', '10');

    expect(page.query('#mov-destino').tagName).toBe('INPUT');
    expect(page.query('#mov-destino').getAttribute('name')).toBe('ubicacion_destino_nombre');
    expect(page.text()).toContain(
      'Si no existe para el cliente seleccionado, se creará una nueva ubicación.'
    );

    page.unmount();
  });
});
