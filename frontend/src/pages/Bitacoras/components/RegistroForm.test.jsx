import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import bitacorasService from '../../../services/bitacorasService';
import RegistroForm from './RegistroForm';

jest.mock('../../../services/bitacorasService', () => ({
  __esModule: true,
  default: { createRegistro: jest.fn(), getManzanas: jest.fn(), getVillas: jest.fn() },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LOCATIONS = [
  { id: 7, nombre: 'Garita principal', cliente_nombre: 'Cliente X', tipo_punto: 'GENERAL' },
  { id: 8, nombre: 'Urbanización Norte', cliente_nombre: 'Cliente X', tipo_punto: 'URBANIZACION' },
];
const BLOCKS = [
  { id: 31, nombre: 'Manzana A' },
  { id: 32, nombre: 'Manzana B' },
];
const VILLAS = [
  {
    id: 41,
    identificador: 'A-1',
    residente_principal_nombre: 'Ana Titular',
    residente_principal_contacto: '0991234567',
  },
  {
    id: 42,
    identificador: 'A-2',
    residente_principal_nombre: 'Luis Titular',
    residente_principal_contacto: '0987654321',
  },
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

const getOptionByText = (container, text) =>
  Array.from(container.querySelectorAll('[role="option"]')).find(
    (option) => option.textContent === text
  );

const selectSearchOption = async (view, input, text, cycles = 3) => {
  await act(async () => {
    input.focus();
    input.dispatchEvent(new globalThis.FocusEvent('focusin', { bubbles: true }));
    input.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }));
    await flushPromises();
  });
  let option = getOptionByText(view.container, text);
  if (!option) {
    await act(async () => {
      setValue(input, '');
      await flushPromises();
    });
    option = getOptionByText(view.container, text);
  }
  expect(option).not.toBeUndefined();
  await act(async () => {
    option.dispatchEvent(new globalThis.MouseEvent('mousedown', { bubbles: true }));
    option.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }));
    await flushPromises(cycles);
  });
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
    block: () => container.querySelector('#bitacora-manzana'),
    villa: () => container.querySelector('#bitacora-villa'),
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
    bitacorasService.getManzanas.mockResolvedValue({ success: true, data: BLOCKS });
    bitacorasService.getVillas.mockResolvedValue({ success: true, data: VILLAS });
  });

  afterEach(() => jest.useRealTimers());

  test('renderiza AppModal, hora local y opciones agrupadas', () => {
    const view = renderForm();

    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(view.container.textContent).toContain('Registrar Bitácora');
    expect(view.date().value).toBe('2026-08-21T08:35');
    expect(view.container.querySelector('optgroup').label).toBe('Cliente X');
    expect(view.container.textContent).toContain('Garita principal — GENERAL');
    expect(view.submit().disabled).toBe(true);

    fillValidForm(view);
    expect(view.submit().disabled).toBe(false);
    view.unmount();
  });

  test('GENERAL no muestra campos urbanos ni solicita opciones y envía payload mínimo', async () => {
    bitacorasService.createRegistro.mockResolvedValue({ success: true, message: 'Creada' });
    const view = renderForm();
    fillValidForm(view);

    expect(view.block()).toBeNull();
    expect(view.villa()).toBeNull();
    expect(bitacorasService.getManzanas).not.toHaveBeenCalled();

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(bitacorasService.createRegistro).toHaveBeenCalledWith({
      ubicacion_id: 7,
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad\ncon detalle',
    });
    expect(bitacorasService.createRegistro.mock.calls[0][0]).not.toHaveProperty('manzana_id');
    expect(bitacorasService.createRegistro.mock.calls[0][0]).not.toHaveProperty('villa_id');
    view.unmount();
  });

  test('URBANIZACION exige Casa completa, carga Villas con titular y envía Manzana/Villa', async () => {
    bitacorasService.createRegistro.mockResolvedValue({ success: false, status: 500 });
    const view = renderForm();

    await changeAndFlush(view.location(), '8');

    expect(bitacorasService.getManzanas).toHaveBeenCalledWith('8');
    expect(view.block()).not.toBeNull();
    expect(view.submit().disabled).toBe(true);
    expect(view.block().placeholder).toBe('Selecciona una Manzana');
    await act(async () => {
      view.block().dispatchEvent(new globalThis.FocusEvent('focusin', { bubbles: true }));
      await flushPromises();
    });
    expect(getOptionByText(view.container, 'Manzana A')).not.toBeUndefined();
    act(() => setValue(view.block(), 'B'));
    expect(getOptionByText(view.container, 'Manzana A')).toBeUndefined();
    expect(getOptionByText(view.container, 'Manzana B')).not.toBeUndefined();
    act(() => setValue(view.block(), ''));
    expect(view.villa()).toBeNull();

    act(() => {
      setValue(view.date(), '2026-08-21T08:30');
      setValue(view.detail(), 'Novedad urbana');
    });
    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(bitacorasService.createRegistro).not.toHaveBeenCalled();
    expect(view.block().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(view.block());

    await selectSearchOption(view, view.block(), 'Manzana A');
    expect(bitacorasService.getVillas).toHaveBeenCalledWith('31');
    expect(view.villa()).not.toBeNull();
    expect(view.villa().placeholder).toBe('Selecciona una Villa');
    expect(view.submit().disabled).toBe(true);
    await act(async () => {
      view.villa().dispatchEvent(new globalThis.FocusEvent('focusin', { bubbles: true }));
      await flushPromises();
    });
    expect(getOptionByText(view.container, 'A-1')).not.toBeUndefined();

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(bitacorasService.createRegistro).not.toHaveBeenCalled();
    expect(view.villa().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(view.villa());

    await selectSearchOption(view, view.villa(), 'A-1');
    expect(view.container.textContent).toContain('Titular: Ana Titular · 0991234567');
    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(bitacorasService.createRegistro).toHaveBeenLastCalledWith({
      ubicacion_id: 8,
      manzana_id: 31,
      villa_id: 41,
      ocurrido_at: '2026-08-21T08:30',
      detalle: 'Novedad urbana',
    });
    view.unmount();
  });

  test('cambiar Ubicación limpia Manzana/Villa y evita respuestas viejas de Manzanas', async () => {
    let resolveOldManzanas;
    bitacorasService.getManzanas
      .mockReturnValueOnce(new Promise((resolve) => (resolveOldManzanas = resolve)))
      .mockResolvedValueOnce({ success: true, data: [{ id: 35, nombre: 'Manzana Nueva' }] });
    const view = renderForm({
      locations: [
        ...LOCATIONS,
        {
          id: 9,
          nombre: 'Urbanización Sur',
          cliente_nombre: 'Cliente X',
          tipo_punto: 'URBANIZACION',
        },
      ],
    });

    await changeAndFlush(view.location(), '8', 1);
    expect(view.block()?.disabled).toBe(true);

    await changeAndFlush(view.location(), '9');
    await act(async () => {
      view.block().dispatchEvent(new globalThis.FocusEvent('focusin', { bubbles: true }));
      await flushPromises();
    });
    expect(getOptionByText(view.container, 'Manzana Nueva')).not.toBeUndefined();

    await act(async () => {
      resolveOldManzanas({ success: true, data: [{ id: 31, nombre: 'Manzana Vieja' }] });
      await Promise.resolve();
    });
    expect(getOptionByText(view.container, 'Manzana Nueva')).not.toBeUndefined();
    expect(getOptionByText(view.container, 'Manzana Vieja')).toBeUndefined();
    expect(view.villa()).toBeNull();
    view.unmount();
  });

  test('cambiar Manzana limpia Villa y evita respuestas viejas de Villas', async () => {
    let resolveManzanaAVillas;
    let resolveManzanaBVillas;
    bitacorasService.getVillas
      .mockImplementationOnce(() => new Promise((resolve) => (resolveManzanaAVillas = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveManzanaBVillas = resolve)));
    const view = renderForm();

    await changeAndFlush(view.location(), '8');
    await selectSearchOption(view, view.block(), 'Manzana A', 1);
    expect(bitacorasService.getVillas).toHaveBeenCalledTimes(1);
    expect(view.villa()?.value || '').toBe('');

    await selectSearchOption(view, view.block(), 'Manzana B', 1);
    expect(view.villa()?.value || '').toBe('');
    expect(view.container.textContent).not.toContain('A-1 viejo');
    expect(bitacorasService.getVillas).toHaveBeenCalledTimes(2);
    expect(bitacorasService.getVillas).toHaveBeenLastCalledWith('32');

    await act(async () => {
      resolveManzanaBVillas({ success: true, data: [{ id: 45, identificador: 'B-1' }] });
      await flushPromises();
    });
    await act(async () => {
      view.villa().dispatchEvent(new globalThis.FocusEvent('focusin', { bubbles: true }));
      await flushPromises();
    });
    expect(getOptionByText(view.container, 'B-1')).not.toBeUndefined();
    expect(getOptionByText(view.container, 'A-1 viejo')).toBeUndefined();

    await act(async () => {
      resolveManzanaAVillas({ success: true, data: [{ id: 41, identificador: 'A-1 viejo' }] });
      await flushPromises();
    });
    expect(getOptionByText(view.container, 'B-1')).not.toBeUndefined();
    expect(getOptionByText(view.container, 'A-1 viejo')).toBeUndefined();
    expect(view.block().value).toBe('Manzana B');
    expect(view.villa().value).toBe('');
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

  test('cambiar Manzana invalida peticiones previas de Villas para evitar sobrescritura (bloqueador 1)', async () => {
    let resolveVillasA;
    let resolveVillasB;
    bitacorasService.getVillas
      .mockReturnValueOnce(new Promise((resolve) => (resolveVillasA = resolve)))
      .mockReturnValueOnce(new Promise((resolve) => (resolveVillasB = resolve)));

    const view = renderForm();
    await changeAndFlush(view.location(), '8');

    await selectSearchOption(view, view.block(), 'Manzana A', 1);
    await selectSearchOption(view, view.block(), 'Manzana B', 1);

    await act(async () => {
      resolveVillasB({ success: true, data: [{ id: 42, identificador: 'Villa Nueva' }] });
      await flushPromises();
    });
    await act(async () => {
      resolveVillasA({ success: true, data: [{ id: 41, identificador: 'Villa Vieja' }] });
      await flushPromises();
    });

    await act(async () => {
      view.villa().dispatchEvent(new globalThis.FocusEvent('focusin', { bubbles: true }));
      await flushPromises();
    });
    expect(getOptionByText(view.container, 'Villa Nueva')).not.toBeUndefined();
    expect(getOptionByText(view.container, 'Villa Vieja')).toBeUndefined();
    expect(view.block().value).toBe('Manzana B');
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

  test('404 de Ubicación inválida no recarga Manzanas con el ID stale', async () => {
    const onReload = jest.fn().mockResolvedValue([]);
    bitacorasService.createRegistro.mockResolvedValue({
      success: false,
      status: 404,
      code: 'LOCATION_NOT_FOUND',
      message: 'La Ubicación ya no está disponible',
    });
    const view = renderForm({ onReload });
    await changeAndFlush(view.location(), '8');
    await selectSearchOption(view, view.block(), 'Manzana A');
    await selectSearchOption(view, view.villa(), 'A-1');
    act(() => {
      setValue(view.date(), '2026-08-21T08:30');
      setValue(view.detail(), 'Novedad urbana');
    });
    expect(bitacorasService.getManzanas).toHaveBeenCalledWith('8');
    bitacorasService.getManzanas.mockClear();
    bitacorasService.getVillas.mockClear();

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(onReload).toHaveBeenCalledWith({ background: true });
    expect(view.location().value).toBe('');
    expect(view.block()).toBeNull();
    expect(view.villa()).toBeNull();
    expect(view.date().value).toBe('2026-08-21T08:30');
    expect(view.detail().value).toBe('Novedad urbana');
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(bitacorasService.getManzanas).not.toHaveBeenCalled();
    expect(bitacorasService.getVillas).not.toHaveBeenCalled();
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

  test('mapea errores backend de Manzana y Villa a sus controles', async () => {
    bitacorasService.createRegistro
      .mockResolvedValueOnce({
        success: false,
        status: 400,
        originalError: { response: { data: { errors: { manzana_id: ['Manzana inválida'] } } } },
      })
      .mockResolvedValueOnce({
        success: false,
        status: 400,
        originalError: { response: { data: { errors: { villa_id: ['Villa inválida'] } } } },
      });
    const view = renderForm();
    await changeAndFlush(view.location(), '8');
    await selectSearchOption(view, view.block(), 'Manzana A');
    await selectSearchOption(view, view.villa(), 'A-1');
    act(() => {
      setValue(view.date(), '2026-08-21T08:30');
      setValue(view.detail(), 'Novedad urbana');
    });

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(view.block().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(view.block());

    await selectSearchOption(view, view.block(), 'Manzana A');
    await selectSearchOption(view, view.villa(), 'A-1');
    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(view.villa().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(view.villa());
    view.unmount();
  });

  test('errores 404/409 de contexto urbano refrescan opciones sin borrar fecha ni detalle', async () => {
    bitacorasService.createRegistro.mockResolvedValue({
      success: false,
      status: 409,
      code: 'VILLA_INACTIVE',
      message: 'La Villa seleccionada está inactiva',
    });
    const view = renderForm();
    await changeAndFlush(view.location(), '8');
    await selectSearchOption(view, view.block(), 'Manzana A');
    await selectSearchOption(view, view.villa(), 'A-1');
    act(() => {
      setValue(view.date(), '2026-08-21T08:30');
      setValue(view.detail(), 'Novedad urbana');
    });

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(view.villa()?.value || '').toBe('');
    expect(view.block().value).toBe('Manzana A');
    expect(view.date().value).toBe('2026-08-21T08:30');
    expect(view.detail().value).toBe('Novedad urbana');
    expect(bitacorasService.getVillas).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  test('error 409 de Manzana limpia Manzana y Villa sin borrar fecha ni detalle', async () => {
    bitacorasService.createRegistro.mockResolvedValue({
      success: false,
      status: 409,
      code: 'BLOCK_INACTIVE',
      message: 'La Manzana seleccionada está inactiva',
    });
    const view = renderForm();
    await changeAndFlush(view.location(), '8');
    await selectSearchOption(view, view.block(), 'Manzana A');
    await selectSearchOption(view, view.villa(), 'A-1');
    act(() => {
      setValue(view.date(), '2026-08-21T08:30');
      setValue(view.detail(), 'Novedad urbana');
    });

    await act(async () => {
      view
        .form()
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(view.block().value).toBe('');
    expect(view.villa()).toBeNull();
    expect(view.date().value).toBe('2026-08-21T08:30');
    expect(view.detail().value).toBe('Novedad urbana');
    expect(bitacorasService.getManzanas).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  test('estados loading, error y empty de Manzana preservan el formulario', async () => {
    let resolveManzanas;
    bitacorasService.getManzanas
      .mockReturnValueOnce(new Promise((resolve) => (resolveManzanas = resolve)))
      .mockResolvedValueOnce({ success: false, status: 500 })
      .mockResolvedValueOnce({ success: true, data: [] });
    const view = renderForm();

    act(() => {
      setValue(view.location(), '8');
      setValue(view.date(), '2026-08-21T08:30');
      setValue(view.detail(), 'Novedad urbana');
    });
    expect(view.block().disabled).toBe(true);
    expect(view.container.textContent).toContain('Cargando Manzanas');

    await act(async () => {
      resolveManzanas({ success: true, data: BLOCKS });
      await flushPromises();
    });
    expect(view.block().disabled).toBe(false);

    await changeAndFlush(view.location(), '7', 1);
    await changeAndFlush(view.location(), '8');
    expect(view.container.textContent).toContain('Ocurrió un error interno');
    expect(view.date().value).toBe('2026-08-21T08:30');
    expect(view.detail().value).toBe('Novedad urbana');

    await act(async () => {
      view.button('Reintentar').click();
      await flushPromises();
    });
    expect(view.container.textContent).toContain('No hay Manzanas activas disponibles.');
    expect(view.date().value).toBe('2026-08-21T08:30');
    expect(view.detail().value).toBe('Novedad urbana');
    view.unmount();
  });

  test('estados error y empty de Villa preservan el formulario', async () => {
    bitacorasService.getVillas
      .mockResolvedValueOnce({ success: false, status: 500 })
      .mockResolvedValueOnce({ success: true, data: [] });
    const view = renderForm();

    await changeAndFlush(view.location(), '8');
    act(() => {
      setValue(view.date(), '2026-08-21T08:30');
      setValue(view.detail(), 'Novedad urbana');
    });
    await selectSearchOption(view, view.block(), 'Manzana A');
    expect(view.container.textContent).toContain('Ocurrió un error interno');

    await act(async () => {
      view.button('Reintentar').click();
      await flushPromises();
    });
    expect(view.container.textContent).toContain('No hay Villas con titular activo disponibles.');
    expect(view.block().value).toBe('Manzana A');
    expect(view.date().value).toBe('2026-08-21T08:30');
    expect(view.detail().value).toBe('Novedad urbana');
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
