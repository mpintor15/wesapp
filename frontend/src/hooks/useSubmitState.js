import { useState, useCallback } from 'react';

/**
 * Custom hook para prevenir doble-submit de formularios
 * Maneja el estado de carga y previene múltiples envíos simultáneos
 *
 * @returns {Object} { isSubmitting, withSubmit }
 *
 * Ejemplo de uso:
 * const { isSubmitting, withSubmit } = useSubmitState();
 *
 * const handleSubmit = withSubmit(async () => {
 *   await someAsyncOperation();
 * });
 */
export const useSubmitState = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const withSubmit = useCallback((asyncFn) => {
    return async (...args) => {
      // Prevenir doble-submit
      if (isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await asyncFn(...args);
        return result;
      } catch (error) {
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    };
  }, [isSubmitting]);

  return { isSubmitting, withSubmit };
};

export default useSubmitState;
