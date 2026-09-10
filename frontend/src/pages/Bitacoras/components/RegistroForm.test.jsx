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

const renderForm = (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const defaults = {
    isOpen: true,
    ubicaciones: LOCATIONS,
    locationsLoading: false,
    locationsError: '',
    initialUbicacionId: '',
    onUbicacionChange: jest.fn(),
    onReloadUbicaciones: jest.fn(),
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    showToast: jest.fn(),
  };
  const merged = { ...defaults, ...props };
  act(() => root.render(<RegistroForm {...merged} />));
  return {
    ...merged,
    container,
    location: () => container.querySelector('#bitacora-ubicacion'),
    date: () => container.querySelector('#bitacora-ocurrido-at'),
    detail: () => container.querySelector('#bitacora-detalle'),
    form: () => container.querySelector('form'),
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

const fillAndSubmit = async (view, location = '8') => {
  act(() => {
    setValue(view.location(), location);
    setValue(view.date(), '2026-08-21T08:30');
    setValue(view.detail(), '  Novedad con detalle  ');
  });
  await act(async () => {
    view.form().dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
};

describe('RegistroForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 21, 8, 35));
  });

  afterEach(() => jest.useRealTimers());

  test('registra una nota libre sin exigir Manzana ni Villa', async () => {
    bitacorasService.createRegistro.mockResolvedValue({ success: true, message: 'Creada' });
    const view = renderForm();

    expect(view.container.querySelector('#bitacora-manzana')).toBeNull();
    expect(view.container.querySelector('#bitacora-villa')).toBeNull();
    await fillAndSubmit(view);

    expect(bitacorasService.createRegistro).toHaveBeenCalledWith({
      ubicacion_id: 8,
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad con detalle',
    });
    expect(view.onSuccess).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  test('valida los tres campos requeridos', () => {
    const view = renderForm();
    act(() => {
      setValue(view.date(), '');
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(view.container.textContent).toContain('Selecciona una Ubicación');
    expect(view.container.textContent).toContain('Ingresa una fecha y hora válidas');
    expect(view.container.textContent).toContain('Ingresa el detalle de la novedad');
    expect(bitacorasService.createRegistro).not.toHaveBeenCalled();
    view.unmount();
  });

  test('muestra carga, error y estado vacío de Ubicaciones', () => {
    const loading = renderForm({ ubicaciones: [], locationsLoading: true });
    expect(loading.container.textContent).toContain('Cargando Ubicaciones');
    loading.unmount();

    const retry = jest.fn();
    const error = renderForm({
      ubicaciones: [],
      locationsError: 'Sin conexión',
      onReloadUbicaciones: retry,
    });
    act(() => error.button('Reintentar').click());
    expect(retry).toHaveBeenCalledTimes(1);
    error.unmount();

    const empty = renderForm({ ubicaciones: [] });
    expect(empty.container.textContent).toContain('No tienes Ubicaciones disponibles');
    empty.unmount();
  });

  test('refresca y limpia una Ubicación que perdió acceso', async () => {
    bitacorasService.createRegistro.mockResolvedValue({
      success: false,
      status: 403,
      message: 'Sin acceso',
    });
    const reload = jest.fn().mockResolvedValue([LOCATIONS[0]]);
    const view = renderForm({ onReloadUbicaciones: reload });

    await fillAndSubmit(view);

    expect(reload).toHaveBeenCalledWith({ background: true });
    expect(view.location().value).toBe('');
    expect(view.showToast).toHaveBeenCalledWith(
      'No tienes permisos para realizar esta acción.',
      'error'
    );
    view.unmount();
  });
});
