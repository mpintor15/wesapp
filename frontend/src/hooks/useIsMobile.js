import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 600px)';

const getInitialMobileState = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(MOBILE_QUERY).matches;

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(getInitialMobileState);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
};

export default useIsMobile;
