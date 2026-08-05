import React from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { act, flushPromises } from '../../testUtils/renderHook';
import Configuracion from './Configuracion';
import clientesService from '../../services/clientesService';
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

jest.mock('../../services/clientesService', () => ({
  __esModule: true,
  default: {
    listClientes: jest.fn(),
    listOpcionesUbicaciones: jest.fn(),
    createCliente: jest.fn(),
    updateCliente: jest.fn(),
    deleteCliente: jest.fn(),
  },
}));

const ubicaciones = [
  {
    id: 1,
    nombre: 'Bodega Central',
    cliente_id: 1,
    cliente_nombre: 'ACME Seguridad',
    cliente_estado: 'activo',
    articulos_activos: 2,
    articulos_totales: 3,
  },
  {
    id: 2,
    nombre: 'Archivo',
    cliente_id: 1,
    cliente_nombre: 'ACME Seguridad',
    cliente_estado: 'activo',
    articulos_activos: 0,
    articulos_totales: 0,
  },
  {
    id: 3,
    nombre: 'Histórica',
    cliente_id: null,
    cliente_nombre: null,
    cliente_estado: null,
    articulos_activos: 0,
    articulos_totales: 0,
  },
];

const buildUbicacionesForClientes = (clientesList) =>
  clientesList
    .filter((cliente) => Number(cliente.ubicaciones_totales) > 0)
    .map((cliente) => ({
      id: 1000 + cliente.id,
      nombre: `Ubicación ${cliente.nombre}`,
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre,
      articulos_activos: 0,
      articulos_totales: 0,
    }));

const clientes = [
  {
    id: 1,
    nombre: 'ACME Seguridad',
    identificacion: '099001',
    tipo_identificacion: 'RUC',
    telefono: '0999999999',
    correo: 'ops@acme.com',
    direccion: 'Av. Principal',
    ciudad: 'Quito',
    estado: 'activo',
    ubicaciones_totales: 2,
  },
  {
    id: 2,
    nombre: 'Cliente Inactivo',
    identificacion: '099002',
    telefono: '',
    correo: '',
    ciudad: 'Guayaquil',
    estado: 'inactivo',
    ubicaciones_totales: 0,
  },
  {
    id: 3,
    nombre: 'Beta Protección',
    identificacion: '099003',
    telefono: '',
    correo: 'beta@example.com',
    ciudad: 'Cuenca',
    estado: 'activo',
    ubicaciones_totales: 1,
  },
];

const success = (data) => ({ success: true, data });
const clientesSuccess = (data = clientes) => ({
  success: true,
  data,
  meta: { total: data.length, activos: 2, inactivos: data.length - 2, filtrados: data.length },
});

const buildClientes = (count) =>
  Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      id: number,
      nombre: `Cliente ${String(number).padStart(2, '0')}`,
      identificacion: `099${String(number).padStart(3, '0')}`,
      telefono: '',
      correo: '',
      ciudad: number % 2 === 0 ? 'Quito' : 'Guayaquil',
      estado: 'activo',
      ubicaciones_totales: number % 2 === 0 ? 1 : 0,
    };
  });

const createDeferred = () => {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

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
    field: (selector) => container.querySelector(selector),
    text: () => container.textContent,
    changeInput: (value) => {
      act(() => {
        Simulate.change(container.querySelector('#ubicacion-nombre'), {
          target: { value },
        });
      });
    },
    changeField: (selector, value) => {
      act(() => {
        Simulate.change(container.querySelector(selector), {
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
    clientesService.listClientes.mockResolvedValue(clientesSuccess());
    clientesService.listOpcionesUbicaciones.mockResolvedValue(
      success(clientes.filter((cliente) => cliente.estado === 'activo'))
    );
  });

  test('muestra Directorio antes que Ubicaciones y Directorio es la pestaña por defecto', async () => {
    const page = await renderPage();
    const tabButtons = Array.from(page.container.querySelectorAll('[role="tab"]')).map(
      (button) => button.textContent
    );

    expect(tabButtons[0]).toContain('Directorio');
    expect(tabButtons[1]).toContain('Ubicaciones');
    expect(page.container.querySelector('[role="tablist"]')).not.toBeNull();
    expect(page.button('Directorio').getAttribute('role')).toBe('tab');
    expect(page.button('Directorio').getAttribute('aria-selected')).toBe('true');
    expect(page.button('Directorio').getAttribute('aria-controls')).toBe(
      'configuracion-panel-clientes'
    );
    expect(page.container.querySelector('#configuracion-panel-clientes').hidden).toBe(false);
    expect(page.container.querySelector('#configuracion-panel-ubicaciones').hidden).toBe(true);
    expect(page.text()).toContain('Clientes');
    expect(page.text()).not.toContain('Catálogos / Directorio');
    expect(page.container.querySelector('.configuracion-tabs .tab-badge').textContent).toContain(
      '3'
    );
    expect(page.button('Crear cliente')).toBeTruthy();
    expect(page.button('Crear ubicación')).toBeFalsy();

    page.unmount();
  });

  test('pestañas soportan navegación por teclado y actualizan paneles', async () => {
    const page = await renderPage();
    const directorioTab = page.button('Directorio');
    const ubicacionesTab = page.button('Ubicaciones');

    await act(async () => {
      Simulate.keyDown(directorioTab, { key: 'ArrowRight' });
      await flushPromises();
    });

    expect(ubicacionesTab.getAttribute('aria-selected')).toBe('true');
    expect(page.container.querySelector('#configuracion-panel-ubicaciones').hidden).toBe(false);
    expect(page.container.querySelector('#configuracion-panel-clientes').hidden).toBe(true);

    await act(async () => {
      Simulate.keyDown(ubicacionesTab, { key: 'Home' });
      await flushPromises();
    });

    expect(directorioTab.getAttribute('aria-selected')).toBe('true');

    page.unmount();
  });

  test('refrescar funciona en Directorio y conserva el patrón de acción', async () => {
    const page = await renderPage();
    const refreshButton = page.container.querySelector('button[aria-label="Actualizar datos"]');

    expect(refreshButton).not.toBeNull();
    expect(refreshButton.className).toContain('btn-icon-only');
    await page.click(refreshButton);

    expect(clientesService.listClientes).toHaveBeenCalledWith({});
    expect(inventarioService.getUbicaciones).not.toHaveBeenCalled();

    page.unmount();
  });

  test('entrar en Directorio carga catálogo completo sin cargar opciones mínimas de Ubicaciones', async () => {
    const page = await renderPage();

    expect(page.text()).toContain('Directorio');
    expect(clientesService.listClientes).toHaveBeenCalledTimes(1);
    expect(clientesService.listClientes).toHaveBeenCalledWith({});
    expect(clientesService.listOpcionesUbicaciones).not.toHaveBeenCalled();
    expect(inventarioService.getUbicaciones).not.toHaveBeenCalled();

    page.unmount();
  });

  test('usuario solo con permiso administrativo de Ubicaciones inicia en esa pestaña sin cargar catálogo completo', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 7,
        usuario: 'inventario',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver'],
      },
    });
    const page = await renderPage();

    expect(page.container.querySelector('.configuracion-tabs .active').textContent).toContain(
      'Ubicaciones'
    );
    expect(page.button('Directorio')).toBeFalsy();
    expect(clientesService.listOpcionesUbicaciones).toHaveBeenCalledTimes(1);
    expect(clientesService.listClientes).not.toHaveBeenCalledWith({});

    page.unmount();
  });

  test('contador abre Directorio sin permisos de inventario ni Ubicaciones', async () => {
    useAuth.mockReturnValue({
      user: { id: 11, usuario: 'contador', tipo_usuario: 'contador' },
    });
    const page = await renderPage();

    expect(page.button('Directorio')).toBeTruthy();
    expect(page.button('Ubicaciones')).toBeFalsy();
    expect(page.container.querySelector('#configuracion-panel-clientes').hidden).toBe(false);
    expect(page.button('Crear cliente')).toBeTruthy();
    expect(
      page.container.querySelector('button[aria-label="Editar cliente ACME Seguridad"]')
    ).not.toBeNull();
    expect(
      page.container.querySelector('button[aria-label="Eliminar cliente ACME Seguridad"]')
    ).not.toBeNull();
    expect(clientesService.listClientes).toHaveBeenCalledWith({});
    expect(clientesService.listOpcionesUbicaciones).not.toHaveBeenCalled();
    expect(inventarioService.getUbicaciones).not.toHaveBeenCalled();

    page.unmount();
  });

  test('usuario solo con permiso de Artículos no ve administración de Ubicaciones', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 70,
        usuario: 'articulos-view',
        tipo_usuario: 'custom',
        permisos: ['inventario.articulos.ver'],
      },
    });
    const page = await renderPage();

    expect(page.text()).toContain('No tienes acceso al módulo de Clientes.');
    expect(page.button('Ubicaciones')).toBeFalsy();
    expect(inventarioService.getUbicaciones).not.toHaveBeenCalled();
    expect(clientesService.listClientes).not.toHaveBeenCalled();
    expect(clientesService.listOpcionesUbicaciones).not.toHaveBeenCalled();

    page.unmount();
  });

  test('usuario con solo permiso nuevo de ver ubicaciones ve la pestaña', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 71,
        usuario: 'ubicaciones-view',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver'],
      },
    });
    const page = await renderPage();

    expect(page.button('Ubicaciones')).toBeTruthy();
    expect(page.button('Directorio')).toBeFalsy();
    expect(clientesService.listOpcionesUbicaciones).toHaveBeenCalledTimes(1);
    expect(inventarioService.getUbicaciones).toHaveBeenCalledWith({});

    page.unmount();
  });

  test('usuario de ubicaciones carga opciones mínimas para selector sin ver acciones de clientes', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 73,
        usuario: 'ubicaciones-edit',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver', 'inventario.ubicaciones.editar'],
      },
    });
    const page = await renderPage();

    expect(page.button('Directorio')).toBeFalsy();
    expect(page.button('Crear cliente')).toBeFalsy();
    expect(
      page.container.querySelector('button[aria-label="Editar cliente ACME Seguridad"]')
    ).toBeNull();
    expect(clientesService.listOpcionesUbicaciones).toHaveBeenCalledTimes(1);
    expect(clientesService.listClientes).not.toHaveBeenCalledWith({});
    expect(page.field('#ubicaciones-cliente')).not.toBeNull();

    page.unmount();
  });

  test('permiso administrativo de crear ubicación muestra acción', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 72,
        usuario: 'ubicaciones-create',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver', 'inventario.ubicaciones.crear'],
      },
    });
    const page = await renderPage();

    expect(page.button('Crear ubicación')).toBeTruthy();
    expect(
      page.container.querySelector('button[aria-label="Editar ubicación Archivo"]')
    ).toBeNull();
    expect(
      page.container.querySelector('button[aria-label="Eliminar ubicación Archivo"]')
    ).toBeNull();

    page.unmount();
  });

  test('permiso legacy de crear artículo no muestra crear ubicación administrativo', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 75,
        usuario: 'articulos-create',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver', 'inventario.articulos.crear'],
      },
    });
    const page = await renderPage();

    expect(page.button('Crear ubicación')).toBeFalsy();

    page.unmount();
  });

  test('permiso administrativo de editar ubicación muestra acción', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 73,
        usuario: 'ubicaciones-edit',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver', 'inventario.ubicaciones.editar'],
      },
    });
    const page = await renderPage();

    expect(page.button('Crear ubicación')).toBeFalsy();
    expect(
      page.container.querySelector('button[aria-label="Editar ubicación Archivo"]')
    ).not.toBeNull();
    expect(
      page.container.querySelector('button[aria-label="Eliminar ubicación Archivo"]')
    ).toBeNull();

    page.unmount();
  });

  test('permiso legacy de editar artículo no muestra editar ubicación administrativo', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 76,
        usuario: 'articulos-edit',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver', 'inventario.articulos.editar'],
      },
    });
    const page = await renderPage();

    expect(
      page.container.querySelector('button[aria-label="Editar ubicación Archivo"]')
    ).toBeNull();

    page.unmount();
  });

  test('permiso administrativo de eliminar ubicación muestra acción', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 74,
        usuario: 'ubicaciones-delete',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver', 'inventario.ubicaciones.eliminar'],
      },
    });
    const page = await renderPage();

    expect(page.button('Crear ubicación')).toBeFalsy();
    expect(
      page.container.querySelector('button[aria-label="Editar ubicación Archivo"]')
    ).toBeNull();
    expect(
      page.container.querySelector('button[aria-label="Eliminar ubicación Archivo"]')
    ).not.toBeNull();

    page.unmount();
  });

  test('permiso legacy de eliminar artículo no muestra eliminar ubicación administrativo', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 77,
        usuario: 'articulos-delete',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver', 'inventario.articulos.eliminar'],
      },
    });
    const page = await renderPage();

    expect(
      page.container.querySelector('button[aria-label="Eliminar ubicación Archivo"]')
    ).toBeNull();

    page.unmount();
  });

  test('cambiar a Ubicaciones carga clientes activos una sola vez y volver no repite cargas', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.button('Directorio'));
    await page.click(page.button('Ubicaciones'));

    expect(clientesService.listOpcionesUbicaciones).toHaveBeenCalledTimes(1);
    expect(clientesService.listClientes).toHaveBeenCalledTimes(1);
    expect(clientesService.listClientes).toHaveBeenCalledWith({});
    expect(inventarioService.getUbicaciones).toHaveBeenCalledTimes(1);

    page.unmount();
  });

  test('refrescar Directorio no recarga clientes activos', async () => {
    const page = await renderPage();

    await page.click(page.container.querySelector('button[aria-label="Actualizar datos"]'));

    expect(clientesService.listClientes).toHaveBeenCalledTimes(2);
    expect(clientesService.listClientes).toHaveBeenCalledWith({});
    expect(clientesService.listOpcionesUbicaciones).not.toHaveBeenCalled();

    page.unmount();
  });

  test('refrescar Ubicaciones recarga ubicaciones y clientes activos sin catálogo completo', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 7,
        usuario: 'inventario',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver'],
      },
    });
    const page = await renderPage();

    await page.click(page.container.querySelector('button[aria-label="Actualizar datos"]'));

    expect(inventarioService.getUbicaciones).toHaveBeenCalledTimes(2);
    expect(clientesService.listOpcionesUbicaciones).toHaveBeenCalledTimes(2);
    expect(clientesService.listClientes).not.toHaveBeenCalledWith({});

    page.unmount();
  });

  test('usuario con solo lectura de clientes ve Directorio sin acciones de escritura', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 8,
        usuario: 'lector',
        tipo_usuario: 'custom',
        permisos: ['clientes.ver'],
      },
    });
    const page = await renderPage();

    expect(page.button('Directorio')).toBeTruthy();
    expect(page.button('Ubicaciones')).toBeFalsy();
    expect(page.button('Crear cliente')).toBeFalsy();
    expect(
      page.container.querySelector('button[aria-label="Editar cliente ACME Seguridad"]')
    ).toBeNull();
    expect(
      page.container.querySelector('button[aria-label="Eliminar cliente ACME Seguridad"]')
    ).toBeNull();

    page.unmount();
  });

  test('permisos granulares controlan crear, editar y eliminar clientes', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 9,
        usuario: 'editor',
        tipo_usuario: 'custom',
        permisos: ['clientes.ver', 'clientes.crear', 'clientes.editar'],
      },
    });
    const page = await renderPage();

    expect(page.button('Crear cliente')).toBeTruthy();
    expect(
      page.container.querySelector('button[aria-label="Editar cliente ACME Seguridad"]')
    ).not.toBeNull();
    expect(
      page.container.querySelector('button[aria-label="Eliminar cliente ACME Seguridad"]')
    ).toBeNull();

    page.unmount();
  });

  test('usuario sin permisos ve acceso restringido y no dispara cargas', async () => {
    useAuth.mockReturnValue({
      user: { id: 10, usuario: 'sin-acceso', tipo_usuario: 'custom', permisos: [] },
    });
    const page = await renderPage();

    expect(page.text()).toContain('No tienes acceso al módulo de Clientes.');
    expect(page.button('Directorio')).toBeFalsy();
    expect(page.button('Ubicaciones')).toBeFalsy();
    expect(clientesService.listClientes).not.toHaveBeenCalled();
    expect(clientesService.listOpcionesUbicaciones).not.toHaveBeenCalled();
    expect(inventarioService.getUbicaciones).not.toHaveBeenCalled();

    page.unmount();
  });

  test('renderiza ubicaciones con tarjetas, badges y bloque de ubicaciones sin cliente', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));

    expect(page.text()).not.toContain('Catálogos / Ubicaciones');
    expect(page.button('Crear ubicación')).toBeTruthy();
    expect(page.text()).toContain('Asignadas');
    expect(page.text()).toContain('Sin cliente');
    expect(page.text()).toContain('Hay 1 ubicación sin cliente asignado');
    expect(page.container.querySelector('.configuracion-client-badge--unassigned')).not.toBeNull();
    expect(page.container.querySelector('.configuracion-client-badge--assigned')).not.toBeNull();
    expect(page.container.querySelector('.configuracion-ubicaciones-filter-row')).not.toBeNull();
    expect(page.container.querySelector('.configuracion-ubicaciones-filter-card')).not.toBeNull();
    expect(
      page.container.querySelector('.configuracion-ubicaciones-filter-card .ff-controls')
    ).not.toBeNull();
    expect(
      page.container.querySelector('.configuracion-ubicaciones-filter-card .ff-search')
    ).not.toBeNull();
    expect(
      page.container.querySelector('.configuracion-ubicaciones-filter-card .ff-state')
    ).not.toBeNull();
    expect(
      Boolean(
        page.container
          .querySelector('.configuracion-ubicaciones-filter-row')
          .compareDocumentPosition(page.container.querySelector('.configuracion-summary')) &
        window.Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    const refreshButton = page.container.querySelector('button[aria-label="Actualizar datos"]');
    await page.click(refreshButton);
    expect(inventarioService.getUbicaciones).toHaveBeenCalled();

    page.unmount();
  });

  test('distingue ubicación sin cliente, con cliente activo y con cliente inactivo', async () => {
    inventarioService.getUbicaciones.mockResolvedValue(
      success([
        {
          id: 1,
          nombre: 'Bodega activa',
          cliente_id: 1,
          cliente_nombre: 'ACME Seguridad',
          cliente_estado: 'activo',
          articulos_activos: 0,
          articulos_totales: 0,
        },
        {
          id: 2,
          nombre: 'Archivo inactivo',
          cliente_id: 2,
          cliente_nombre: 'Cliente Inactivo',
          cliente_estado: 'inactivo',
          articulos_activos: 0,
          articulos_totales: 0,
        },
        {
          id: 3,
          nombre: 'Histórica',
          cliente_id: null,
          cliente_nombre: null,
          cliente_estado: null,
          articulos_activos: 0,
          articulos_totales: 0,
        },
      ])
    );
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));

    expect(page.text()).toContain('ACME Seguridad');
    expect(page.text()).toContain('Cliente Inactivo (inactivo)');
    expect(page.text()).toContain('Sin cliente — dato histórico');
    expect(page.container.querySelector('.configuracion-client-badge--assigned')).not.toBeNull();
    expect(page.container.querySelector('.configuracion-client-badge--inactive')).not.toBeNull();
    expect(page.container.querySelector('.configuracion-client-badge--unassigned')).not.toBeNull();

    page.unmount();
  });

  test('tabla y tarjetas móviles de ubicaciones conservan semántica accesible', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));

    const table = page.container.querySelector('.configuracion-ubicaciones-table');
    const caption = table.querySelector('caption');
    const headers = Array.from(table.querySelectorAll('thead th'));
    const mobileCards = Array.from(
      page.container.querySelectorAll('.configuracion-ubicaciones-mobile-list .record-card')
    );

    expect(caption.textContent).toContain('Listado de ubicaciones');
    expect(headers.map((header) => header.getAttribute('scope'))).toEqual([
      'col',
      'col',
      'col',
      'col',
      'col',
    ]);
    expect(headers.map((header) => header.textContent.trim())).toEqual([
      'Ubicación',
      'Cliente',
      'Artículos activos',
      'Artículos totales',
      'Acciones',
    ]);
    expect(mobileCards).toHaveLength(ubicaciones.length);
    const bodegaCard = mobileCards.find((card) => card.textContent.includes('Bodega Central'));
    const historicaCard = mobileCards.find((card) => card.textContent.includes('Histórica'));

    expect(bodegaCard.textContent).toContain('ACME Seguridad');
    expect(bodegaCard.textContent).toContain('2 activos');
    expect(bodegaCard.textContent).toContain('3 totales');
    expect(bodegaCard.textContent).toContain('En uso');
    expect(historicaCard.textContent).toContain('Sin cliente — dato histórico');

    page.unmount();
  });

  test('estado vacío filtrado se distingue del catálogo sin registros', async () => {
    inventarioService.getUbicaciones.mockResolvedValue(success([]));
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    page.changeField('#ubicaciones-search', 'no existe');
    await page.click(page.button('Aplicar'));

    expect(page.text()).toContain('No se encontraron ubicaciones con los filtros actuales.');
    expect(page.button('Limpiar filtros')).not.toBeNull();

    page.unmount();
  });

  test('formulario de ubicación bloquea cierre y doble envío mientras guarda', async () => {
    const deferred = createDeferred();
    inventarioService.updateUbicacion.mockReturnValueOnce(deferred.promise);
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.container.querySelector('button[aria-label="Editar ubicación Archivo"]'));
    page.changeInput('Archivo procesando');
    await act(async () => {
      Simulate.submit(page.container.querySelector('form'));
      await flushPromises();
    });

    const modal = page.container.querySelector('.configuracion-ubicacion-modal');
    const submitButton = page.button('Guardando...');
    const cancelButton = page.button('Cancelar');
    const closeButton = page.container.querySelector('.app-modal__close');

    expect(modal.getAttribute('aria-describedby')).toBe('ubicacion-modal-description');
    expect(page.container.querySelector('form').getAttribute('aria-busy')).toBe('true');
    expect(submitButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(true);
    expect(closeButton.disabled).toBe(true);

    await act(async () => {
      Simulate.submit(page.container.querySelector('form'));
      await flushPromises();
    });

    expect(inventarioService.updateUbicacion).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({
        success: true,
        data: {
          id: 2,
          nombre: 'Archivo procesando',
          cliente_id: 1,
          cliente_nombre: 'ACME Seguridad',
        },
      });
      await flushPromises();
    });

    page.unmount();
  });

  test('crea una ubicación y reconsulta la tabla con filtros activos', async () => {
    inventarioService.getUbicaciones
      .mockResolvedValueOnce(success(ubicaciones))
      .mockResolvedValueOnce(
        success([
          ...ubicaciones,
          {
            id: 4,
            nombre: 'Patio',
            cliente_id: 1,
            cliente_nombre: 'ACME Seguridad',
            articulos_activos: 0,
            articulos_totales: 0,
          },
        ])
      );
    inventarioService.createUbicacion.mockResolvedValue({
      success: true,
      data: {
        id: 4,
        nombre: 'Patio',
        cliente_id: 1,
        cliente_nombre: 'ACME Seguridad',
        articulos_activos: 0,
        articulos_totales: 0,
      },
    });
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.button('Crear ubicación'));
    page.changeField('#ubicacion-cliente', '1');
    page.changeInput('  Patio  ');
    await page.submitForm();

    expect(inventarioService.createUbicacion).toHaveBeenCalledWith({
      nombre: 'Patio',
      cliente_id: 1,
    });
    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({});
    expect(page.text()).toContain('Patio');

    page.unmount();
  });

  test('crear ubicación fuera del filtro vigente no la inserta visualmente', async () => {
    inventarioService.getUbicaciones.mockImplementation((params = {}) => {
      if (params.cliente_id === '1') {
        return Promise.resolve(
          success(ubicaciones.filter((ubicacion) => ubicacion.cliente_id === 1))
        );
      }
      return Promise.resolve(success(ubicaciones));
    });
    inventarioService.createUbicacion.mockResolvedValue({
      success: true,
      data: {
        id: 5,
        nombre: 'Patio Beta',
        cliente_id: 3,
        cliente_nombre: 'Beta Protección',
      },
    });
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    page.changeField('#ubicaciones-cliente', '1');
    await page.click(page.button('Aplicar'));
    await page.click(page.button('Crear ubicación'));
    page.changeField('#ubicacion-cliente', '3');
    page.changeInput('Patio Beta');
    await page.submitForm();

    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({ cliente_id: '1' });
    expect(
      page.container.querySelector('.configuracion-ubicaciones-table').textContent
    ).not.toContain('Patio Beta');

    page.unmount();
  });

  test('exige cliente al crear ubicación', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.button('Crear ubicación'));
    page.changeInput('Patio');
    await page.submitForm();

    expect(page.text()).toContain('Selecciona un cliente para la ubicación.');
    expect(page.field('#ubicacion-cliente').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(page.field('#ubicacion-cliente'));
    expect(inventarioService.createUbicacion).not.toHaveBeenCalled();

    page.unmount();
  });

  test('exige nombre inline y enfoca el campo', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.button('Crear ubicación'));
    page.changeField('#ubicacion-cliente', '1');
    await page.submitForm();

    expect(page.text()).toContain('El nombre de la ubicación es obligatorio.');
    expect(page.field('#ubicacion-nombre').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(page.field('#ubicacion-nombre'));
    expect(inventarioService.createUbicacion).not.toHaveBeenCalled();

    page.unmount();
  });

  test('edita una ubicación existente', async () => {
    inventarioService.getUbicaciones
      .mockResolvedValueOnce(success(ubicaciones))
      .mockResolvedValueOnce(
        success(
          ubicaciones.map((ubicacion) =>
            ubicacion.id === 2 ? { ...ubicacion, nombre: 'Archivo General' } : ubicacion
          )
        )
      );
    inventarioService.updateUbicacion.mockResolvedValue({
      success: true,
      data: {
        id: 2,
        nombre: 'Archivo General',
        cliente_id: 1,
        cliente_nombre: 'ACME Seguridad',
        articulos_activos: 0,
        articulos_totales: 0,
      },
    });
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    const editButtons = page.buttons().filter((button) => button.title === 'Editar ubicación');

    await page.click(editButtons[1]);
    page.changeInput('Archivo General');
    await page.submitForm();

    expect(inventarioService.updateUbicacion).toHaveBeenCalledWith(2, {
      nombre: 'Archivo General',
      cliente_id: 1,
    });
    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({});
    expect(page.text()).toContain('Archivo General');

    page.unmount();
  });

  test('editar ubicación hacia otro cliente la retira del filtro vigente', async () => {
    let archivoSigueEnClienteFiltrado = true;
    inventarioService.getUbicaciones.mockImplementation((params = {}) => {
      if (params.cliente_id === '1') {
        return Promise.resolve(
          success(
            ubicaciones.filter(
              (ubicacion) =>
                ubicacion.cliente_id === 1 && (archivoSigueEnClienteFiltrado || ubicacion.id !== 2)
            )
          )
        );
      }
      return Promise.resolve(success(ubicaciones));
    });
    inventarioService.updateUbicacion.mockImplementation(async () => {
      archivoSigueEnClienteFiltrado = false;
      return {
        success: true,
        data: {
          id: 2,
          nombre: 'Archivo',
          cliente_id: 3,
          cliente_nombre: 'Beta Protección',
        },
      };
    });
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    page.changeField('#ubicaciones-cliente', '1');
    await page.click(page.button('Aplicar'));
    await page.click(page.container.querySelector('button[aria-label="Editar ubicación Archivo"]'));
    page.changeField('#ubicacion-cliente', '3');
    await page.submitForm();

    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({ cliente_id: '1' });
    expect(
      page.container.querySelector('.configuracion-ubicaciones-table').textContent
    ).not.toContain('Archivo');

    page.unmount();
  });

  test('elimina una ubicación sin uso tras confirmar', async () => {
    inventarioService.getUbicaciones
      .mockResolvedValueOnce(success(ubicaciones))
      .mockResolvedValueOnce(success(ubicaciones.filter((ubicacion) => ubicacion.id !== 2)));
    let resolveDelete;
    inventarioService.deleteUbicacion.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
    );
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(
      page.container.querySelector('button[aria-label="Eliminar ubicación Archivo"]')
    );
    expect(page.text()).toContain('Eliminarás la ubicación "Archivo"');
    expect(page.text()).toContain('No puede eliminarse si contiene artículos');
    await page.click(page.button('Eliminar ubicación'));
    const confirmButton = page.container.querySelector('.confirm-actions .btn-danger');
    expect(confirmButton.disabled).toBe(true);
    expect(confirmButton.textContent).toContain('Eliminando...');
    await page.click(confirmButton);

    expect(inventarioService.deleteUbicacion).toHaveBeenCalledWith(2);
    expect(inventarioService.deleteUbicacion).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveDelete({ success: true });
      await flushPromises();
    });
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

    await page.click(page.button('Ubicaciones'));
    await page.click(page.button('Crear ubicación'));
    page.changeField('#ubicacion-cliente', '1');
    page.changeInput('Bodega Central');
    await page.submitForm();

    expect(page.text()).toContain('Ya existe una ubicación con ese nombre');
    expect(page.text()).toContain('Crear ubicación');

    page.unmount();
  });

  test('bloquea visualmente eliminación con artículos asociados', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    const blockedActions = Array.from(
      page.container.querySelectorAll('.configuracion-delete-blocked')
    );
    const tableDeleteButtons = Array.from(
      page.container.querySelectorAll(
        '.configuracion-ubicaciones-table-shell button[title="Eliminar ubicación"]'
      )
    );

    expect(blockedActions).toHaveLength(2);
    blockedActions.forEach((button) => {
      expect(button.textContent).toBe('En uso');
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-label')).toContain('No se puede eliminar ubicación');
      expect(button.getAttribute('aria-describedby')).toBeTruthy();
    });
    expect(page.text()).toContain('No se puede eliminar: contiene artículos.');
    expect(page.buttons().some((button) => button.textContent.trim() === '!')).toBe(false);
    expect(tableDeleteButtons).toHaveLength(2);

    page.unmount();
  });

  test('muestra error de carga y permite reintentar', async () => {
    useAuth.mockReturnValue({
      user: {
        id: 1,
        usuario: 'visor',
        tipo_usuario: 'custom',
        permisos: ['inventario.ubicaciones.ver'],
      },
    });
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

  test('filtra ubicaciones por cliente y sin cliente', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    page.changeField('#ubicaciones-cliente', '1');
    await page.click(page.button('Aplicar'));
    await act(async () => {
      await flushPromises();
    });

    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({ cliente_id: '1' });

    page.changeField('#ubicaciones-cliente', 'sin_cliente');
    await page.click(page.button('Aplicar'));
    await act(async () => {
      await flushPromises();
    });

    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({ sin_cliente: 'true' });

    page.unmount();
  });

  test('Ver sin cliente aplica el filtro de ubicaciones sin asignar', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.button('Ver sin cliente'));

    expect(page.field('#ubicaciones-cliente').value).toBe('sin_cliente');
    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({ sin_cliente: 'true' });

    page.unmount();
  });

  test('Ver ubicaciones desde cliente cambia de pestaña y filtra por cliente', async () => {
    const page = await renderPage();
    const action = page.button('2 ubicaciones');

    expect(action.className).toContain('configuracion-link-button');
    await page.click(action);

    expect(page.text()).toContain('Ubicaciones de ACME Seguridad');
    expect(
      page.container.querySelector('.configuracion-ubicaciones-filter-card .ff-controls')
    ).not.toBeNull();
    expect(page.field('#ubicaciones-cliente').value).toBe('1');
    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({ cliente_id: '1' });

    await page.click(page.button('Limpiar filtro'));
    expect(page.field('#ubicaciones-cliente').value).toBe('');
    expect(page.field('#ubicaciones-search').value).toBe('');
    expect(page.text()).not.toContain('Ubicaciones de ACME Seguridad');

    page.unmount();
  });

  test('cliente sin ubicaciones muestra estado vacío específico', async () => {
    inventarioService.getUbicaciones.mockImplementation((params = {}) => {
      if (params.cliente_id === '2') return Promise.resolve(success([]));
      return Promise.resolve(success(ubicaciones));
    });
    const page = await renderPage();
    const inactiveClientLocationButton = () =>
      Array.from(page.container.querySelectorAll('.configuracion-clientes-table tbody tr'))
        .find((row) => row.textContent.includes('Cliente Inactivo'))
        ?.querySelector('button');

    await page.click(inactiveClientLocationButton());

    expect(page.field('#ubicaciones-cliente').value).toBe('2');
    expect(
      Array.from(page.field('#ubicaciones-cliente').querySelectorAll('option')).map(
        (option) => option.textContent
      )
    ).toContain('Cliente Inactivo (inactivo)');
    expect(page.text()).toContain('Ubicaciones de Cliente Inactivo');
    expect(page.text()).toContain('Este cliente no tiene ubicaciones registradas.');
    expect(page.text()).not.toContain('No existen ubicaciones registradas.');

    await page.click(page.button('Limpiar filtro'));
    expect(page.field('#ubicaciones-cliente').value).toBe('');
    expect(
      Array.from(page.field('#ubicaciones-cliente').querySelectorAll('option')).map(
        (option) => option.textContent
      )
    ).not.toContain('Cliente Inactivo (inactivo)');

    await page.click(inactiveClientLocationButton());
    expect(page.field('#ubicaciones-cliente').value).toBe('2');
    expect(
      Array.from(page.field('#ubicaciones-cliente').querySelectorAll('option')).map(
        (option) => option.textContent
      )
    ).toContain('Cliente Inactivo (inactivo)');

    page.unmount();
  });

  test('estado general vacío conserva mensaje general sin contexto de cliente', async () => {
    inventarioService.getUbicaciones.mockResolvedValue(success([]));
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));

    expect(page.field('#ubicaciones-cliente').value).toBe('');
    expect(page.text()).toContain('No existen ubicaciones registradas.');
    expect(page.text()).not.toContain('Este cliente no tiene ubicaciones registradas.');

    page.unmount();
  });

  test('combina búsqueda de ubicaciones con filtro de cliente', async () => {
    const page = await renderPage();

    await page.click(page.container.querySelectorAll('.configuracion-tabs button')[1]);
    page.changeField('#ubicaciones-cliente', '1');
    page.changeField('#ubicaciones-search', 'bodega');
    await page.click(page.button('Aplicar'));
    await act(async () => {
      await flushPromises();
    });

    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({
      cliente_id: '1',
      search: 'bodega',
    });

    page.unmount();
  });

  test('formulario de ubicación conserva cliente histórico null sin exigir reasignación', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    const editButtons = page.buttons().filter((button) => button.title === 'Editar ubicación');
    await page.click(editButtons[0]);

    const firstControl = page.container.querySelector(
      '.configuracion-ubicacion-modal select, .configuracion-ubicacion-modal input'
    );
    expect(firstControl.id).toBe('ubicacion-cliente');
    expect(page.field('#ubicacion-cliente').value).toBe('__historical_unassigned_cliente__');
    expect(page.text()).toContain('Sin cliente — dato histórico');
    expect(page.text()).toContain('Puedes conservarla sin reasignar.');
    expect(page.button('Guardar cambios').disabled).toBe(false);

    page.changeInput('Histórica editada');
    inventarioService.updateUbicacion.mockResolvedValueOnce({
      success: true,
      data: {
        id: 3,
        nombre: 'Histórica editada',
        cliente_id: null,
        cliente_nombre: null,
      },
    });
    await page.submitForm();

    expect(inventarioService.updateUbicacion).toHaveBeenCalledWith(3, {
      nombre: 'Histórica editada',
      cliente_id: null,
    });

    page.unmount();
  });

  test('ubicación histórica sin cliente puede asignarse a cliente activo y no volver a sin cliente', async () => {
    inventarioService.updateUbicacion.mockResolvedValueOnce({
      success: true,
      data: {
        id: 3,
        nombre: 'Histórica',
        cliente_id: 1,
        cliente_nombre: 'ACME Seguridad',
      },
    });
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    const editButtons = page.buttons().filter((button) => button.title === 'Editar ubicación');
    await page.click(editButtons[0]);
    page.changeField('#ubicacion-cliente', '1');

    const options = Array.from(page.field('#ubicacion-cliente').querySelectorAll('option')).map(
      (option) => option.textContent
    );
    expect(options).not.toContain('Sin cliente — dato histórico');

    await page.submitForm();

    expect(inventarioService.updateUbicacion).toHaveBeenCalledWith(3, {
      nombre: 'Histórica',
      cliente_id: 1,
    });

    page.unmount();
  });

  test('edición de ubicación conserva cliente histórico inactivo sin exigir reasignación', async () => {
    inventarioService.getUbicaciones.mockResolvedValue(
      success([
        {
          id: 8,
          nombre: 'Bodega histórica',
          cliente_id: 2,
          cliente_nombre: 'Cliente Inactivo',
          cliente_estado: 'inactivo',
          articulos_activos: 0,
          articulos_totales: 0,
        },
      ])
    );
    inventarioService.updateUbicacion.mockResolvedValue({
      success: true,
      data: {
        id: 8,
        nombre: 'Bodega histórica editada',
        cliente_id: 2,
        cliente_nombre: 'Cliente Inactivo',
        cliente_estado: 'inactivo',
      },
    });
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.buttons().find((button) => button.title === 'Editar ubicación'));

    expect(page.field('#ubicacion-cliente').value).toBe('2');
    expect(page.text()).toContain('Cliente Inactivo (inactivo)');
    expect(page.text()).toContain('El cliente actual está inactivo y se conserva por historial.');
    expect(page.button('Guardar cambios').disabled).toBe(false);

    page.changeInput('Bodega histórica editada');
    await page.submitForm();

    expect(inventarioService.updateUbicacion).toHaveBeenCalledWith(8, {
      nombre: 'Bodega histórica editada',
      cliente_id: 2,
    });

    page.unmount();
  });

  test('edición de ubicación no muestra otros clientes inactivos como opciones', async () => {
    clientesService.listOpcionesUbicaciones.mockResolvedValue(
      success([
        ...clientes.filter((cliente) => cliente.estado === 'activo'),
        { id: 4, nombre: 'Otro Inactivo', estado: 'inactivo' },
      ])
    );
    inventarioService.getUbicaciones.mockResolvedValue(
      success([
        {
          id: 8,
          nombre: 'Bodega histórica',
          cliente_id: 2,
          cliente_nombre: 'Cliente Inactivo',
          cliente_estado: 'inactivo',
          articulos_activos: 0,
          articulos_totales: 0,
        },
      ])
    );
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.buttons().find((button) => button.title === 'Editar ubicación'));

    const options = Array.from(page.field('#ubicacion-cliente').querySelectorAll('option')).map(
      (option) => option.textContent
    );
    expect(options).toContain('Cliente Inactivo (inactivo)');
    expect(options).toContain('ACME Seguridad');
    expect(options).toContain('Beta Protección');
    expect(options).not.toContain('Otro Inactivo');

    page.unmount();
  });

  test('edición de ubicación permite elegir un cliente activo desde histórico inactivo', async () => {
    inventarioService.getUbicaciones.mockResolvedValue(
      success([
        {
          id: 8,
          nombre: 'Bodega histórica',
          cliente_id: 2,
          cliente_nombre: 'Cliente Inactivo',
          articulos_activos: 0,
          articulos_totales: 0,
        },
      ])
    );
    inventarioService.updateUbicacion.mockResolvedValue({
      success: true,
      data: {
        id: 8,
        nombre: 'Bodega histórica',
        cliente_id: 1,
        cliente_nombre: 'ACME Seguridad',
      },
    });
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.buttons().find((button) => button.title === 'Editar ubicación'));
    page.changeField('#ubicacion-cliente', '1');
    await page.submitForm();

    expect(inventarioService.updateUbicacion).toHaveBeenCalledWith(8, {
      nombre: 'Bodega histórica',
      cliente_id: 1,
    });

    page.unmount();
  });

  test('crear ubicación no ofrece clientes inactivos', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.button('Crear ubicación'));

    const options = Array.from(page.field('#ubicacion-cliente').querySelectorAll('option')).map(
      (option) => option.textContent
    );
    expect(options).toContain('ACME Seguridad');
    expect(options).toContain('Beta Protección');
    expect(options).not.toContain('Cliente Inactivo');
    expect(options).not.toContain('Sin cliente — dato histórico');

    page.unmount();
  });

  test('renderiza lista de clientes y aplica búsqueda', async () => {
    const page = await renderPage();

    expect(clientesService.listClientes).toHaveBeenCalledWith({});
    expect(page.text()).toContain('ACME Seguridad');
    expect(page.text()).toContain('Cliente Inactivo');
    expect(page.text()).toContain('2 ubicaciones');
    expect(page.text()).toContain('1 ubicación');
    expect(page.text()).toContain('Sin ubicaciones');
    expect(page.text()).not.toContain('Directorio\nBuscar');
    expect(page.text()).not.toContain('Buscar por nombre, identificación, correo o teléfono.');
    expect(page.field('#clientes-search').placeholder).toBe(
      'Buscar por nombre, identificación, correo o teléfono.'
    );
    page.changeField('#clientes-search', 'acme');
    await page.click(page.button('Aplicar'));
    await act(async () => {
      await flushPromises();
    });

    expect(clientesService.listClientes).toHaveBeenCalledTimes(1);
    expect(page.text()).toContain('ACME Seguridad');
    expect(page.text()).not.toContain('Cliente Inactivo');
    page.unmount();
  });

  test.each([
    ['identificación', ' 099003 ', 'Beta Protección', 'ACME Seguridad'],
    ['correo sin distinguir mayúsculas', 'OPS@ACME.COM', 'ACME Seguridad', 'Beta Protección'],
    ['teléfono con formato', '099 999 9999', 'ACME Seguridad', 'Beta Protección'],
  ])('busca clientes localmente por %s', async (_field, search, expected, hidden) => {
    clientesService.listClientes.mockResolvedValue(
      clientesSuccess([
        {
          ...clientes[0],
          telefono: '+593 99 999 9999',
        },
        clientes[1],
        clientes[2],
      ])
    );
    const page = await renderPage();

    page.changeField('#clientes-search', search);
    await page.click(page.button('Aplicar'));

    expect(page.text()).toContain(expected);
    expect(page.text()).not.toContain(hidden);
    expect(clientesService.listClientes).toHaveBeenCalledTimes(1);
    page.unmount();
  });

  test('combina búsqueda local con filtro de relación', async () => {
    const page = await renderPage();

    page.changeField('#clientes-search', 'beta@example.com');
    page.changeField('#clientes-estado-ubicaciones', 'con_ubicaciones');
    await page.click(page.button('Aplicar'));

    expect(page.text()).toContain('Beta Protección');
    expect(page.text()).not.toContain('ACME Seguridad');
    expect(page.text()).not.toContain('Cliente Inactivo');
    expect(clientesService.listClientes).toHaveBeenCalledTimes(1);
    page.unmount();
  });

  test('lista ubicaciones reales ordenadas después de cargar Ubicaciones y filtra clientes por ubicación', async () => {
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.button('Directorio'));

    const options = Array.from(page.field('#clientes-ubicaciones').querySelectorAll('option')).map(
      (option) => option.textContent
    );

    expect(options).toEqual(['Todas las ubicaciones', 'Archivo', 'Bodega Central', 'Histórica']);
    expect(page.text()).toContain('Cliente Inactivo');

    page.changeField('#clientes-ubicaciones', '1');
    await page.click(page.button('Aplicar'));
    expect(page.text()).toContain('ACME Seguridad');
    expect(page.text()).not.toContain('Beta Protección');
    expect(page.text()).not.toContain('Cliente Inactivo');

    page.changeField('#clientes-search', 'acme');
    await page.click(page.button('Aplicar'));
    expect(page.text()).toContain('ACME Seguridad');

    page.changeField('#clientes-search', '');
    page.changeField('#clientes-ubicaciones', '3');
    await page.click(page.button('Aplicar'));
    expect(page.text()).toContain('Mostrando 0 de 0 cliente(s)');
    expect(page.text()).toContain(
      'No encontramos clientes que coincidan con los filtros aplicados.'
    );
    expect(page.text()).not.toContain('ACME Seguridad');
    expect(page.text()).not.toContain('Cliente Inactivo');

    page.unmount();
  });

  test('filtro de relación con ubicaciones vive dentro del bloque de filtros', async () => {
    const page = await renderPage();
    const filterCard = page.container.querySelector('.configuracion-clientes-filter-card');
    const relationFilter = page.field('#clientes-estado-ubicaciones');

    expect(filterCard.querySelector('.ff-pills')).toBeNull();
    expect(filterCard.querySelector('.configuracion-clientes-relation.ff-state')).not.toBeNull();
    expect(
      Array.from(relationFilter.querySelectorAll('option')).map((option) => option.textContent)
    ).toEqual(['Todos los clientes', 'Con ubicaciones', 'Sin ubicaciones']);
    page.changeField('#clientes-estado-ubicaciones', 'sin_ubicaciones');
    await page.click(page.button('Aplicar'));

    expect(page.text()).toContain('Estos clientes todavía no tienen ubicaciones registradas.');
    expect(page.text()).toContain('Cliente Inactivo');
    expect(page.text()).not.toContain('ACME Seguridad');
    expect(page.field('#clientes-ubicaciones').value).toBe('');

    page.unmount();
  });

  test('selector de relación aplica filtros y limpiar restablece', async () => {
    const page = await renderPage();

    page.changeField('#clientes-estado-ubicaciones', 'con_ubicaciones');
    expect(page.field('#clientes-estado-ubicaciones').value).toBe('con_ubicaciones');
    await page.click(page.button('Aplicar'));
    expect(page.text()).not.toContain('Cliente Inactivo');

    page.changeField('#clientes-estado-ubicaciones', 'sin_ubicaciones');
    expect(page.field('#clientes-estado-ubicaciones').value).toBe('sin_ubicaciones');
    await page.click(page.button('Aplicar'));
    expect(page.text()).toContain('Cliente Inactivo');

    await page.click(page.button('Limpiar'));
    expect(page.field('#clientes-estado-ubicaciones').value).toBe('todas');
    expect(page.text()).toContain('ACME Seguridad');
    expect(page.text()).toContain('Cliente Inactivo');

    page.unmount();
  });

  test('columna Ubicaciones es clicable y administra el cliente', async () => {
    const page = await renderPage();

    await page.click(page.button('2 ubicaciones'));

    expect(page.field('#ubicaciones-cliente').value).toBe('1');
    expect(inventarioService.getUbicaciones).toHaveBeenLastCalledWith({ cliente_id: '1' });

    page.unmount();
  });

  test('Crear ubicación desde clientes sin ubicaciones no precarga cliente inactivo', async () => {
    const page = await renderPage();
    page.changeField('#clientes-estado-ubicaciones', 'sin_ubicaciones');
    await page.click(page.button('Aplicar'));
    await page.click(page.button('Crear ubicación'));

    expect(page.field('#ubicacion-cliente').value).toBe('');
    expect(page.field('#ubicaciones-cliente').value).toBe('');

    page.unmount();
  });

  test('tabla de Directorio muestra todos los campos registrados y valores vacíos consistentes', async () => {
    const page = await renderPage();
    const headers = Array.from(
      page.container.querySelectorAll('.configuracion-clientes-table thead th')
    ).map((header) => header.textContent.trim());

    expect(headers).toEqual([
      'Cliente',
      'Identificación',
      'Teléfono',
      'Correo electrónico',
      'Dirección',
      'Ciudad',
      'Estado',
      'Ubicaciones',
      '',
    ]);
    expect(page.text()).not.toContain('RUC');
    expect(page.text()).toContain('0999999999');
    expect(page.text()).toContain('ops@acme.com');
    expect(page.text()).toContain('Av. Principal');
    expect(page.text()).toContain('Quito');
    expect(page.text()).toContain('Sin registrar');
    expect(page.container.querySelector('.table-responsive.app-table-shell')).not.toBeNull();
    expect(
      page.container.querySelector('.configuracion-clientes-table td[title="Av. Principal"]')
    ).not.toBeNull();
    expect(
      page.container.querySelector('button[aria-label="Ver ubicaciones de ACME Seguridad"]')
    ).toBeNull();
    expect(
      page.container.querySelector('.configuracion-clientes-table thead th:last-child').textContent
    ).toBe('');

    page.unmount();
  });

  test('crea un cliente desde el formulario', async () => {
    clientesService.createCliente.mockResolvedValue({
      success: true,
      data: { ...clientes[0], id: 4, nombre: 'Nuevo Cliente' },
    });
    clientesService.listClientes
      .mockResolvedValueOnce(clientesSuccess())
      .mockResolvedValueOnce(clientesSuccess([...clientes, { ...clientes[0], id: 4 }]));
    const page = await renderPage();

    await page.click(page.button('Crear cliente'));
    page.changeField('#cliente-nombre', '  Nuevo Cliente  ');
    page.changeField('#cliente-identificacion', ' 099003 ');
    page.changeField('#cliente-correo', ' NUEVO@CLIENTE.COM ');
    await page.submitForm();

    expect(clientesService.createCliente).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Nuevo Cliente',
        identificacion: '099003',
        correo: 'NUEVO@CLIENTE.COM',
      })
    );
    expect(clientesService.listClientes).toHaveBeenCalledTimes(2);
    page.unmount();
  });

  test('valida nombre obligatorio de cliente', async () => {
    const page = await renderPage();

    await page.click(page.button('Crear cliente'));
    page.changeField('#cliente-nombre', '   ');
    await page.submitForm();

    expect(page.text()).toContain('El nombre del cliente es obligatorio.');
    expect(page.field('#cliente-nombre').getAttribute('aria-invalid')).toBe('true');
    expect(page.field('#cliente-nombre').getAttribute('aria-describedby')).toContain(
      'cliente-nombre-error'
    );
    expect(clientesService.createCliente).not.toHaveBeenCalled();

    page.changeField('#cliente-nombre', 'Cliente válido');
    expect(page.text()).not.toContain('El nombre del cliente es obligatorio.');
    page.unmount();
  });

  test('valida longitud máxima del nombre de cliente antes del servicio', async () => {
    const page = await renderPage();

    await page.click(page.button('Crear cliente'));
    page.changeField('#cliente-nombre', 'A'.repeat(101));
    await page.submitForm();

    expect(page.text()).toContain('El nombre no puede exceder 100 caracteres.');
    expect(clientesService.createCliente).not.toHaveBeenCalled();
    page.unmount();
  });

  test('valida correo de cliente opcional y lo limpia al corregir', async () => {
    const page = await renderPage();

    await page.click(page.button('Crear cliente'));
    page.changeField('#cliente-nombre', 'Cliente con correo');
    page.changeField('#cliente-correo', 'correo-invalido');
    await page.submitForm();

    expect(page.text()).toContain('Ingresa un correo válido.');
    expect(page.field('#cliente-correo').getAttribute('aria-invalid')).toBe('true');
    expect(page.field('#cliente-correo').getAttribute('aria-describedby')).toBe(
      'cliente-correo-error'
    );
    expect(clientesService.createCliente).not.toHaveBeenCalled();

    page.changeField('#cliente-correo', 'cliente@example.com');
    expect(page.text()).not.toContain('Ingresa un correo válido.');
    page.unmount();
  });

  test('permite crear cliente con correo vacío y recorta teléfono e identificación', async () => {
    clientesService.createCliente.mockResolvedValue({
      success: true,
      data: { ...clientes[0], id: 4, nombre: 'Cliente Simple' },
    });
    const page = await renderPage();

    await page.click(page.button('Crear cliente'));
    page.changeField('#cliente-nombre', ' Cliente Simple ');
    page.changeField('#cliente-identificacion', ' 099004 ');
    page.changeField('#cliente-telefono', ' 0987654321 ');
    await page.submitForm();

    expect(clientesService.createCliente).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Cliente Simple',
        identificacion: '099004',
        telefono: '0987654321',
        correo: '',
      })
    );
    page.unmount();
  });

  test('edita un cliente', async () => {
    clientesService.updateCliente.mockResolvedValue({
      success: true,
      data: { ...clientes[0], nombre: 'ACME Editado' },
    });
    clientesService.listClientes
      .mockResolvedValueOnce(clientesSuccess())
      .mockResolvedValueOnce(
        clientesSuccess([{ ...clientes[0], nombre: 'ACME Editado' }, clientes[1]])
      );
    const page = await renderPage();

    await page.click(
      page.container.querySelector('button[aria-label="Editar cliente ACME Seguridad"]')
    );
    page.changeField('#cliente-nombre', 'ACME Editado');
    page.changeField('#cliente-estado', 'inactivo');
    await page.submitForm();

    expect(clientesService.updateCliente).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nombre: 'ACME Editado', estado: 'inactivo' })
    );
    page.unmount();
  });

  test('elimina un cliente tras confirmar', async () => {
    let resolveDelete;
    clientesService.deleteCliente.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
    );
    const page = await renderPage();

    await page.click(
      page.container.querySelector('button[aria-label="Eliminar cliente ACME Seguridad"]')
    );
    expect(page.text()).toContain('Eliminarás el cliente "ACME Seguridad"');
    expect(page.text()).toContain('si tiene historial, desactívalo');
    await page.click(page.button('Eliminar cliente'));
    const confirmButton = page.container.querySelector('.confirm-actions .btn-danger');
    expect(confirmButton.disabled).toBe(true);
    expect(confirmButton.textContent).toContain('Eliminando...');
    await page.click(confirmButton);

    expect(clientesService.deleteCliente).toHaveBeenCalledWith(1);
    expect(clientesService.deleteCliente).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveDelete({ success: true });
      await flushPromises();
    });
    expect(page.text()).not.toContain('ACME Seguridad');
    page.unmount();
  });

  test('muestra conflicto 409 de cliente duplicado', async () => {
    clientesService.createCliente.mockResolvedValue({
      success: false,
      status: 409,
      message: 'Ya existe un cliente con esa identificación',
    });
    const page = await renderPage();

    await page.click(page.button('Crear cliente'));
    page.changeField('#cliente-nombre', 'ACME Seguridad');
    page.changeField('#cliente-identificacion', '099001');
    await page.submitForm();

    expect(page.text()).toContain('Ya existe un cliente con esa identificación');
    expect(page.text()).toContain('Crear cliente');
    page.unmount();
  });

  test('bloquea el modal de cliente durante el envío y evita doble submit o cierre', async () => {
    const deferredCreate = createDeferred();
    clientesService.createCliente.mockReturnValue(deferredCreate.promise);
    const page = await renderPage();

    await page.click(page.button('Crear cliente'));
    page.changeField('#cliente-nombre', 'Cliente Pendiente');
    await act(async () => {
      Simulate.submit(page.container.querySelector('form'));
      await flushPromises();
    });

    const modal = page.container.querySelector('.app-modal');
    const closeButton = page.container.querySelector('.app-modal__close');
    const cancelButton = page.button('Cancelar');
    const submitButton = page.button('Creando...');

    expect(page.text()).toContain('Creando...');
    expect(page.container.querySelector('form').getAttribute('aria-busy')).toBe('true');
    expect(closeButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);

    await act(async () => {
      Simulate.submit(page.container.querySelector('form'));
      Simulate.keyDown(modal, { key: 'Escape' });
      await flushPromises();
    });
    expect(clientesService.createCliente).toHaveBeenCalledTimes(1);
    expect(page.text()).toContain('Crear cliente');

    await act(async () => {
      deferredCreate.resolve({ success: true, data: { id: 4, nombre: 'Cliente Pendiente' } });
      await flushPromises();
    });
    expect(page.text()).not.toContain('Creando...');
    page.unmount();
  });

  test('mantiene valores y restaura controles cuando falla la creación de cliente', async () => {
    clientesService.createCliente.mockResolvedValue({
      success: false,
      status: 500,
      message: 'Error controlado',
    });
    const page = await renderPage();

    await page.click(page.button('Crear cliente'));
    page.changeField('#cliente-nombre', 'Cliente Temporal');
    page.changeField('#cliente-correo', 'temporal@example.com');
    await page.submitForm();

    expect(page.text()).toContain('Error controlado');
    expect(page.field('#cliente-nombre').value).toBe('Cliente Temporal');
    expect(page.field('#cliente-correo').value).toBe('temporal@example.com');
    expect(page.container.querySelector('.app-modal__close').disabled).toBe(false);
    expect(page.button('Crear cliente').disabled).toBe(false);
    page.unmount();
  });

  test('pagina clientes en 50 registros fijos y deshabilita botones extremos', async () => {
    clientesService.listClientes.mockResolvedValue(clientesSuccess(buildClientes(79)));
    const page = await renderPage();

    const rows = page.container.querySelectorAll('.configuracion-clientes-table tbody tr');
    expect(rows).toHaveLength(50);
    expect(page.text()).toContain('Mostrando 50 de 79 cliente(s)');
    expect(page.text()).toContain('Página 1 de 2');
    expect(page.button('‹ Anterior').disabled).toBe(true);
    expect(page.button('Siguiente ›').disabled).toBe(false);
    expect(page.field('#clientes-page-size')).toBeNull();

    await page.click(page.button('Siguiente ›'));

    expect(page.container.querySelectorAll('.configuracion-clientes-table tbody tr')).toHaveLength(
      29
    );
    expect(page.text()).toContain('Mostrando 29 de 79 cliente(s)');
    expect(page.text()).toContain('Página 2 de 2');
    expect(page.button('‹ Anterior').disabled).toBe(false);
    expect(page.button('Siguiente ›').disabled).toBe(true);

    page.unmount();
  });

  test('filtra antes de paginar y reinicia a página 1 al cambiar filtro', async () => {
    const manyClientes = buildClientes(120);
    clientesService.listClientes.mockResolvedValue(clientesSuccess(manyClientes));
    inventarioService.getUbicaciones.mockResolvedValue(
      success(buildUbicacionesForClientes(manyClientes))
    );
    const page = await renderPage();

    await page.click(page.button('Ubicaciones'));
    await page.click(page.button('Directorio'));
    await page.click(page.button('Siguiente ›'));
    page.changeField('#clientes-ubicaciones', '1002');
    await page.click(page.button('Aplicar'));

    expect(page.text()).toContain('Mostrando 1 de 1 cliente(s)');
    expect(page.text()).toContain('Cliente 02');
    expect(page.text()).not.toContain('Cliente 01');
    expect(page.button('‹ Anterior')).toBeFalsy();

    page.unmount();
  });

  test('busca antes de paginar y reinicia a página 1 al cambiar búsqueda', async () => {
    clientesService.listClientes.mockResolvedValue(clientesSuccess(buildClientes(79)));
    const page = await renderPage();

    await page.click(page.button('Siguiente ›'));
    page.changeField('#clientes-search', 'Cliente 70');
    await page.click(page.button('Aplicar'));

    expect(page.text()).toContain('Mostrando 1 de 1 cliente(s)');
    expect(page.text()).toContain('Cliente 70');
    expect(page.button('Siguiente ›')).toBeFalsy();

    page.unmount();
  });

  test('ordena alfabéticamente antes de paginar', async () => {
    clientesService.listClientes.mockResolvedValue(clientesSuccess(buildClientes(79)));
    const page = await renderPage();

    expect(page.text()).toContain('Mostrando 50 de 79 cliente(s)');
    expect(page.text()).toContain('Cliente 01');
    expect(page.text()).toContain('Cliente 02');
    expect(page.text()).toContain('Cliente 22');
    expect(page.text()).not.toContain('Cliente 79');

    page.unmount();
  });

  test('no muestra controles de paginación cuando no hay resultados', async () => {
    clientesService.listClientes.mockResolvedValue(clientesSuccess(buildClientes(79)));
    const page = await renderPage();

    page.changeField('#clientes-search', 'sin coincidencias');
    await page.click(page.button('Aplicar'));

    expect(page.text()).toContain('Mostrando 0 de 0 cliente(s)');
    expect(page.text()).toContain(
      'No encontramos clientes que coincidan con los filtros aplicados.'
    );
    expect(page.button('Limpiar filtros')).toBeTruthy();
    expect(page.button('Siguiente ›')).toBeFalsy();
    expect(page.field('#clientes-page-size')).toBeNull();

    page.unmount();
  });

  test('mantiene una sola página sin controles innecesarios', async () => {
    clientesService.listClientes.mockResolvedValue(clientesSuccess(buildClientes(10)));
    const page = await renderPage();

    expect(page.text()).toContain('Mostrando 10 de 10 cliente(s)');
    expect(page.button('‹ Anterior')).toBeFalsy();
    expect(page.button('Siguiente ›')).toBeFalsy();
    expect(page.field('#clientes-page-size')).toBeNull();

    page.unmount();
  });

  test('muestra estado vacío global con acción de creación cuando no hay clientes', async () => {
    clientesService.listClientes.mockResolvedValue(clientesSuccess([]));
    inventarioService.getUbicaciones.mockResolvedValue(success([]));
    const page = await renderPage();

    expect(page.text()).toContain('No hay clientes registrados.');
    expect(
      page.buttons().filter((button) => button.textContent.includes('Crear cliente')).length
    ).toBeGreaterThan(1);

    page.unmount();
  });

  test('muestra estado vacío contextual para filtro sin ubicaciones sin tratarlo como catálogo vacío', async () => {
    clientesService.listClientes.mockResolvedValue(
      clientesSuccess(clientes.map((cliente) => ({ ...cliente, ubicaciones_totales: 1 })))
    );
    const page = await renderPage();

    page.changeField('#clientes-estado-ubicaciones', 'sin_ubicaciones');
    await page.click(page.button('Aplicar'));

    expect(page.text()).toContain(
      'No hay clientes sin ubicaciones que coincidan con los filtros aplicados.'
    );
    expect(page.text()).not.toContain('No hay clientes registrados.');
    expect(page.button('Limpiar filtros')).toBeTruthy();

    page.unmount();
  });
});
