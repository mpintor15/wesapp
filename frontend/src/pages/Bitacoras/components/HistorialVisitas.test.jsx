import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import bitacorasService from '../../../services/bitacorasService';
import HistorialVisitas from './HistorialVisitas';

jest.mock('../../../services/bitacorasService', () => ({
  __esModule: true,
  default: {
    getVisitas: jest.fn(),
    closeVisita: jest.fn(),
    cancelVisita: jest.fn(),
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

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

const findButtonByText = (container, text) =>
  Array.from(container.querySelectorAll('button')).find((button) => button.textContent === text);

const visitRow = (overrides = {}) => ({
  id: 8,
  entrada_at: '2026-08-20T10:00:00',
  visitante_nombre: 'Carlos Ruiz',
  visitante_documento: '0912345678',
  placa: 'ABC123',
  manzana_nombre: 'A',
  villa_identificador: '1',
  residente_principal_nombre: 'Ana Titular',
  estado: 'ABIERTA',
  salida_at: null,
  ...overrides,
});

describe('HistorialVisitas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [visitRow()],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });
    bitacorasService.closeVisita.mockResolvedValue({ success: true, message: 'Cerrada' });
    bitacorasService.cancelVisita.mockResolvedValue({ success: true, message: 'Visita anulada' });
  });

  test('muestra visitas, filtros y registra salida sin anular', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChanged = jest.fn();
    const showToast = jest.fn();
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={onChanged} showToast={showToast} />)
    );
    await act(async () => flush());

    expect(container.textContent).toContain('Carlos Ruiz');
    expect(container.textContent).toContain('A - 1');
    expect(container.querySelector('.records-mobile')).not.toBeNull();
    expect(container.textContent).not.toContain('Anular');
    await act(async () => {
      container.querySelector('button.btn-ghost').click();
      await flush();
    });

    expect(bitacorasService.closeVisita).toHaveBeenCalledWith(8);
    expect(onChanged).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Cerrada', 'success');
    act(() => root.unmount());
    container.remove();
  });

  test('reporta el total visible vía onTotalChange y lo actualiza tras cerrar y anular', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChanged = jest.fn();
    const showToast = jest.fn();
    const onTotalChange = jest.fn();
    act(() =>
      root.render(
        <HistorialVisitas
          refreshKey={0}
          onChanged={onChanged}
          showToast={showToast}
          canCancelVisita
          onTotalChange={onTotalChange}
        />
      )
    );
    await act(async () => flush());

    expect(onTotalChange).toHaveBeenLastCalledWith(1);

    bitacorasService.getVisitas.mockResolvedValueOnce({
      success: true,
      data: [],
      meta: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    });
    await act(async () => {
      container.querySelector('button.btn-ghost').click();
      await flush();
    });
    expect(bitacorasService.closeVisita).toHaveBeenCalledWith(8);
    expect(onTotalChange).toHaveBeenLastCalledWith(0);

    act(() => root.unmount());
    container.remove();
  });

  test('expone Anular solo a usuarios con permiso administrador y crea Bitácora vía backend', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChanged = jest.fn();
    const showToast = jest.fn();
    act(() =>
      root.render(
        <HistorialVisitas
          refreshKey={0}
          onChanged={onChanged}
          showToast={showToast}
          canCancelVisita
        />
      )
    );
    await act(async () => flush());

    const cancelButton = findButtonByText(container, 'Anular');
    expect(cancelButton).not.toBeUndefined();

    await act(async () => {
      cancelButton.click();
      await flush();
    });

    const textarea = container.querySelector('#cancel-visita-motivo');
    expect(textarea).not.toBeNull();
    await act(async () => {
      setValue(textarea, 'Visitante no llegó');
      await flush();
    });

    await act(async () => {
      container
        .querySelector('form')
        .dispatchEvent(new globalThis.Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(bitacorasService.cancelVisita).toHaveBeenCalledWith(8, {
      motivo: 'Visitante no llegó',
    });
    expect(onChanged).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Visita anulada', 'success');
    act(() => root.unmount());
    container.remove();
  });

  test('Guardia (sin canCancelVisita) no ve ni puede anular visitas', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    expect(findButtonByText(container, 'Anular')).toBeUndefined();
    expect(container.textContent).not.toContain('Anular');
    act(() => root.unmount());
    container.remove();
  });

  test('respuestas obsoletas no sobrescriben el historial más reciente', async () => {
    let resolveStale;
    const staleResponse = new Promise((resolve) => {
      resolveStale = resolve;
    });
    bitacorasService.getVisitas
      .mockImplementationOnce(() => staleResponse)
      .mockResolvedValueOnce({
        success: true,
        data: [visitRow({ visitante_nombre: 'Visitante Nuevo' })],
        meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    // Second, newer request fires (e.g. a refresh) before the first one resolves.
    act(() =>
      root.render(<HistorialVisitas refreshKey={1} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    expect(container.textContent).toContain('Visitante Nuevo');

    // The stale first request now resolves; it must not clobber the newer state.
    await act(async () => {
      resolveStale({
        success: true,
        data: [visitRow({ visitante_nombre: 'Visitante Viejo' })],
        meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      });
      await flush();
    });

    expect(container.textContent).toContain('Visitante Nuevo');
    expect(container.textContent).not.toContain('Visitante Viejo');
    act(() => root.unmount());
    container.remove();
  });

  test('el reporte usa los mismos filtros efectivos que la tabla, incluido estado=ABIERTA por defecto', async () => {
    const onFiltersChange = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <HistorialVisitas
          refreshKey={0}
          onChanged={jest.fn()}
          showToast={jest.fn()}
          onFiltersChange={onFiltersChange}
        />
      )
    );
    await act(async () => flush());

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'ABIERTA', pageSize: 25 })
    );

    const estadoSelect = container.querySelector('#visitas-filter-estado');
    await act(async () => {
      setValue(estadoSelect, 'CERRADA');
      await flush();
    });
    await act(async () => {
      findButtonByText(container, 'Aplicar').click();
      await flush();
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'CERRADA' })
    );

    act(() => root.unmount());
    container.remove();
  });

  test('combina Visitante/Placa/Casa/Titular en un solo buscador y filtra Creador con dropdown de creadores reales', async () => {
    bitacorasService.getVisitas.mockResolvedValue({
      success: true,
      data: [visitRow()],
      meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      filters: {
        creators: [
          { id: 4, nombre: 'Guardia Uno' },
          { id: 9, nombre: 'Guardia Dos' },
        ],
      },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<HistorialVisitas refreshKey={0} onChanged={jest.fn()} showToast={jest.fn()} />)
    );
    await act(async () => flush());

    expect(container.querySelectorAll('.ff-search input')).toHaveLength(1);

    const creatorSelect = container.querySelector('#visitas-filter-creator');
    expect(creatorSelect).not.toBeNull();
    const options = Array.from(creatorSelect.querySelectorAll('option')).map(
      (option) => option.textContent
    );
    expect(options).toEqual(['Todos', 'Guardia Uno', 'Guardia Dos']);

    const searchInput = container.querySelector('.ff-search input');
    await act(async () => {
      setValue(searchInput, 'Carlos');
      setValue(creatorSelect, 'Guardia Uno');
      findButtonByText(container, 'Aplicar').click();
      await flush();
    });

    expect(bitacorasService.getVisitas).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Carlos', creator: 'Guardia Uno' })
    );
    expect(bitacorasService.getVisitas.mock.calls.at(-1)[0]).not.toHaveProperty('placa');
    expect(bitacorasService.getVisitas.mock.calls.at(-1)[0]).not.toHaveProperty('visitante');
    expect(bitacorasService.getVisitas.mock.calls.at(-1)[0]).not.toHaveProperty('casa');
    expect(bitacorasService.getVisitas.mock.calls.at(-1)[0]).not.toHaveProperty('titular');

    act(() => root.unmount());
    container.remove();
  });
});
