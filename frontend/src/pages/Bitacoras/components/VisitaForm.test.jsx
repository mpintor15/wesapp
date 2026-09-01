import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import bitacorasService from '../../../services/bitacorasService';
import VisitaForm from './VisitaForm';

jest.mock('../../../services/bitacorasService', () => ({
  __esModule: true,
  default: {
    getManzanas: jest.fn(),
    getVillas: jest.fn(),
    getFormularioVisitasActivo: jest.fn(),
    createVisita: jest.fn(),
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ubicaciones = [
  { id: 1, nombre: 'Garita', tipo_punto: 'GENERAL' },
  { id: 2, nombre: 'Urb Norte', tipo_punto: 'URBANIZACION' },
];

const setValue = (element, value) => {
  const prototype =
    element instanceof globalThis.HTMLSelectElement
      ? globalThis.HTMLSelectElement.prototype
      : globalThis.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const selectOption = async (container, input, label) => {
  await act(async () => {
    input.dispatchEvent(new globalThis.FocusEvent('focusin', { bubbles: true }));
    await flush();
  });
  const option = Array.from(container.querySelectorAll('[role="option"]')).find(
    (item) => item.textContent === label
  );
  expect(option).not.toBeUndefined();
  await act(async () => {
    option.dispatchEvent(new globalThis.MouseEvent('mousedown', { bubbles: true }));
    option.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }));
    await flush();
  });
};

const renderForm = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSuccess = jest.fn();
  const showToast = jest.fn();
  act(() =>
    root.render(
      <VisitaForm
        isOpen
        ubicaciones={ubicaciones}
        onClose={jest.fn()}
        onSuccess={onSuccess}
        showToast={showToast}
      />
    )
  );
  return {
    container,
    onSuccess,
    showToast,
    unmount: () => act(() => root.unmount()),
  };
};

describe('VisitaForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bitacorasService.getManzanas.mockResolvedValue({
      success: true,
      data: [{ id: 10, nombre: 'A' }],
    });
    bitacorasService.getVillas.mockResolvedValue({
      success: true,
      data: [
        {
          id: 20,
          identificador: '1',
          residente_principal_nombre: 'Ana Titular',
        },
      ],
    });
    bitacorasService.getFormularioVisitasActivo.mockResolvedValue({
      success: true,
      data: {
        id: 30,
        tipos: [
          { id: 900, form_version_id: 30, nombre: 'Peatón', sort_order: 1 },
          { id: 901, form_version_id: 30, nombre: 'Vehículo', sort_order: 2 },
        ],
        fields: [
          {
            field_key: 'motivo',
            label: 'Motivo',
            type: 'select',
            required: true,
            options: ['Entrega', 'Visita'],
          },
        ],
      },
    });
    bitacorasService.createVisita.mockResolvedValue({
      success: true,
      message: 'Visita registrada',
    });
  });

  test('usa solo Urbanizaciones, exige Casa/titular/formulario y envía payload estricto', async () => {
    const view = renderForm();
    await act(async () => flush());

    const location = view.container.querySelector('#visita-ubicacion');
    expect(location.textContent).toContain('Urb Norte');
    expect(location.textContent).not.toContain('Garita');

    await act(async () => {
      setValue(location, '2');
      await flush();
    });
    expect(bitacorasService.getFormularioVisitasActivo).toHaveBeenCalledWith('2');
    await selectOption(view.container, view.container.querySelector('#visita-manzana'), 'A');
    await selectOption(view.container, view.container.querySelector('#visita-villa'), '1');
    expect(view.container.textContent).toContain('Titular: Ana Titular');

    await act(async () => {
      setValue(view.container.querySelector('#visita-visitante_nombre'), ' Carlos ');
      setValue(view.container.querySelector('#visita-visitante_documento'), '0912345678');
      setValue(view.container.querySelector('#visita-visitante_telefono'), '0991234567');
      setValue(view.container.querySelector('#visita-tipo-visita'), '901');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('#visita-placa'), 'abc123');
      setValue(view.container.querySelector('#visita-respuesta-motivo'), 'Entrega');
      view.container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(bitacorasService.createVisita).toHaveBeenCalledWith({
      ubicacion_id: 2,
      manzana_id: 10,
      villa_id: 20,
      visitante_nombre: 'Carlos',
      visitante_documento: '0912345678',
      visitante_telefono: '0991234567',
      tipo_visita_id: 901,
      placa: 'ABC123',
      respuestas: { motivo: 'Entrega' },
    });
    expect(view.onSuccess).toHaveBeenCalled();
    view.unmount();
  });

  test('exige seleccionar un Tipo de visita y acepta registrar sin placa para cualquier tipo', async () => {
    const view = renderForm();
    await act(async () => flush());
    await act(async () => {
      setValue(view.container.querySelector('#visita-ubicacion'), '2');
      await flush();
    });
    await selectOption(view.container, view.container.querySelector('#visita-manzana'), 'A');
    await selectOption(view.container, view.container.querySelector('#visita-villa'), '1');

    await act(async () => {
      setValue(view.container.querySelector('#visita-visitante_nombre'), 'Carlos');
      setValue(view.container.querySelector('#visita-visitante_documento'), '0912345678');
      setValue(view.container.querySelector('#visita-visitante_telefono'), '0991234567');
      view.container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });
    expect(view.container.textContent).toContain('Selecciona el tipo de visita');
    expect(bitacorasService.createVisita).not.toHaveBeenCalled();

    await act(async () => {
      setValue(view.container.querySelector('#visita-tipo-visita'), '900');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('#visita-respuesta-motivo'), 'Entrega');
      view.container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });
    expect(bitacorasService.createVisita).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_visita_id: 900, placa: undefined })
    );
    view.unmount();
  });

  test('Cédula acepta solo números y exige exactamente 10 dígitos', async () => {
    const view = renderForm();
    const documentInput = view.container.querySelector('#visita-visitante_documento');
    await act(async () => {
      setValue(documentInput, '09a12-3456789');
      await flush();
    });
    expect(documentInput.value).toBe('0912345678');
    expect(documentInput.inputMode).toBe('numeric');
    expect(documentInput.maxLength).toBe(10);
    expect(view.container.textContent).toContain('Cédula');
    view.unmount();
  });

  test('normaliza y valida preguntas configurables Cédula y Placa', async () => {
    bitacorasService.getFormularioVisitasActivo.mockResolvedValue({
      success: true,
      data: {
        id: 30,
        tipos: [{ id: 900, form_version_id: 30, nombre: 'Peatón', sort_order: 1 }],
        fields: [
          {
            field_key: 'cedula_extra',
            label: 'Cédula adicional',
            type: 'cedula',
            required: false,
            options: [],
          },
          {
            field_key: 'placa_extra',
            label: 'Placa adicional',
            type: 'placa',
            required: false,
            options: [],
          },
        ],
      },
    });
    const view = renderForm();
    await act(async () => {
      setValue(view.container.querySelector('#visita-ubicacion'), '2');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('#visita-tipo-visita'), '900');
      await flush();
    });
    const cedula = view.container.querySelector('#visita-respuesta-cedula_extra');
    const placa = view.container.querySelector('#visita-respuesta-placa_extra');
    await act(async () => {
      setValue(cedula, '09a123456');
      setValue(placa, 'ab-12!');
      await flush();
    });
    expect(cedula.value).toBe('09123456');
    expect(placa.value).toBe('AB12');

    await act(async () => {
      view.container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });
    expect(view.container.textContent).toContain('Cédula adicional debe tener 10 dígitos');
    expect(view.container.textContent).toContain(
      'Placa adicional debe tener entre 5 y 10 letras o números'
    );
    expect(bitacorasService.createVisita).not.toHaveBeenCalled();
    view.unmount();
  });

  test('no muestra preguntas hasta seleccionar un Tipo de visita, y luego solo las aplicables', async () => {
    bitacorasService.getFormularioVisitasActivo.mockResolvedValue({
      success: true,
      data: {
        id: 30,
        mostrar_fecha_hora: true,
        tipos: [
          { id: 900, form_version_id: 30, nombre: 'Peatón', sort_order: 1 },
          { id: 901, form_version_id: 30, nombre: 'Vehículo', sort_order: 2 },
        ],
        fields: [
          {
            field_key: 'peaton_detalle',
            label: 'Detalle peatonal',
            type: 'text',
            required: true,
            aplica_a: 'SELECCIONADOS',
            tipos: [900],
          },
          {
            field_key: 'vehiculo_detalle',
            label: 'Detalle vehicular',
            type: 'text',
            required: true,
            aplica_a: 'SELECCIONADOS',
            tipos: [901],
          },
        ],
      },
    });
    const view = renderForm();
    await act(async () => {
      setValue(view.container.querySelector('#visita-ubicacion'), '2');
      await flush();
    });
    expect(view.container.textContent).not.toContain('Detalle peatonal');
    expect(view.container.textContent).not.toContain('Detalle vehicular');

    await act(async () => {
      setValue(view.container.querySelector('#visita-tipo-visita'), '900');
      await flush();
    });
    expect(view.container.textContent).toContain('Detalle peatonal');
    expect(view.container.textContent).not.toContain('Detalle vehicular');
    expect(view.container.textContent).toContain('se registrarán automáticamente');
    view.unmount();
  });

  test('bloquea registro cuando no hay formulario activo', async () => {
    bitacorasService.getFormularioVisitasActivo.mockResolvedValue({
      success: false,
      status: 404,
      message: 'No hay formulario activo',
    });
    const view = renderForm();
    await act(async () => flush());
    await act(async () => {
      setValue(view.container.querySelector('#visita-ubicacion'), '2');
      await flush();
    });

    await act(async () => {
      view.container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(view.container.textContent).toContain('Publica un formulario activo');
    expect(bitacorasService.createVisita).not.toHaveBeenCalled();
    view.unmount();
  });
});
