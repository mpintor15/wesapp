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
    createRegistro: jest.fn(),
    getRegistros: jest.fn(),
  },
}));

jest.mock('./components/HistorialBitacoras', () => {
  const MockHistorialBitacoras = (props) => (
    <section
      data-testid="historial-bitacoras"
      data-location-count={props.ubicaciones.length}
      data-refresh-key={props.refreshKey}
    >
      Historial funcional
    </section>
  );
  MockHistorialBitacoras.displayName = 'MockHistorialBitacoras';
  return MockHistorialBitacoras;
});

jest.mock('../../hooks/useScrollToTopOnMount', () => jest.fn());

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LOCATIONS = [
  { id: 7, nombre: 'Garita principal', cliente_nombre: 'Cliente X', tipo_punto: 'GARITA' },
  { id: 8, nombre: 'Bodega', cliente_nombre: 'Cliente X', tipo_punto: 'BODEGA' },
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
  });

  afterEach(() => jest.useRealTimers());

  test('solo crear permite entrar y muestra la acción sin tabs', async () => {
    const view = renderBitacoras([PERMISSIONS.BITACORAS_REGISTRO_CREAR]);
    await act(async () => Promise.resolve());

    expect(view.button('Registrar Bitácora')).not.toBeUndefined();
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
    expect(view.container.querySelector('[role="tab"]')).toBeNull();
    expect(view.container.textContent).toContain('Historial funcional');

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
