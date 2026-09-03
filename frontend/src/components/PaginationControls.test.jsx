import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PaginationControls from './PaginationControls';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderPagination = (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onPageChange = jest.fn();

  act(() => {
    root.render(
      <PaginationControls page={1} totalPages={3} onPageChange={onPageChange} {...props} />
    );
  });

  return {
    container,
    onPageChange,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

describe('PaginationControls', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('expone navegación accesible y estados disabled en la primera página', () => {
    const view = renderPagination();
    const [previous, next] = view.container.querySelectorAll('button');

    expect(view.container.querySelector('nav').getAttribute('aria-label')).toBe('Paginación');
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(view.container.querySelector('select')).toBeNull();

    act(() => next.click());
    const updater = view.onPageChange.mock.calls[0][0];
    expect(updater(1)).toBe(2);
    view.unmount();
  });

  test('permite retroceder y deshabilita siguiente en la última de varias páginas', () => {
    const view = renderPagination({ page: 3, totalPages: 3 });
    const [previous, next] = view.container.querySelectorAll('button');

    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);

    act(() => previous.click());
    const updater = view.onPageChange.mock.calls[0][0];
    expect(updater(3)).toBe(2);
    view.unmount();
  });

  test('deshabilita ambos controles cuando existe una sola página', () => {
    const view = renderPagination({ page: 1, totalPages: 1 });
    const [previous, next] = view.container.querySelectorAll('button');

    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    view.unmount();
  });

  test('normaliza colecciones vacías al patrón visual Página 1 de 1', () => {
    const view = renderPagination({ page: 1, totalPages: 0 });
    const [previous, next] = view.container.querySelectorAll('button');

    expect(view.container.querySelector('.pagination-info').textContent).toContain('Página 1 de 1');
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    view.unmount();
  });

  test('no expone controles para cambiar el tamaño estándar de página', () => {
    const view = renderPagination();

    expect(view.container.querySelector('select')).toBeNull();
    view.unmount();
  });
});
