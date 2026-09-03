import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import bitacorasService from '../../../services/bitacorasService';
import FormularioVisitasAdmin from './FormularioVisitasAdmin';

jest.mock('../../../services/bitacorasService', () => ({
  __esModule: true,
  default: {
    getFormulariosVisitas: jest.fn(),
    getFormularioVisitasActivo: jest.fn(),
    getFormularioVisitasDetalle: jest.fn(),
    publishFormularioVisitas: jest.fn(),
    archiveFormularioVisitas: jest.fn(),
    activateFormularioVisitas: jest.fn(),
    deleteFormularioVisitas: jest.fn(),
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

const renderAdmin = async ({ canGestionar = false, canDelete = false, onTotalChange } = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const showToast = jest.fn();
  const Harness = () => {
    const [isOpen, setIsOpen] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setIsOpen(true)}>
          Crear formulario
        </button>
        <FormularioVisitasAdmin
          showToast={showToast}
          ubicaciones={[
            { id: 1, nombre: 'General', tipo_punto: 'GENERAL' },
            { id: 2, nombre: 'Urb Norte', tipo_punto: 'URBANIZACION' },
          ]}
          isBuilderOpen={isOpen}
          onOpenBuilder={() => setIsOpen(true)}
          onCloseBuilder={() => setIsOpen(false)}
          canGestionar={canGestionar}
          canDelete={canDelete}
          onTotalChange={onTotalChange}
        />
      </>
    );
  };
  await act(async () => {
    root.render(<Harness />);
    await flush();
  });
  return { container, root, showToast };
};

const openBuilder = async (container) => {
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Crear formulario')
      .click();
    await flush();
  });
};

describe('FormularioVisitasAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bitacorasService.getFormulariosVisitas.mockResolvedValue({
      success: true,
      data: [
        {
          id: 5,
          titulo: 'Ingreso principal',
          ubicacion_nombre: 'Urb Norte',
          version: 2,
          estado: 'ACTIVE',
          creador: 'monitor',
          published_at: '2026-08-31T12:00:00.000Z',
        },
      ],
      meta: { totalItems: 1, totalPages: 1 },
      filters: { creators: [{ id: 7, usuario: 'monitor' }] },
    });
    bitacorasService.getFormularioVisitasActivo.mockResolvedValue({
      success: false,
      status: 404,
      message: 'Sin formulario activo',
    });
    bitacorasService.publishFormularioVisitas.mockResolvedValue({
      success: true,
      message: 'Publicado',
      data: { id: 6, version: 1, fields: [] },
    });
    bitacorasService.deleteFormularioVisitas.mockResolvedValue({
      success: true,
      message: 'Formulario eliminado',
    });
  });

  test('muestra versiones en tabla y abre el builder en AppModal', async () => {
    const view = await renderAdmin();
    expect(view.container.textContent).toContain('Ingreso principal');
    expect(view.container.textContent).toContain('Urb Norte');
    expect(view.container.textContent).toContain('ACTIVO');
    expect(view.container.textContent).toContain('monitor');
    expect(view.container.textContent).toContain('Página 1 de 1');
    expect(bitacorasService.getFormulariosVisitas).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      nombre: '',
      ubicacion_id: '',
      creator: '',
      estado: '',
      sortBy: 'published_at',
      sortOrder: 'desc',
    });
    const actionsHeader = view.container.querySelector('th[aria-label="Acciones"]');
    expect(actionsHeader).not.toBeNull();
    expect(actionsHeader.textContent).toBe('');
    expect(actionsHeader.classList.contains('app-col-actions--double')).toBe(true);

    await openBuilder(view.container);
    expect(view.container.querySelector('.app-modal--xl')).not.toBeNull();
    expect(view.container.querySelector('[data-app-modal-body]')).not.toBeNull();
    const fieldTypes = view.container.querySelector('[aria-label="Tipo de campo"]').textContent;
    expect(fieldTypes).toContain('Cédula');
    expect(fieldTypes).toContain('Placa');
    expect(fieldTypes).not.toContain('Fecha');
    expect(fieldTypes).not.toContain('Hora');
    const location = view.container.querySelector('#visit-form-location');
    expect(location.textContent).toContain('Urb Norte');
    expect(location.textContent).not.toContain('General');
    act(() => view.root.unmount());
    view.container.remove();
  });

  test('agrega y quita opciones de Lista una por una y publica payload generado', async () => {
    const view = await renderAdmin();
    await openBuilder(view.container);
    await act(async () => {
      setValue(view.container.querySelector('#visit-form-location'), '2');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Nuevo tipo de visita"]'), 'Peatón');
      await flush();
    });
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agregar tipo')
        .click();
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Pregunta del campo"]'), '¿Motivo?');
      setValue(view.container.querySelector('[aria-label="Tipo de campo"]'), 'select');
      await flush();
    });
    expect(view.container.querySelector('[aria-label="Nueva opción"]')).not.toBeNull();

    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Nueva opción"]'), 'Entrega');
      await flush();
    });
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agregar opción')
        .click();
      await flush();
    });
    expect(view.container.textContent).toContain('Entrega');
    expect(view.container.querySelector('[aria-label="Quitar opción Entrega"]')).not.toBeNull();

    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Publicar versión')
        .click();
      await flush();
    });
    expect(bitacorasService.publishFormularioVisitas).toHaveBeenCalledWith('2', {
      titulo: 'Formulario de visitas',
      mostrar_fecha_hora: true,
      tipos_visita: [{ nombre: 'Peatón', requiere_salida: false }],
      fields: [
        {
          field_key: 'motivo',
          label: '¿Motivo?',
          type: 'select',
          required: false,
          aplica_a: 'TODOS',
          options: ['Entrega'],
        },
      ],
      grupos: [],
    });
    expect(view.showToast).toHaveBeenCalledWith('Publicado', 'success');
    act(() => view.root.unmount());
    view.container.remove();
  });

  test('regresión: un tipo de visita nuevo inicia con requiere_salida desmarcado', async () => {
    const view = await renderAdmin();
    await openBuilder(view.container);
    await act(async () => {
      setValue(view.container.querySelector('#visit-form-location'), '2');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Nuevo tipo de visita"]'), 'Vehículo');
      await flush();
    });
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agregar tipo')
        .click();
      await flush();
    });

    const salidaCheckbox = view.container.querySelector(
      '[title="Requiere registrar salida"] input[type="checkbox"]'
    );
    expect(salidaCheckbox).not.toBeNull();
    expect(salidaCheckbox.checked).toBe(false);

    act(() => view.root.unmount());
    view.container.remove();
  });

  test('regresión: no permite quitar el último tipo de visita (mínimo 1)', async () => {
    const view = await renderAdmin();
    await openBuilder(view.container);
    await act(async () => {
      setValue(view.container.querySelector('#visit-form-location'), '2');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Nuevo tipo de visita"]'), 'Peatón');
      await flush();
    });
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agregar tipo')
        .click();
      await flush();
    });

    const quitar = view.container.querySelector('[aria-label="Quitar tipo de visita Peatón"]');
    expect(quitar).not.toBeNull();
    expect(quitar.disabled).toBe(true);

    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Nuevo tipo de visita"]'), 'Vehículo');
      await flush();
    });
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agregar tipo')
        .click();
      await flush();
    });
    expect(
      view.container.querySelector('[aria-label="Quitar tipo de visita Peatón"]').disabled
    ).toBe(false);

    act(() => view.root.unmount());
    view.container.remove();
  });

  test('habilita el grupo predefinido Visitantes (Nombre + Cédula fijos) y lo publica', async () => {
    const view = await renderAdmin();
    await openBuilder(view.container);
    await act(async () => {
      setValue(view.container.querySelector('#visit-form-location'), '2');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Nuevo tipo de visita"]'), 'Peatón');
      await flush();
    });
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agregar tipo')
        .click();
      await flush();
    });

    expect(view.container.querySelector('.bitacoras-group-row')).toBeNull();
    await act(async () => {
      view.container.querySelector('.bitacoras-group-toggle input[type="checkbox"]').click();
      await flush();
    });
    expect(view.container.textContent).toContain('Visitantes');
    expect(view.container.textContent).toContain('Nombre');
    expect(view.container.textContent).toContain('Cédula');
    // No hay forma de agregar/quitar campos: son fijos.
    expect(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Agregar campo'
      )
    ).toBeUndefined();
    expect(view.container.querySelectorAll('.bitacoras-group-field-row').length).toBe(2);

    await act(async () => {
      view.container.querySelector('.bitacoras-group-min-input input[type="checkbox"]').click();
      await flush();
    });

    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Publicar versión')
        .click();
      await flush();
    });

    expect(bitacorasService.publishFormularioVisitas).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({
        grupos: [
          {
            group_key: 'visitantes',
            label: 'Visitantes',
            min_count: 1,
            aplica_a: 'TODOS',
            fields: [
              { field_key: 'nombre', label: 'Nombre', type: 'text', required: true },
              { field_key: 'cedula', label: 'Cédula', type: 'cedula', required: true },
            ],
          },
        ],
      })
    );
    act(() => view.root.unmount());
    view.container.remove();
  });

  test('bloquea publicar si una pregunta normal duplica Nombre/Cédula del grupo Visitantes', async () => {
    const view = await renderAdmin();
    await openBuilder(view.container);
    await act(async () => {
      setValue(view.container.querySelector('#visit-form-location'), '2');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Nuevo tipo de visita"]'), 'Peatón');
      await flush();
    });
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agregar tipo')
        .click();
      await flush();
    });
    await act(async () => {
      view.container.querySelector('.bitacoras-group-toggle input[type="checkbox"]').click();
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Pregunta del campo"]'), 'Cédula');
      await flush();
    });

    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Publicar versión')
        .click();
      await flush();
    });

    expect(bitacorasService.publishFormularioVisitas).not.toHaveBeenCalled();
    expect(view.showToast).toHaveBeenCalledWith(
      expect.stringContaining('duplica un campo del grupo Visitantes'),
      'error'
    );
    act(() => view.root.unmount());
    view.container.remove();
  });

  test('mantiene selección funcional con cinco tipos específicos de nombres largos', async () => {
    const view = await renderAdmin();
    await openBuilder(view.container);
    const tipos = [
      'Peatón residente invitado',
      'Vehículo de proveedor externo',
      'Delivery con paquete voluminoso',
      'Servicio técnico programado',
      'Transporte escolar autorizado',
    ];

    for (const tipo of tipos) {
      await act(async () => {
        setValue(view.container.querySelector('[aria-label="Nuevo tipo de visita"]'), tipo);
        await flush();
      });
      await act(async () => {
        Array.from(view.container.querySelectorAll('button'))
          .find((button) => button.textContent === 'Agregar tipo')
          .click();
        await flush();
      });
    }

    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Aplica a"]'), 'SELECCIONADOS');
      await flush();
    });

    const selector = view.container.querySelector('.bitacoras-applies-types');
    expect(selector).not.toBeNull();
    expect(selector.querySelectorAll('label')).toHaveLength(5);
    await act(async () => {
      selector.querySelectorAll('input')[1].click();
      selector.querySelectorAll('input')[4].click();
      await flush();
    });
    expect(selector.querySelectorAll('input')[1].checked).toBe(true);
    expect(selector.querySelectorAll('input')[4].checked).toBe(true);
    expect(view.container.querySelector('.bitacoras-required-input')).not.toBeNull();
    expect(view.container.querySelector('[aria-label="Eliminar pregunta"]')).not.toBeNull();

    act(() => view.root.unmount());
    view.container.remove();
  });

  test('aplica filtros y paginación con el patrón tabular compartido', async () => {
    const view = await renderAdmin();
    expect(
      view.container.querySelector('label[for="formularios-filter-ubicacion"]')
    ).not.toBeNull();
    expect(view.container.querySelector('label[for="formularios-filter-creator"]')).not.toBeNull();
    expect(view.container.querySelector('label[for="formularios-filter-estado"]')).not.toBeNull();
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Filtrar por nombre"]'), 'Ingreso');
      setValue(view.container.querySelector('#formularios-filter-ubicacion'), '2');
      setValue(view.container.querySelector('#formularios-filter-creator'), 'monitor');
      setValue(view.container.querySelector('#formularios-filter-estado'), 'ACTIVE');
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Aplicar')
        .click();
      await flush();
    });
    expect(bitacorasService.getFormulariosVisitas).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      nombre: 'Ingreso',
      ubicacion_id: '2',
      creator: 'monitor',
      estado: 'ACTIVE',
      sortBy: 'published_at',
      sortOrder: 'desc',
    });
    expect(view.container.querySelector('.app-table-scroll')).not.toBeNull();
    act(() => view.root.unmount());
    view.container.remove();
  });

  test('ordena formularios server-side y conserva los filtros', async () => {
    const view = await renderAdmin();
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Filtrar por nombre"]'), 'Ingreso');
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Aplicar')
        .click();
      await flush();
    });
    const nombreSort = Array.from(view.container.querySelectorAll('.th-sort-btn')).find((button) =>
      button.textContent.includes('Nombre')
    );
    await act(async () => {
      nombreSort.click();
      await flush();
    });
    expect(bitacorasService.getFormulariosVisitas).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        nombre: 'Ingreso',
        sortBy: 'nombre',
        sortOrder: 'asc',
      })
    );
    act(() => view.root.unmount());
    view.container.remove();
  });

  test('reporta el total visible vía onTotalChange y lo actualiza al aplicar filtros', async () => {
    const onTotalChange = jest.fn();
    const view = await renderAdmin({ onTotalChange });

    expect(onTotalChange).toHaveBeenLastCalledWith(1);

    bitacorasService.getFormulariosVisitas.mockResolvedValueOnce({
      success: true,
      data: [],
      meta: { totalItems: 0, totalPages: 1 },
      filters: { creators: [] },
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Filtrar por nombre"]'), 'Sin resultados');
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Aplicar')
        .click();
      await flush();
    });

    expect(onTotalChange).toHaveBeenLastCalledWith(0);
    act(() => view.root.unmount());
    view.container.remove();
  });

  test('quita una pregunta borrador y no la incluye al publicar', async () => {
    const view = await renderAdmin();
    await openBuilder(view.container);
    await act(async () => {
      setValue(view.container.querySelector('#visit-form-location'), '2');
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Nuevo tipo de visita"]'), 'Peatón');
      await flush();
    });
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agregar tipo')
        .click();
      await flush();
    });
    await act(async () => {
      setValue(view.container.querySelector('[aria-label="Pregunta del campo"]'), 'Eliminarme');
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Agregar pregunta')
        .click();
      await flush();
    });
    const questions = view.container.querySelectorAll('[aria-label="Pregunta del campo"]');
    await act(async () => {
      setValue(questions[1], 'Conservarme');
      view.container.querySelector('[aria-label="Eliminar pregunta"]').click();
      await flush();
    });
    expect(view.container.textContent).not.toContain('Eliminarme');
    expect(view.container.querySelector('.bitacoras-form-field-row legend').textContent).toBe(
      'Pregunta 1'
    );
    expect(view.container.querySelector('[aria-label="Pregunta del campo"]').value).toBe(
      'Conservarme'
    );
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Publicar versión')
        .click();
      await flush();
    });
    expect(bitacorasService.publishFormularioVisitas).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({
        fields: [expect.objectContaining({ field_key: 'conservarme', label: 'Conservarme' })],
      })
    );
    act(() => view.root.unmount());
    view.container.remove();
  });

  test('respuestas obsoletas de la lista no sobrescriben resultados más recientes', async () => {
    let resolveStale;
    const staleResponse = new Promise((resolve) => {
      resolveStale = resolve;
    });
    bitacorasService.getFormulariosVisitas
      .mockImplementationOnce(() => staleResponse)
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 9,
            titulo: 'Formulario Nuevo',
            ubicacion_nombre: 'Urb Norte',
            version: 3,
            estado: 'ACTIVE',
            creador: 'monitor',
            published_at: '2026-08-31T12:00:00.000Z',
          },
        ],
        meta: { totalItems: 1, totalPages: 1 },
        filters: { creators: [{ id: 7, usuario: 'monitor' }] },
      });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <FormularioVisitasAdmin
          showToast={jest.fn()}
          ubicaciones={[{ id: 2, nombre: 'Urb Norte', tipo_punto: 'URBANIZACION' }]}
          isBuilderOpen={false}
          onCloseBuilder={() => {}}
        />
      )
    );
    await act(async () => flush());

    // A second, newer request (triggered by applying a filter) resolves before the stale first one.
    await act(async () => {
      setValue(container.querySelector('[aria-label="Filtrar por nombre"]'), 'Formulario Nuevo');
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Aplicar')
        .click();
      await flush();
    });

    expect(container.textContent).toContain('Formulario Nuevo');

    await act(async () => {
      resolveStale({
        success: true,
        data: [
          {
            id: 5,
            titulo: 'Formulario Viejo',
            ubicacion_nombre: 'Urb Norte',
            version: 2,
            estado: 'ACTIVE',
            creador: 'monitor',
            published_at: '2026-08-31T12:00:00.000Z',
          },
        ],
        meta: { totalItems: 1, totalPages: 1 },
        filters: { creators: [] },
      });
      await flush();
    });

    expect(container.textContent).toContain('Formulario Nuevo');
    expect(container.textContent).not.toContain('Formulario Viejo');
    act(() => root.unmount());
    container.remove();
  });

  test('sin permiso de gestión no expone columna de Acciones', async () => {
    const view = await renderAdmin({ canGestionar: false });
    expect(view.container.querySelector('[aria-label^="Editar formulario"]')).toBeNull();
    expect(view.container.querySelector('[aria-label^="Archivar formulario"]')).toBeNull();
    act(() => view.root.unmount());
    view.container.remove();
  });

  test('Gerente/Supervisor pueden Editar (crea nueva versión, no muta la publicada) y Cambiar estado', async () => {
    bitacorasService.getFormulariosVisitas.mockResolvedValue({
      success: true,
      data: [
        {
          id: 5,
          ubicacion_id: 2,
          titulo: 'Ingreso principal',
          ubicacion_nombre: 'Urb Norte',
          version: 2,
          estado: 'ACTIVE',
          creador: 'monitor',
          published_at: '2026-08-31T12:00:00.000Z',
        },
        {
          id: 3,
          ubicacion_id: 2,
          titulo: 'Versión anterior',
          ubicacion_nombre: 'Urb Norte',
          version: 1,
          estado: 'ARCHIVED',
          creador: 'monitor',
          published_at: '2026-08-01T12:00:00.000Z',
        },
      ],
      meta: { totalItems: 2, totalPages: 1 },
      filters: { creators: [{ id: 7, usuario: 'monitor' }] },
    });
    bitacorasService.getFormularioVisitasActivo.mockResolvedValue({
      success: true,
      data: {
        id: 5,
        version: 2,
        titulo: 'Ingreso principal',
        mostrar_fecha_hora: true,
        tipos: [{ id: 900, form_version_id: 5, nombre: 'Peatón', sort_order: 1 }],
        fields: [],
      },
    });
    bitacorasService.archiveFormularioVisitas.mockResolvedValue({
      success: true,
      message: 'Formulario archivado',
    });

    const view = await renderAdmin({ canGestionar: true });
    const desktopTable = view.container.querySelector('.bitacoras-forms-table');

    // El contenido publicado es inmutable, pero un archivado sí puede
    // reactivarse (republica como versión nueva); solo el activo se archiva.
    const archiveButtons = Array.from(
      desktopTable.querySelectorAll('[aria-label^="Archivar formulario"]')
    );
    expect(archiveButtons).toHaveLength(1);
    const archivedRow = Array.from(desktopTable.querySelectorAll('tbody tr')).find((row) =>
      row.textContent.includes('Versión anterior')
    );
    expect(archivedRow.querySelector('[aria-label^="Vista previa"]')).not.toBeNull();
    expect(archivedRow.querySelector('[aria-label^="Editar formulario"]')).toBeNull();

    await act(async () => {
      desktopTable.querySelector('[aria-label="Editar formulario de Urb Norte"]').click();
      await flush();
    });
    expect(view.container.querySelector('.app-modal--xl')).not.toBeNull();
    expect(view.container.querySelector('#visit-form-location').value).toBe('2');
    expect(view.container.textContent).toContain(
      'La nueva publicación reemplazará la versión activa 2'
    );

    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Publicar versión')
        .click();
      await flush();
    });
    expect(bitacorasService.publishFormularioVisitas).toHaveBeenCalledWith('2', {
      titulo: 'Ingreso principal',
      mostrar_fecha_hora: true,
      tipos_visita: [{ nombre: 'Peatón', requiere_salida: false }],
      fields: [],
      grupos: [],
    });

    await act(async () => {
      view.container.querySelector('[aria-label="Archivar formulario de Urb Norte"]').click();
      await flush();
    });
    expect(view.container.textContent).toContain('Cambiar estado del formulario');

    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Archivar')
        .click();
      await flush();
    });
    expect(bitacorasService.archiveFormularioVisitas).toHaveBeenCalledWith(5);
    expect(view.showToast).toHaveBeenCalledWith('Formulario archivado', 'success');

    bitacorasService.activateFormularioVisitas.mockResolvedValue({
      success: true,
      message: 'Formulario activado',
    });
    bitacorasService.getFormularioVisitasDetalle.mockResolvedValue({
      success: true,
      data: {
        id: 3,
        version: 1,
        titulo: 'Versión anterior',
        mostrar_fecha_hora: true,
        tipos: [
          { id: 901, nombre: 'Peatón', requiere_salida: false },
          { id: 902, nombre: 'Vehículo', requiere_salida: true },
        ],
        groups: [
          {
            label: 'Visitantes',
            min_count: 1,
            aplica_a: 'TODOS',
            tipos: [],
            fields: [{ label: 'Nombre', required: true }],
          },
        ],
        fields: [
          {
            label: 'Placa',
            required: true,
            aplica_a: 'TIPOS',
            tipos: [902],
          },
        ],
      },
    });
    await act(async () => {
      view.container.querySelector('[aria-label^="Vista previa"]').click();
      await flush();
    });
    expect(bitacorasService.getFormularioVisitasDetalle).toHaveBeenCalledWith(3);
    expect(view.container.textContent).toContain('Vista previa del formulario');
    expect(view.container.textContent).toContain('Vehículo');
    expect(view.container.textContent).toContain('Requiere salida');
    expect(view.container.textContent).toContain('Visitantes');
    expect(view.container.textContent).toContain('Placa');
    expect(view.container.textContent).toContain('Requerido');
    expect(view.container.textContent).toContain('Vehículo');
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Cancelar')
        .click();
      await flush();
    });
    expect(bitacorasService.activateFormularioVisitas).not.toHaveBeenCalled();
    expect(view.container.textContent).not.toContain('Vista previa del formulario');
    await act(async () => {
      view.container.querySelector('[aria-label^="Vista previa"]').click();
      await flush();
    });
    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Activar')
        .click();
      await flush();
    });
    expect(bitacorasService.activateFormularioVisitas).toHaveBeenCalledWith(3);
    expect(view.showToast).toHaveBeenCalledWith('Formulario activado', 'success');

    act(() => view.root.unmount());
    view.container.remove();
  });

  test('Gerente elimina con confirmación solo una versión ARCHIVED y refresca el listado', async () => {
    bitacorasService.getFormulariosVisitas.mockResolvedValue({
      success: true,
      data: [
        {
          id: 5,
          ubicacion_id: 2,
          titulo: 'Activa',
          ubicacion_nombre: 'Urb Norte',
          version: 2,
          estado: 'ACTIVE',
          creador: 'monitor',
          published_at: '2026-08-31T12:00:00.000Z',
        },
        {
          id: 3,
          ubicacion_id: 2,
          titulo: 'Histórica',
          ubicacion_nombre: 'Urb Norte',
          version: 1,
          estado: 'ARCHIVED',
          creador: 'monitor',
          published_at: '2026-08-01T12:00:00.000Z',
        },
      ],
      meta: { totalItems: 2, totalPages: 1 },
      filters: { creators: [] },
    });
    const view = await renderAdmin({ canGestionar: true, canDelete: true });
    const table = view.container.querySelector('.bitacoras-forms-table');
    const activeRow = Array.from(table.querySelectorAll('tbody tr')).find((row) =>
      row.textContent.includes('Activa')
    );
    const archivedRow = Array.from(table.querySelectorAll('tbody tr')).find((row) =>
      row.textContent.includes('Histórica')
    );

    expect(activeRow.querySelector('[aria-label^="Eliminar formulario"]')).toBeNull();
    const deleteButton = archivedRow.querySelector(
      '[aria-label="Eliminar formulario de Urb Norte"]'
    );
    expect(deleteButton).not.toBeNull();
    await act(async () => {
      deleteButton.click();
      await flush();
    });
    expect(view.container.textContent).toContain('Eliminar formulario archivado');
    expect(bitacorasService.deleteFormularioVisitas).not.toHaveBeenCalled();

    await act(async () => {
      Array.from(view.container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Eliminar')
        .click();
      await flush();
    });

    expect(bitacorasService.deleteFormularioVisitas).toHaveBeenCalledWith(3);
    expect(bitacorasService.getFormulariosVisitas).toHaveBeenCalledTimes(2);
    expect(view.showToast).toHaveBeenCalledWith('Formulario eliminado', 'success');
    act(() => view.root.unmount());
    view.container.remove();
  });
});
