import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import bitacorasService from '../../../services/bitacorasService';
import RegistroForm from './RegistroForm';

jest.mock('../../../services/bitacorasService', () => ({
  __esModule: true,
  default: { createRegistro: jest.fn() },
}));

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

const renderForm = ({
  locations = LOCATIONS,
  locationsLoading = false,
  locationsError = '',
  initialUbicacionId = '',
  onUbicacionChange = jest.fn(),
  onReload = jest.fn(),
  onClose = jest.fn(),
  onSuccess = jest.fn(),
  showToast = jest.fn(),
} = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <RegistroForm
        isOpen
        ubicaciones={locations}
        locationsLoading={locationsLoading}
        locationsError={locationsError}
        initialUbicacionId={initialUbicacionId}
        onUbicacionChange={onUbicacionChange}
        onReloadUbicaciones={onReload}
        onClose={onClose}
        onSuccess={onSuccess}
        showToast={showToast}
      />
    )
  );
  return {
    container,
    location: () => container.querySelector('#bitacora-ubicacion'),
    date: () => container.querySelector('#bitacora-ocurrido-at'),
    detail: () => container.querySelector('#bitacora-detalle'),
    submit: () => container.querySelector('button[type="submit"]'),
    button: (text) =>
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === text
      ),
    form: () => container.querySelector('form'),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const fillValidForm = (view) => {
  act(() => {
    setValue(view.location(), '7');
    setValue(view.date(), '2026-08-21T08:30');
    setValue(view.detail(), '  Novedad\ncon detalle  ');
  });
};

describe('RegistroForm modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 21, 8, 35));
  });

  afterEach(() => jest.useRealTimers());

  test('renderiza AppModal, hora local y opciones agrupadas', () => {
    const view = renderForm();

    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(view.container.textContent).toContain('Registrar Bitácora');
    expect(view.date().value).toBe('2026-08-21T08:35');
    expect(view.container.querySelector('optgroup').label).toBe('Cliente X');
    expect(view.container.textContent).toContain('Garita principal — GARITA');
    expect(view.submit().disabled).toBe(true);

    fillValidForm(view);
    expect(view.submit().disabled).toBe(false);
    view.unmount();
  });

  test('preselecciona una única Ubicación y conserva selección inicial válida', () => {
    const onUbicacionChange = jest.fn();
    const single = renderForm({ locations: [LOCATIONS[0]], onUbicacionChange });
    expect(single.location().value).toBe('7');
    expect(onUbicacionChange).toHaveBeenCalledWith('7');
    single.unmount();

    const remembered = renderForm({ initialUbicacionId: '8' });
    expect(remembered.location().value).toBe('8');
    remembered.unmount();
  });

  test('Cancelar y X cierran sin POST', () => {
    const onClose = jest.fn();
    const view = renderForm({ onClose });
    act(() => view.button('Cancelar').click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(bitacorasService.createRegistro).not.toHaveBeenCalled();
    act(() => view.container.querySelector('.app-modal__close').click());
    expect(onClose).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  test('rechaza detalle whitespace y enfoca el primer campo inválido', async () => {
    const view = renderForm();
    act(() => setValue(view.detail(), '   '));

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(view.location());
    expect(view.location().getAttribute('aria-invalid')).toBe('true');
    expect(bitacorasService.createRegistro).not.toHaveBeenCalled();
    view.unmount();
  });

  test('envía payload exacto local y bloquea doble submit', async () => {
    let resolveRequest;
    bitacorasService.createRegistro.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    const view = renderForm();
    fillValidForm(view);

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(bitacorasService.createRegistro).toHaveBeenCalledTimes(1);
    expect(bitacorasService.createRegistro).toHaveBeenCalledWith({
      ubicacion_id: 7,
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad\ncon detalle',
    });
    expect(bitacorasService.createRegistro.mock.calls[0][0].ocurrido_at).not.toMatch(
      /Z|[+-]\d{2}:\d{2}$/
    );
    expect(view.submit().disabled).toBe(true);

    await act(async () => resolveRequest({ success: false, status: 500 }));
    view.unmount();
  });

  test('en éxito muestra toast y solicita cerrar conservando selección externa', async () => {
    const showToast = jest.fn();
    const onSuccess = jest.fn();
    const onUbicacionChange = jest.fn();
    bitacorasService.createRegistro.mockResolvedValue({ success: true, message: 'Creada' });
    const view = renderForm({ showToast, onSuccess, onUbicacionChange });
    fillValidForm(view);

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(showToast).toHaveBeenCalledWith('Creada', 'success');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onUbicacionChange).toHaveBeenCalledWith('7');
    view.unmount();
  });

  test.each([403, 404])(
    'en %s recarga alcance, conserva texto/fecha y limpia selección ausente',
    async (status) => {
      const onReload = jest.fn().mockResolvedValue([]);
      const onUbicacionChange = jest.fn();
      bitacorasService.createRegistro.mockResolvedValue({ success: false, status });
      const view = renderForm({ onReload, onUbicacionChange });
      fillValidForm(view);

      await act(async () => {
        view
          .form()
          .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });

      expect(onReload).toHaveBeenCalledWith({ background: true });
      expect(view.location().value).toBe('');
      expect(view.date().value).toBe('2026-08-21T08:30');
      expect(view.detail().value).toBe('  Novedad\ncon detalle  ');
      expect(onUbicacionChange).toHaveBeenLastCalledWith('');
      view.unmount();
    }
  );

  test.each([
    [400, { errors: { detalle: ['Detalle inválido'] } }],
    [409, {}],
    [500, {}],
    [undefined, {}],
  ])('mantiene modal y formulario ante error %s', async (status, body) => {
    const showToast = jest.fn();
    const onSuccess = jest.fn();
    bitacorasService.createRegistro.mockResolvedValue({
      success: false,
      status,
      isNetworkError: status === undefined,
      originalError: { response: { data: body } },
    });
    const view = renderForm({ showToast, onSuccess });
    fillValidForm(view);

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(view.location().value).toBe('7');
    expect(view.detail().value).toContain('Novedad');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    if (status === 400) {
      expect(view.detail().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(view.detail());
    }
    view.unmount();
  });

  test('loading, error y empty permanecen dentro del modal con submit deshabilitado', () => {
    const loading = renderForm({ locations: [], locationsLoading: true });
    expect(loading.container.textContent).toContain('Cargando Ubicaciones');
    expect(loading.submit().disabled).toBe(true);
    loading.unmount();

    const error = renderForm({ locations: [], locationsError: 'No disponible' });
    expect(error.container.textContent).toContain('No disponible');
    expect(error.button('Reintentar')).not.toBeUndefined();
    error.unmount();

    const empty = renderForm({ locations: [] });
    expect(empty.container.textContent).toContain('No tienes Ubicaciones disponibles');
    expect(empty.submit().disabled).toBe(true);
    empty.unmount();
  });
});
