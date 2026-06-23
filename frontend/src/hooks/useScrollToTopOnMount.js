import { useLayoutEffect } from 'react';

const isFormControlFocused = () => {
  const activeElement = document.activeElement;
  return activeElement?.matches('input, textarea, select') ?? false;
};

export const resetViewportScroll = () => {
  if (isFormControlFocused()) return false;

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.documentElement.scrollLeft = 0;
  document.body.scrollTop = 0;
  document.body.scrollLeft = 0;

  return true;
};

const useScrollToTopOnMount = () => {
  useLayoutEffect(() => {
    resetViewportScroll();
  }, []);
};

export default useScrollToTopOnMount;
