import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import personalService from '../../services/personalService';
import Personal from './Personal';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../context/ToastContext', () => ({
  useToast: jest.fn(),
}));

jest.mock('../../services/personalService', () => ({
  __esModule: true,
  default: {
    getColaboradores: jest.fn(),
    createColaborador: jest.fn(),
    updateColaborador: jest.fn(),
    deleteColaborador: jest.fn(),
    exportExcel: jest.fn(),
  },
}));

jest.mock('../../hooks/useScrollToTopOnMount', () => jest.fn());

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const setValue = (element, value) => {
  Object.getOwnPropertyDescriptor(globalThis.HTMLInputElement.prototype, 'value').set.call(
    element,
    value
  );
  element.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
};

const colaborador = (overrides = {}) => ({
  id: 1,
  nombres_completos: 'Ana Torres',
  cedula: '0102030405',
  cargo: 'Recepcionista',
  estado: 'activo',
  celular: '0999999999',
  banco: null,
  numero_cuenta: null,
  sueldo: '450.00',
  ...overrides,
});

const pagination = (overrides = {}) => ({
  page: 1,
  pageSize: 25,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  ...overrides,
});

describe('Personal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useAuth.mockReturnValue({ user: { id: 1, tipo_usuario: 'gerente', activo: true } });
    useToast.mockReturnValue({ showToast: jest.fn() });
    personalService.getColaboradores.mockResolvedValue({
      success: true,
      data: [colaborador()],
      pagination: pagination(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const render = async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Personal />));
    await act(async () => {
      jest.advanceTimersByTime(300);
      await flush();
    });
    return { container, root };
  };

  test('carga la primera página server-side (page=1, pageSize=25) sin filtros', async () => {
    const { container, root } = await render();

    expect(personalService.getColaboradores).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(container.textContent).toContain('Ana Torres');

    act(() => root.unmount());
    container.remove();
  });

  test('cambiar de página pide la página siguiente al backend, sin cargar todo el dataset', async () => {
    personalService.getColaboradores.mockResolvedValue({
      success: true,
      data: [colaborador()],
      pagination: pagination({ page: 1, totalItems: 30, totalPages: 2, hasNextPage: true }),
    });
    const { container, root } = await render();

    const nextButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Siguiente ›'
    );
    expect(nextButton).not.toBeUndefined();

    await act(async () => {
      nextButton.click();
      await flush();
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
      await flush();
    });

    expect(personalService.getColaboradores).toHaveBeenLastCalledWith({ page: 2, pageSize: 25 });

    act(() => root.unmount());
    container.remove();
  });

  test('estado vacío sin filtros muestra "No hay colaboradores registrados"', async () => {
    personalService.getColaboradores.mockResolvedValue({
      success: true,
      data: [],
      pagination: pagination({ totalItems: 0, totalPages: 0 }),
    });
    const { container, root } = await render();

    expect(container.textContent).toContain('No hay colaboradores registrados');
    expect(container.textContent).not.toContain('para los filtros aplicados');

    act(() => root.unmount());
    container.remove();
  });

  test('estado vacío con filtro de búsqueda sin resultados muestra mensaje distinto', async () => {
    personalService.getColaboradores.mockResolvedValue({
      success: true,
      data: [],
      pagination: pagination({ totalItems: 0, totalPages: 0 }),
    });
    const { container, root } = await render();

    const searchInput = container.querySelector('input[name="search"]');
    const applyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Aplicar'
    );

    await act(async () => {
      setValue(searchInput, 'zzznoexiste');
      applyButton.click();
      await flush();
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
      await flush();
    });

    expect(personalService.getColaboradores).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 25,
      search: 'zzznoexiste',
    });
    expect(container.textContent).toContain('No hay colaboradores para los filtros aplicados');

    act(() => root.unmount());
    container.remove();
  });
});
