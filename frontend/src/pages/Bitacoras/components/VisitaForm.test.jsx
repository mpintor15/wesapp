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
      : element instanceof globalThis.HTMLTextAreaElement
        ? globalThis.HTMLTextAreaElement.prototype
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

const submitForm = async (container) => {
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Visita autorizada')
      .click();
    await flush();
  });
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
          residente_principal_contacto: '0991112222',
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

  test('usa solo Urbanizaciones, exige Casa/formulario y envía payload estricto sin datos fijos de visitante', async () => {
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
    expect(view.container.textContent).toContain('0991112222');

    await act(async () => {
      setValue(view.container.querySelector('#visita-tipo-visita'), '901');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('#visita-respuesta-motivo'), 'Entrega');
      await flush();
    });
    await submitForm(view.container);

    expect(bitacorasService.createVisita).toHaveBeenCalledWith({
      ubicacion_id: 2,
      manzana_id: 10,
      villa_id: 20,
      tipo_visita_id: 901,
      respuestas: { motivo: 'Entrega' },
      grupos: {},
      autorizada: true,
      motivo_no_autorizacion: undefined,
    });
    expect(view.onSuccess).toHaveBeenCalled();
    view.unmount();
  });

  test('no expone campos fijos de Visitante/Cédula/Teléfono/Placa en el modal', async () => {
    const view = renderForm();
    await act(async () => flush());
    expect(view.container.querySelector('#visita-visitante_nombre')).toBeNull();
    expect(view.container.querySelector('#visita-visitante_documento')).toBeNull();
    expect(view.container.querySelector('#visita-visitante_telefono')).toBeNull();
    expect(view.container.querySelector('#visita-placa')).toBeNull();
    view.unmount();
  });

  test('exige seleccionar un Tipo de visita antes de registrar', async () => {
    const view = renderForm();
    await act(async () => flush());
    await act(async () => {
      setValue(view.container.querySelector('#visita-ubicacion'), '2');
      await flush();
    });
    await selectOption(view.container, view.container.querySelector('#visita-manzana'), 'A');
    await selectOption(view.container, view.container.querySelector('#visita-villa'), '1');

    await submitForm(view.container);
    expect(view.container.textContent).toContain('Selecciona el tipo de visita');
    expect(bitacorasService.createVisita).not.toHaveBeenCalled();

    await act(async () => {
      setValue(view.container.querySelector('#visita-tipo-visita'), '900');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('#visita-respuesta-motivo'), 'Entrega');
      await flush();
    });
    await submitForm(view.container);
    expect(bitacorasService.createVisita).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_visita_id: 900 })
    );
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

    await submitForm(view.container);
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

  test('pregunta requerida y aplicable solo a un tipo específico se renderiza y valida como requerida al elegir ese tipo (regresión)', async () => {
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
            field_key: 'nombre_visita',
            label: 'Nombre de la visita',
            type: 'text',
            required: true,
            aplica_a: 'SELECCIONADOS',
            tipos: [900],
          },
        ],
      },
    });
    const view = renderForm();
    await act(async () => {
      setValue(view.container.querySelector('#visita-ubicacion'), '2');
      await flush();
    });
    await selectOption(view.container, view.container.querySelector('#visita-manzana'), 'A');
    await selectOption(view.container, view.container.querySelector('#visita-villa'), '1');
    await act(async () => {
      setValue(view.container.querySelector('#visita-tipo-visita'), '900');
      await flush();
    });

    const label = Array.from(view.container.querySelectorAll('label')).find((element) =>
      element.textContent.startsWith('Nombre de la visita')
    );
    expect(label.textContent).toContain('*');

    await submitForm(view.container);
    expect(view.container.textContent).toContain('Nombre de la visita es requerido.');
    expect(bitacorasService.createVisita).not.toHaveBeenCalled();

    await act(async () => {
      setValue(view.container.querySelector('#visita-respuesta-nombre_visita'), 'Juan Pérez');
      await flush();
    });
    await submitForm(view.container);
    expect(bitacorasService.createVisita).toHaveBeenCalledWith(
      expect.objectContaining({ respuestas: { nombre_visita: 'Juan Pérez' } })
    );
    view.unmount();
  });

  test('grupo repetible de Visitantes: agrega/quita personas, exige mínimo y campos requeridos por registro', async () => {
    bitacorasService.getFormularioVisitasActivo.mockResolvedValue({
      success: true,
      data: {
        id: 30,
        tipos: [{ id: 900, form_version_id: 30, nombre: 'Peatón', sort_order: 1 }],
        fields: [],
        groups: [
          {
            group_key: 'visitantes',
            label: 'Visitantes',
            min_count: 1,
            aplica_a: 'TODOS',
            fields: [
              { field_key: 'nombre', label: 'Nombre', type: 'text', required: true },
              { field_key: 'cedula', label: 'Cédula', type: 'cedula', required: true },
              { field_key: 'telefono', label: 'Teléfono', type: 'text', required: false },
            ],
          },
        ],
      },
    });
    const view = renderForm();
    await act(async () => {
      setValue(view.container.querySelector('#visita-ubicacion'), '2');
      await flush();
    });
    await selectOption(view.container, view.container.querySelector('#visita-manzana'), 'A');
    await selectOption(view.container, view.container.querySelector('#visita-villa'), '1');
    await act(async () => {
      setValue(view.container.querySelector('#visita-tipo-visita'), '900');
      await flush();
    });

    expect(view.container.textContent).toContain('Visitantes');
    expect(view.container.querySelector('#visita-grupo-visitantes-0-nombre')).toBeNull();

    // Sin ninguna persona agregada, min_count 1 debe bloquear el envío.
    await submitForm(view.container);
    expect(view.container.textContent).toContain('Agrega al menos 1 registro(s) de Visitantes.');
    expect(bitacorasService.createVisita).not.toHaveBeenCalled();

    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === '+ Agregar Visitantes')
        .click();
      await flush();
    });
    expect(view.container.querySelector('#visita-grupo-visitantes-0-nombre')).not.toBeNull();

    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === '+ Agregar Visitantes')
        .click();
      await flush();
    });
    expect(view.container.querySelector('#visita-grupo-visitantes-1-nombre')).not.toBeNull();

    // Persona 1 completa, Persona 2 sin cédula (requerida) -> bloquea.
    await act(async () => {
      setValue(view.container.querySelector('#visita-grupo-visitantes-0-nombre'), 'Ana');
      setValue(view.container.querySelector('#visita-grupo-visitantes-0-cedula'), '0912345678');
      setValue(view.container.querySelector('#visita-grupo-visitantes-1-nombre'), 'Luis');
      await flush();
    });
    await submitForm(view.container);
    expect(view.container.textContent).toContain('Cédula es requerido.');
    expect(bitacorasService.createVisita).not.toHaveBeenCalled();

    // Elimina la Persona 2 incompleta; con solo la Persona 1 completa, debe registrar.
    await act(async () => {
      view.container.querySelector('[aria-label="Eliminar Visitantes 2"]').click();
      await flush();
    });
    await submitForm(view.container);

    expect(bitacorasService.createVisita).toHaveBeenCalledWith(
      expect.objectContaining({
        grupos: { visitantes: [{ nombre: 'Ana', cedula: '0912345678' }] },
      })
    );
    expect(view.onSuccess).toHaveBeenCalled();
    view.unmount();
  });

  test('regresión: Visitantes y preguntas dinámicas se muestran juntos, en orden Contexto → Visitantes → Preguntas', async () => {
    bitacorasService.getFormularioVisitasActivo.mockResolvedValue({
      success: true,
      data: {
        id: 30,
        tipos: [{ id: 900, form_version_id: 30, nombre: 'Peatón', sort_order: 1 }],
        fields: [
          {
            field_key: 'motivo',
            label: 'Motivo',
            type: 'select',
            required: true,
            options: ['Entrega', 'Visita'],
            aplica_a: 'TODOS',
          },
        ],
        groups: [
          {
            group_key: 'visitantes',
            label: 'Visitantes',
            min_count: 0,
            aplica_a: 'TODOS',
            fields: [
              { field_key: 'nombre', label: 'Nombre', type: 'text', required: true },
              { field_key: 'cedula', label: 'Cédula', type: 'cedula', required: true },
            ],
          },
        ],
      },
    });
    const view = renderForm();
    await act(async () => {
      setValue(view.container.querySelector('#visita-ubicacion'), '2');
      await flush();
    });
    await selectOption(view.container, view.container.querySelector('#visita-manzana'), 'A');
    await selectOption(view.container, view.container.querySelector('#visita-villa'), '1');
    await act(async () => {
      setValue(view.container.querySelector('#visita-tipo-visita'), '900');
      await flush();
    });

    // Both sections must render simultaneously: the presence of the
    // Visitantes group must not suppress the normal dynamic questions.
    const visitantesButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === '+ Agregar Visitantes'
    );
    expect(visitantesButton).not.toBeUndefined();
    expect(view.container.querySelector('[aria-label="Pregunta del campo"]')).toBeNull();
    expect(view.container.textContent).toContain('Motivo');
    const motivoSelect = Array.from(view.container.querySelectorAll('select')).find((select) =>
      Array.from(select.options).some((option) => option.textContent === 'Entrega')
    );
    expect(motivoSelect).not.toBeUndefined();

    const sectionTitles = Array.from(
      view.container.querySelectorAll('.bitacoras-registro-section-title')
    ).map((node) => node.textContent);
    expect(sectionTitles).toEqual(['Contexto', 'Visitantes', 'Preguntas']);

    view.unmount();
  });

  test('regresión: ausencia de formulario activo (404) se muestra como estado normal, no como error', async () => {
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

    expect(view.container.textContent).toContain(
      'Esta Urbanización aún no tiene un formulario de visitas publicado.'
    );
    expect(view.container.querySelector('.bitacoras-filter-error')).toBeNull();

    view.unmount();
  });

  test('regresión: "No autorizada" exige motivo y lo envía junto con autorizada:false', async () => {
    const view = renderForm();
    await act(async () => {
      setValue(view.container.querySelector('#visita-ubicacion'), '2');
      await flush();
    });
    await selectOption(view.container, view.container.querySelector('#visita-manzana'), 'A');
    await selectOption(view.container, view.container.querySelector('#visita-villa'), '1');
    await act(async () => {
      setValue(view.container.querySelector('#visita-tipo-visita'), '900');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('#visita-respuesta-motivo'), 'Entrega');
      await flush();
    });

    const rejectButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'No autorizada'
    );

    await act(async () => {
      rejectButton.click();
      await flush();
    });
    expect(view.container.textContent).toContain('El motivo de no autorización es requerido.');
    expect(bitacorasService.createVisita).not.toHaveBeenCalled();

    await act(async () => {
      setValue(
        view.container.querySelector('#visita-motivo-no-autorizacion'),
        'No coincide con la lista de invitados'
      );
      await flush();
    });
    await act(async () => {
      rejectButton.click();
      await flush();
    });

    expect(bitacorasService.createVisita).toHaveBeenCalledWith(
      expect.objectContaining({
        autorizada: false,
        motivo_no_autorizacion: 'No coincide con la lista de invitados',
      })
    );
    expect(view.onSuccess).toHaveBeenCalled();
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

    await submitForm(view.container);

    expect(view.container.textContent).toContain('Publica un formulario activo');
    expect(bitacorasService.createVisita).not.toHaveBeenCalled();
    view.unmount();
  });
});
