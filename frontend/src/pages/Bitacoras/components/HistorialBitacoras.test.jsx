import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import bitacorasService from '../../../services/bitacorasService';
import HistorialBitacoras from './HistorialBitacoras';

jest.mock('../../../services/bitacorasService', () => ({
  __esModule: true,
  default: { getRegistros: jest.fn() },
}));

jest.mock('../../../hooks/useIsMobile', () => () => false);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LOCATIONS = [
  { id: 7, nombre: 'Garita principal', cliente_nombre: 'Cliente X', tipo_punto: 'GARITA' },
  { id: 8, nombre: 'Bodega', cliente_nombre: 'Cliente X', tipo_punto: 'BODEGA' },
];

const RECORDS = [
  {
    id: 21,
    ubicacion_id: 7,
    ubicacion_nombre: 'Garita principal',
    tipo_punto: 'GARITA',
    autor_usuario: 'guardia1',
    autor_colaborador_nombre: 'Ana Guardia',
    ocurrido_at: '2026-08-21T10:15:00',
    detalle: 'Novedad completa\ncon segunda línea',
    estado: 'REGISTRADA',
  },
  {
    id: 20,
    ubicacion_id: 8,
    ubicacion_nombre: 'Bodega',
    tipo_punto: 'BODEGA',
    autor_usuario: 'supervisor1',
    autor_colaborador_nombre: null,
    ocurrido_at: '2026-08-21T09:00:00',
    detalle: 'Registro anulado',
    estado: 'ANULADA',
    motivo_anulacion: 'Duplicado',
  },
];

const successResult = ({ data = RECORDS, page = 1, pageSize = 25, totalPages = 1 } = {}) => ({
  success: true,
  data,
  meta: {
    page,
    pageSize,
    totalItems: data.length,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  },
});

const setValue = (element, value) => {
  const prototype =
    element instanceof globalThis.HTMLSelectElement
      ? globalThis.HTMLSelectElement.prototype
      : globalThis.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
};

const renderHistory = (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <HistorialBitacoras
        ubicaciones={LOCATIONS}
        locationsLoading={false}
        locationsError=""
        onReloadUbicaciones={jest.fn()}
        refreshKey={0}
        {...props}
      />
    )
  );
  return {
    container,
    field: (selector) => container.querySelector(selector),
    button: (text) =>
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent.trim() === text
      ),
    rerender: (nextProps) =>
      act(() =>
        root.render(
          <HistorialBitacoras
            ubicaciones={LOCATIONS}
            locationsLoading={false}
            locationsError=""
            onReloadUbicaciones={jest.fn()}
            refreshKey={0}
            {...nextProps}
          />
        )
      ),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const flush = async () => act(async () => Promise.resolve());

describe('HistorialBitacoras', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bitacorasService.getRegistros.mockResolvedValue(successResult());
  });

  test('consulta inicialmente solo page y pageSize y renderiza tabla y cards con datos reales', async () => {
    const view = renderHistory();
    await flush();

    expect(bitacorasService.getRegistros).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(view.container.querySelector('table.app-table')).not.toBeNull();
    expect(view.container.querySelector('thead th').getAttribute('scope')).toBe('col');
    expect(view.container.querySelector('.records-mobile')).not.toBeNull();
    expect(view.container.textContent).toContain('21/08/2026 10:15');
    expect(view.container.textContent).toContain('Ana Guardia');
    expect(view.container.textContent).toContain('guardia1');
    expect(view.container.textContent).toContain('GARITA');
    expect(view.container.textContent).toContain('Novedad completa');
    expect(view.container.textContent).toContain('REGISTRADA');
    expect(view.container.textContent).toContain('ANULADA');
    expect(view.container.textContent).toContain('Duplicado');

    view.unmount();
  });

  test('cambiar draft no consulta y Aplicar envía filtros permitidos exactos desde page 1', async () => {
    bitacorasService.getRegistros.mockResolvedValue(successResult({ totalPages: 3 }));
    const view = renderHistory();
    await flush();
    act(() => view.button('Siguiente ›').click());
    await flush();

    act(() => {
      setValue(view.field('#bitacoras-filter-autor'), '  Ana  ');
      setValue(view.field('#bitacoras-filter-ubicacion'), '7');
      setValue(view.field('#bitacoras-filter-desde'), '2026-08-01');
      setValue(view.field('#bitacoras-filter-hasta'), '2026-08-21');
      setValue(view.field('#bitacoras-filter-estado'), 'ANULADA');
    });
    const callsBeforeApply = bitacorasService.getRegistros.mock.calls.length;
    expect(callsBeforeApply).toBe(2);

    act(() => view.button('Aplicar').click());
    await flush();
    expect(bitacorasService.getRegistros).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 25,
      ubicacion_id: 7,
      fecha_desde: '2026-08-01',
      fecha_hasta: '2026-08-21',
      estado: 'ANULADA',
      autor: 'Ana',
    });
    expect(bitacorasService.getRegistros.mock.calls.at(-1)[0]).not.toHaveProperty('search');
    view.unmount();
  });

  test('rango inválido muestra error accesible y no consulta', async () => {
    const view = renderHistory();
    await flush();
    act(() => {
      setValue(view.field('#bitacoras-filter-desde'), '2026-08-22');
      setValue(view.field('#bitacoras-filter-hasta'), '2026-08-21');
      view.button('Aplicar').click();
    });

    expect(bitacorasService.getRegistros).toHaveBeenCalledTimes(1);
    expect(view.field('#bitacoras-filter-hasta').getAttribute('aria-invalid')).toBe('true');
    expect(view.container.textContent).toContain('igual o posterior');
    view.unmount();
  });

  test('Limpiar elimina filtros aplicados y vuelve a page 1', async () => {
    const view = renderHistory();
    await flush();
    act(() => {
      setValue(view.field('#bitacoras-filter-autor'), 'Ana');
      setValue(view.field('#bitacoras-filter-estado'), 'REGISTRADA');
      view.button('Aplicar').click();
    });
    await flush();
    act(() => view.button('Limpiar').click());
    await flush();

    expect(view.field('#bitacoras-filter-estado').value).toBe('');
    expect(view.field('#bitacoras-filter-autor').value).toBe('');
    expect(bitacorasService.getRegistros).toHaveBeenLastCalledWith({ page: 1, pageSize: 25 });
    view.unmount();
  });

  test('paginación consulta servidor con pageSize fijo y conserva filtros aplicados', async () => {
    bitacorasService.getRegistros.mockResolvedValue(
      successResult({ page: 1, pageSize: 25, totalPages: 3 })
    );
    const view = renderHistory();
    await flush();
    act(() => {
      setValue(view.field('#bitacoras-filter-autor'), 'Ana');
      setValue(view.field('#bitacoras-filter-estado'), 'REGISTRADA');
      view.button('Aplicar').click();
    });
    await flush();
    act(() => view.button('Siguiente ›').click());
    await flush();
    expect(bitacorasService.getRegistros).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 25,
      estado: 'REGISTRADA',
      autor: 'Ana',
    });
    expect(view.container.textContent).not.toContain('Registros por página');
    expect(view.field('#bitacoras-page-size')).toBeNull();
    view.unmount();
  });

  test('refresh externo conserva página y todos los filtros aplicados', async () => {
    bitacorasService.getRegistros.mockResolvedValue(
      successResult({ page: 1, pageSize: 25, totalPages: 3 })
    );
    const view = renderHistory();
    await flush();
    act(() => {
      setValue(view.field('#bitacoras-filter-autor'), 'Guardia');
      setValue(view.field('#bitacoras-filter-ubicacion'), '7');
      setValue(view.field('#bitacoras-filter-desde'), '2026-08-01');
      setValue(view.field('#bitacoras-filter-hasta'), '2026-08-21');
      setValue(view.field('#bitacoras-filter-estado'), 'REGISTRADA');
      view.button('Aplicar').click();
    });
    await flush();
    act(() => view.button('Siguiente ›').click());
    await flush();

    view.rerender({ refreshKey: 1 });
    await flush();

    expect(bitacorasService.getRegistros).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 25,
      ubicacion_id: 7,
      fecha_desde: '2026-08-01',
      fecha_hasta: '2026-08-21',
      estado: 'REGISTRADA',
      autor: 'Guardia',
    });
    view.unmount();
  });

  test('una respuesta anterior no sobrescribe el resultado del refresh externo', async () => {
    let resolveInitial;
    bitacorasService.getRegistros
      .mockReturnValueOnce(new Promise((resolve) => (resolveInitial = resolve)))
      .mockResolvedValueOnce(
        successResult({ data: [{ ...RECORDS[0], id: 22, detalle: 'Resultado nuevo' }] })
      );
    const view = renderHistory();

    view.rerender({ refreshKey: 1 });
    await flush();
    expect(view.container.textContent).toContain('Resultado nuevo');

    await act(async () => resolveInitial(successResult()));
    expect(view.container.textContent).toContain('Resultado nuevo');
    expect(view.container.textContent).not.toContain('Novedad completa');
    view.unmount();
  });

  test('corrige una página fuera de rango con una sola consulta adicional', async () => {
    bitacorasService.getRegistros
      .mockResolvedValueOnce(successResult({ page: 1, totalPages: 3 }))
      .mockResolvedValueOnce(successResult({ page: 2, totalPages: 3 }))
      .mockResolvedValueOnce(successResult({ page: 2, totalPages: 1 }))
      .mockResolvedValueOnce(successResult({ page: 1, totalPages: 1 }));
    const view = renderHistory();
    await flush();
    act(() => view.button('Siguiente ›').click());
    await flush();
    view.rerender({ refreshKey: 1 });
    await flush();
    await flush();

    expect(
      bitacorasService.getRegistros.mock.calls.slice(-2).map(([params]) => params.page)
    ).toEqual([2, 1]);
    expect(bitacorasService.getRegistros).toHaveBeenCalledTimes(4);
    view.unmount();
  });

  test('distingue empty sin filtros y con filtros', async () => {
    bitacorasService.getRegistros.mockResolvedValue(successResult({ data: [] }));
    const view = renderHistory();
    await flush();
    expect(view.container.textContent).toContain('No hay registros de Bitácora');

    act(() => {
      setValue(view.field('#bitacoras-filter-estado'), 'ANULADA');
      view.button('Aplicar').click();
    });
    await flush();
    expect(view.container.textContent).toContain('No hay resultados para los filtros aplicados');
    view.unmount();
  });

  test('error conserva filtros y Reintentar repite la consulta aplicada', async () => {
    bitacorasService.getRegistros
      .mockResolvedValueOnce(successResult())
      .mockResolvedValueOnce({ success: false, status: 500 })
      .mockResolvedValueOnce(successResult());
    const view = renderHistory();
    await flush();
    act(() => {
      setValue(view.field('#bitacoras-filter-estado'), 'ANULADA');
      view.button('Aplicar').click();
    });
    await flush();
    expect(view.container.textContent).toContain('Ocurrió un error interno');
    act(() => view.button('Reintentar').click());
    await flush();
    expect(bitacorasService.getRegistros).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 25,
      estado: 'ANULADA',
    });
    view.unmount();
  });

  test('error de refresh externo usa el estado normal de error y retry', async () => {
    bitacorasService.getRegistros
      .mockResolvedValueOnce(successResult())
      .mockResolvedValueOnce({ success: false, status: 500 })
      .mockResolvedValueOnce(successResult());
    const view = renderHistory();
    await flush();

    view.rerender({ refreshKey: 1 });
    await flush();
    expect(view.container.textContent).toContain('Ocurrió un error interno');

    act(() => view.button('Reintentar').click());
    await flush();
    expect(bitacorasService.getRegistros).toHaveBeenLastCalledWith({ page: 1, pageSize: 25 });
    expect(view.container.textContent).toContain('Novedad completa');
    view.unmount();
  });

  test('la ubicación de filtro es independiente y retry de Ubicaciones no consulta historial', async () => {
    const reload = jest.fn();
    const view = renderHistory({
      locationsError: 'Ubicaciones no disponibles',
      onReloadUbicaciones: reload,
    });
    await flush();
    act(() => {
      setValue(view.field('#bitacoras-filter-ubicacion'), '8');
      view.button('Reintentar Ubicaciones').click();
    });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(bitacorasService.getRegistros).toHaveBeenCalledTimes(1);
    expect(view.field('#bitacoras-filter-ubicacion').value).toBe('8');
    view.unmount();
  });
});
