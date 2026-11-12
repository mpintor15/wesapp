import { useEffect, useRef } from 'react';

// Intervalo único de actualización automática de las tablas (en milisegundos).
export const AUTO_REFRESH_MS = 10000;

/**
 * Ejecuta `callback` cada `intervalMs` mientras la pestaña esté visible, y
 * una vez más al volver a ella. Pensado para recargar tablas en silencio:
 * el callback debe usar el modo `silent` del cargador (sin spinner ni toasts).
 */
const useAutoRefresh = (callback, { intervalMs = AUTO_REFRESH_MS, enabled = true } = {}) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;
    const tick = () => {
      if (!document.hidden) callbackRef.current?.();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, intervalMs]);
};

export default useAutoRefresh;
