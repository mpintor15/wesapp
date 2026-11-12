import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useAutoRefresh, { AUTO_REFRESH_MS } from './useAutoRefresh';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const Probe = ({ callback, enabled = true }) => {
  useAutoRefresh(callback, { enabled });
  return null;
};

const setHidden = (hidden) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
};

let root;
let container;

const render = (element) => {
  act(() => root.render(element));
};

describe('useAutoRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setHidden(false);
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    jest.useRealTimers();
    setHidden(false);
  });

  test('ejecuta el callback cada 10 segundos', () => {
    const callback = jest.fn();
    render(<Probe callback={callback} />);
    expect(AUTO_REFRESH_MS).toBe(10000);
    act(() => jest.advanceTimersByTime(AUTO_REFRESH_MS * 2));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('no ejecuta mientras la pestaña está oculta', () => {
    const callback = jest.fn();
    render(<Probe callback={callback} />);
    setHidden(true);
    act(() => jest.advanceTimersByTime(AUTO_REFRESH_MS));
    expect(callback).not.toHaveBeenCalled();
  });

  test('refresca de inmediato al volver a la pestaña', () => {
    const callback = jest.fn();
    render(<Probe callback={callback} />);
    act(() => {
      document.dispatchEvent(new window.Event('visibilitychange'));
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('no corre cuando está deshabilitado y se limpia al desmontar', () => {
    const callback = jest.fn();
    render(<Probe callback={callback} enabled={false} />);
    act(() => jest.advanceTimersByTime(AUTO_REFRESH_MS));
    expect(callback).not.toHaveBeenCalled();
    render(<Probe callback={callback} enabled />);
    act(() => root.unmount());
    root = createRoot(container);
    act(() => jest.advanceTimersByTime(AUTO_REFRESH_MS));
    expect(callback).not.toHaveBeenCalled();
  });
});
