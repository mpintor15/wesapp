import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PERMISSIONS } from '../../auth/permissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import bitacorasService from '../../services/bitacorasService';
import Bitacoras from './Bitacoras';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../context/ToastContext', () => ({
  useToast: jest.fn(),
}));

jest.mock('../../services/bitacorasService', () => ({
  __esModule: true,
  default: {
    getUbicaciones: jest.fn(),
    getManzanas: jest.fn(),
    getVillas: jest.fn(),
    getFormulariosVisitas: jest.fn(),
    getFormularioVisitasActivo: jest.fn(),
    publishFormularioVisitas: jest.fn(),
    createVisita: jest.fn(),
    getVisitas: jest.fn(),
    closeVisita: jest.fn(),
    createRegistro: jest.fn(),
    getRegistros: jest.fn(),
    exportRegistros: jest.fn(),
    exportVisitas: jest.fn(),
    exportFormulariosVisitas: jest.fn(),
  },
}));

jest.mock('./components/HistorialBitacoras', () => {
  const { useEffect } = jest.requireActual('react');
  const MockHistorialBitacoras = (props) => {
    useEffect(() => {
      props.onTotalChange?.(3);
    }, [props]);
    return (
      <section
        data-testid="historial-bitacoras"
        data-location-count={props.ubicaciones.length}
        data-refresh-key={props.refreshKey}
      >
        Historial funcional
      </section>
    );
  };
  MockHistorialBitacoras.displayName = 'MockHistorialBitacoras';
  return MockHistorialBitacoras;
});

jest.mock('../../hooks/useScrollToTopOnMount', () => jest.fn());

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LOCATIONS = [
  { id: 7, nombre: 'Garita principal', cliente_nombre: 'Cliente X', tipo_punto: 'GENERAL' },
  { id: 8, nombre: 'Urbanización Norte', cliente_nombre: 'Cliente X', tipo_punto: 'URBANIZACION' },
];

const setValue = (element, value) => {
  const prototype =
    element instanceof globalThis.HTMLTextAreaElement
      ? globalThis.HTMLTextAreaElement.prototype
      : element instanceof globalThis.HTMLSelectElement
        ? globalThis.HTMLSelectElement.prototype
        : globalThis.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
};

const flushPromises = async (cycles = 3) => {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
};

const changeAndFlush = async (element, value, cycles = 3) => {
  act(() => setValue(element, value));
  await act(async () => flushPromises(cycles));
};

const selectSearchOption = async (container, input, text, cycles = 3) => {
  await act(async () => {
    input.dispatchEvent(new globalThis.FocusEvent('focusin', { bubbles: true }));
    await flushPromises();
  });
  const option = Array.from(container.querySelectorAll('[role="option"]')).find(
    (item) => item.textContent === text
  );
  expect(option).not.toBeUndefined();
  await act(async () => {
    option.dispatchEvent(new globalThis.MouseEvent('mousedown', { bubbles: true }));
    option.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }));
    await flushPromises(cycles);
  });
};

const renderBitacoras = (permissions, user = { id: 7, colaborador_id: 4 }) => {
  useAuth.mockReturnValue({
    user,
    hasPermission: jest.fn((permission) => permissions.includes(permission)),
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => root.render(<Bitacoras />));

  return {
    container,
    button: (text) =>
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === text
      ),
    tab: (label) =>
      Array.from(container.querySelectorAll('[role="tab"]')).find((tabButton) =>
        tabButton.textContent.startsWith(label)
      ),
    tabBadge: (label) => {
      const tabButton = Array.from(container.querySelectorAll('[role="tab"]')).find((candidate) =>
        candidate.textContent.startsWith(label)
      );
      return tabButton?.querySelector('.tab-badge')?.textContent ?? null;
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('Bitacoras', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 21, 10, 0));
    useToast.mockReturnValue({ showToast: jest.fn() });
    bitacorasService.getUbicaciones.mockResolvedValue({ success: true, data: LOCATIONS });
    bitacorasService.getFormulariosVisitas.mockResolvedValue({ success: true, data: [] });
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [],
      meta: { page: 1, totalPages: 1, totalItems: 0 },
    });
    bitacorasService.exportRegistros.mockResolvedValue({ success: true });
    bitacorasService.exportVisitas.mockResolvedValue({ success: true });
    bitacorasService.exportFormulariosVisitas.mockResolvedValue({ success: true });
    bitacorasService.getManzanas.mockResolvedValue({
      success: true,
      data: [{ id: 31, nombre: 'Manzana A' }],
    });
    bitacorasService.getVillas.mockResolvedValue({
      success: true,
      data: [
        {
          id: 41,
          identificador: 'A-1',
          residente_principal_nombre: 'Ana Titular',
          residente_principal_contacto: '0991234567',
        },
      ],
    });
  });

  afterEach(() => jest.useRealTimers());

  test('solo crear permite entrar y muestra la acción sin tabs', async () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);
    await act(async () => Promise.resolve());

    expect(view.button('Registrar Bitácora')).not.toBeUndefined();
    expect(view.button('Registrar Visita')).toBeUndefined();
    expect(view.container.querySelector('[role="tablist"]')).toBeNull();
    expect(view.container.textContent).toContain('No tienes permiso para consultar el historial');
    expect(bitacorasService.getUbicaciones).toHaveBeenCalledTimes(1);
    expect(bitacorasService.getRegistros).not.toHaveBeenCalled();

    view.unmount();
  });

  test('solo historial muestra historial funcional, carga Ubicaciones y no muestra Registrar', async () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_HISTORIAL_VER]);
    await act(async () => Promise.resolve());

    expect(view.button('Registrar Bitácora')).toBeUndefined();
    expect(view.container.textContent).toContain('Historial funcional');
    expect(bitacorasService.getUbicaciones).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  test('permiso crear sin Colaborador oculta Registrar pero conserva el historial', async () => {
    const view = renderBitacoras(
      [PERMISSIONS.BITACORAS_REGISTRO_CREAR, PERMISSIONS.BITACORAS_HISTORIAL_VER],
      { id: 2, colaborador_id: null, tipo_usuario: 'gerente' }
    );
    await act(async () => Promise.resolve());

    expect(view.button('Registrar Bitácora')).toBeUndefined();
    expect(view.container.textContent).toContain('Historial funcional');
    expect(bitacorasService.getUbicaciones).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  test('con ambos permisos muestra Registrar y mantiene shell único', async () => {
    const view = renderBitacoras([
      PERMISSIONS.BITACORAS_REGISTRO_CREAR,
      PERMISSIONS.BITACORAS_HISTORIAL_VER,
    ]);
    await act(async () => Promise.resolve());

    expect(view.button('Registrar Bitácora')).not.toBeUndefined();
    expect(view.button('Generar reporte de Bitácoras')).not.toBeUndefined();
    expect(view.button('Registrar Visita')).toBeUndefined();
    expect(view.container.querySelector('[role="tab"]')).not.toBeNull();
    expect(view.container.querySelector('.bitacoras-container').className).toContain(
      'tabular-page'
    );
    expect(view.container.textContent).toContain('Historial funcional');

    await act(async () => {
      view.button('Generar reporte de Bitácoras').click();
      await Promise.resolve();
    });
    expect(bitacorasService.exportRegistros).toHaveBeenCalledWith({});

    await act(async () => {
      view.button('Visitas').click();
      await Promise.resolve();
    });
    expect(view.button('Registrar Bitácora')).toBeUndefined();
    expect(view.button('Registrar Visita')).not.toBeUndefined();
    expect(view.button('Generar reporte de Visitas')).not.toBeUndefined();

    await act(async () => {
      view.button('Generar reporte de Visitas').click();
      await Promise.resolve();
    });
    expect(bitacorasService.exportVisitas).toHaveBeenCalledWith({
      pageSize: 25,
      estado: 'ABIERTA',
    });

    view.unmount();
  });

  test('el tab de historial se muestra como "Registro" y no como "Bitácoras"', async () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_HISTORIAL_VER]);
    await act(async () => Promise.resolve());

    expect(view.tab('Registro')).not.toBeUndefined();
    expect(view.tab('Bitácoras')).toBeUndefined();
    expect(view.container.querySelector('h1, h2')?.textContent).not.toBe('Registro');

    view.unmount();
  });

  test('cada tab muestra el total visible (meta.total) como badge, oculto cuando es 0', async () => {
    bitacorasService.getFormulariosVisitas.mockResolvedValue({
      success: true,
      data: [],
      meta: { totalItems: 4, totalPages: 1 },
    });
    const view = renderBitacoras([
      PERMISSIONS.BITACORAS_HISTORIAL_VER,
      PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR,
    ]);
    await act(async () => Promise.resolve());

    expect(view.tabBadge('Registro')).toBe('3');
    expect(view.tabBadge('Visitas')).toBeNull();

    await act(async () => {
      view.tab('Formularios').click();
      await flushPromises();
    });
    expect(view.tabBadge('Formularios')).toBe('4');
    expect(view.tabBadge('Registro')).toBe('3');

    view.unmount();
  });

  test('sin permiso de Formularios, ese tab y su badge no se renderizan', async () => {
    bitacorasService.getFormulariosVisitas.mockResolvedValue({
      success: true,
      data: [],
      meta: { totalItems: 9, totalPages: 1 },
    });
    const view = renderBitacoras([PERMISSIONS.BITACORAS_HISTORIAL_VER]);
    await act(async () => Promise.resolve());

    expect(view.tab('Formularios')).toBeUndefined();
    expect(view.container.textContent).not.toContain('9');

    view.unmount();
  });

  test('permiso de formularios muestra administración sin habilitar registro', async () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_FORMULARIOS_ADMINISTRAR]);
    await act(async () => Promise.resolve());

    expect(view.button('Registrar Bitácora')).toBeUndefined();
    expect(view.button('Registrar Visita')).toBeUndefined();
    expect(view.button('Crear formulario')).not.toBeUndefined();
    expect(view.container.textContent).toContain('No hay formularios publicados.');
    expect(bitacorasService.getUbicaciones).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  test('sin permisos usa fallback seguro sin contenido funcional', () => {
    const view = renderBitacoras([]);

    expect(view.button('Registrar Bitácora')).toBeUndefined();
    expect(view.container.textContent).toContain('Acceso no disponible');
    expect(bitacorasService.getUbicaciones).not.toHaveBeenCalled();

    view.unmount();
  });

  test('Volver navega al Dashboard', () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_HISTORIAL_VER]);

    act(() => view.button('Volver').click());
    expect(mockNavigate).toHaveBeenCalledWith('/');

    view.unmount();
  });

  test('refresh manual continúa invalidando el historial una sola vez', () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_HISTORIAL_VER]);
    const history = view.container.querySelector('[data-testid="historial-bitacoras"]');
    const refresh = view.container.querySelector('[aria-label="Actualizar historial"]');

    expect(history.dataset.refreshKey).toBe('0');
    act(() => refresh.click());
    expect(history.dataset.refreshKey).toBe('1');

    view.unmount();
  });

  test('el modal inicia cerrado y calcula la hora al abrir, no al montar', async () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);
    await act(async () => Promise.resolve());

    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    act(() => jest.setSystemTime(new Date(2026, 7, 21, 10, 15)));
    act(() => view.button('Registrar Bitácora').click());

    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(view.container.querySelector('#bitacora-ocurrido-at').value).toBe('2026-08-21T10:15');

    view.unmount();
  });

  test('Cancelar descarta detalle y fecha, pero conserva la última Ubicación', async () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);
    await act(async () => Promise.resolve());
    act(() => view.button('Registrar Bitácora').click());

    act(() => {
      setValue(view.container.querySelector('#bitacora-ubicacion'), '8');
      setValue(view.container.querySelector('#bitacora-ocurrido-at'), '2026-08-21T09:30');
      setValue(view.container.querySelector('#bitacora-detalle'), 'Borrador descartado');
      view.button('Cancelar').click();
    });

    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    act(() => jest.setSystemTime(new Date(2026, 7, 21, 10, 20)));
    act(() => view.button('Registrar Bitácora').click());

    expect(view.container.querySelector('#bitacora-ubicacion').value).toBe('8');
    expect(view.container.querySelector('#bitacora-detalle').value).toBe('');
    expect(view.container.querySelector('#bitacora-ocurrido-at').value).toBe('2026-08-21T10:20');
    expect(view.container.querySelector('#bitacora-manzana')?.value || '').toBe('');
    expect(view.container.querySelector('#bitacora-villa')).toBeNull();

    view.unmount();
  });

  test('cerrar y reabrir conserva Ubicación urbana pero reinicia Manzana y Villa', async () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);
    await act(async () => Promise.resolve());
    act(() => view.button('Registrar Bitácora').click());
    await changeAndFlush(view.container.querySelector('#bitacora-ubicacion'), '8');
    await selectSearchOption(
      view.container,
      view.container.querySelector('#bitacora-manzana'),
      'Manzana A'
    );
    await selectSearchOption(
      view.container,
      view.container.querySelector('#bitacora-villa'),
      'A-1'
    );
    act(() => view.button('Cancelar').click());

    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    act(() => view.button('Registrar Bitácora').click());
    await act(async () => {
      await flushPromises();
    });

    expect(view.container.querySelector('#bitacora-ubicacion').value).toBe('8');
    expect(view.container.querySelector('#bitacora-manzana').value).toBe('');
    expect(view.container.querySelector('#bitacora-villa')).toBeNull();
    view.unmount();
  });

  test('éxito cierra modal y al reabrir conserva Ubicación con hora nueva', async () => {
    const showToast = jest.fn();
    useToast.mockReturnValue({ showToast });
    bitacorasService.createRegistro.mockResolvedValue({ success: true, message: 'Creada' });
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);
    await act(async () => Promise.resolve());
    act(() => view.button('Registrar Bitácora').click());
    act(() => {
      setValue(view.container.querySelector('#bitacora-ubicacion'), '7');
      setValue(view.container.querySelector('#bitacora-detalle'), 'Novedad');
    });

    await act(async () => {
      view.container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Creada', 'success');
    act(() => jest.setSystemTime(new Date(2026, 7, 21, 10, 25)));
    act(() => view.button('Registrar Bitácora').click());
    expect(view.container.querySelector('#bitacora-ubicacion').value).toBe('7');
    expect(view.container.querySelector('#bitacora-ocurrido-at').value).toBe('2026-08-21T10:25');
    expect(bitacorasService.getUbicaciones).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  test('éxito con ambos permisos invalida el historial exactamente una vez', async () => {
    bitacorasService.createRegistro.mockResolvedValue({ success: true, message: 'Creada' });
    const view = renderBitacoras([
      PERMISSIONS.BITACORAS_REGISTRO_CREAR,
      PERMISSIONS.BITACORAS_HISTORIAL_VER,
    ]);
    await act(async () => Promise.resolve());

    const history = view.container.querySelector('[data-testid="historial-bitacoras"]');
    expect(history.dataset.refreshKey).toBe('0');
    act(() => view.button('Registrar Bitácora').click());
    act(() => {
      setValue(view.container.querySelector('#bitacora-ubicacion'), '7');
      setValue(view.container.querySelector('#bitacora-detalle'), 'Novedad');
    });

    await act(async () => {
      view.container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    expect(history.dataset.refreshKey).toBe('1');
    view.unmount();
  });

  test('éxito con solo crear cierra modal sin montar ni invalidar historial', async () => {
    bitacorasService.createRegistro.mockResolvedValue({ success: true, message: 'Creada' });
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);
    await act(async () => Promise.resolve());
    act(() => view.button('Registrar Bitácora').click());
    act(() => {
      setValue(view.container.querySelector('#bitacora-ubicacion'), '7');
      setValue(view.container.querySelector('#bitacora-detalle'), 'Novedad');
    });

    await act(async () => {
      view.container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="historial-bitacoras"]')).toBeNull();
    expect(bitacorasService.getRegistros).not.toHaveBeenCalled();
    view.unmount();
  });

  test('muestra loading, error y retry dentro del modal', async () => {
    let resolveInitial;
    bitacorasService.getUbicaciones
      .mockReturnValueOnce(new Promise((resolve) => (resolveInitial = resolve)))
      .mockResolvedValueOnce({ success: true, data: [] });
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);
    act(() => view.button('Registrar Bitácora').click());
    expect(view.container.textContent).toContain('Cargando Ubicaciones');

    await act(async () => resolveInitial({ success: false, status: 500 }));
    expect(view.container.textContent).toContain('Ocurrió un error interno');
    await act(async () => {
      view.button('Reintentar').click();
      await Promise.resolve();
    });
    expect(view.container.textContent).toContain('No tienes Ubicaciones disponibles');
    expect(bitacorasService.getUbicaciones).toHaveBeenCalledTimes(2);

    view.unmount();
  });
});
