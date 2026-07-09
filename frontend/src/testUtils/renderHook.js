import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export { act };

export const renderHook = (callback) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let result;

  const TestComponent = ({ props }) => {
    result = callback(props);
    return null;
  };

  const render = (props) => {
    act(() => {
      root.render(<TestComponent props={props} />);
    });
  };

  render();

  return {
    get result() {
      return result;
    },
    rerender(props) {
      render(props);
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

export const flushPromises = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
