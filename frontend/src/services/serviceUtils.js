/**
 * serviceUtils.js — utilidades compartidas para servicios frontend
 */

/**
 * Extrae el mensaje de error más útil desde un error de Axios.
 */
export const extractError = (error, fallback) => {
  return normalizeServiceError(error, fallback).message;
};

const getResponseBody = (error) => error?.response?.data;

export const normalizeServiceError = (error, fallback = 'Ocurrió un error') => {
  const status = error?.response?.status;
  const body = getResponseBody(error);
  const isNetworkError =
    Boolean(error?.request && !error?.response) || error?.code === 'ECONNABORTED';
  const bodyMessage = body?.message;
  const textBody = typeof body === 'string' && body.trim() ? body.trim() : '';

  return {
    message:
      bodyMessage ||
      textBody ||
      (isNetworkError
        ? 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.'
        : fallback),
    status,
    code: body?.code,
    details: body?.details,
    isNetworkError,
    originalError: error,
  };
};

export const buildServiceFailure = (error, fallback) => ({
  success: false,
  ...normalizeServiceError(error, fallback),
});

export const getVisibleErrorMessage = (result, fallback = 'Ocurrió un error') => {
  if (!result) return fallback;

  if (result.isNetworkError) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.';
  }

  if (result.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (result.status === 403) return 'No tienes permisos para realizar esta acción.';
  if (result.status === 404) return 'El registro ya no existe o fue eliminado.';

  if (result.status === 409) {
    if (result.code === 'CLIENT_HAS_RELATIONS') {
      return (
        result.message || 'El cliente tiene historial. Desactívalo para conservar sus registros.'
      );
    }
    if (result.code === 'USER_HAS_ACTIVITY') {
      return (
        result.message || 'El usuario tiene actividad. Desactívalo para conservar el historial.'
      );
    }
    return result.message || fallback;
  }

  if (result.status === 400 || result.status === 422) return result.message || fallback;
  if (result.status >= 500) return 'Ocurrió un error interno. Inténtalo nuevamente.';

  return result.message || fallback;
};

/**
 * Descarga un Blob usando enlace temporal.
 */
export const triggerBlobDownload = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Intenta guardar con File System Access API y si falla usa descarga clásica.
 */
export const saveBlobWithPickerOrDownload = async (blob, fileName, pickerType) => {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        startIn: 'downloads',
        types: pickerType ? [pickerType] : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { success: false, cancelled: true, message: 'Guardado cancelado' };
      }
      triggerBlobDownload(blob, fileName);
      return { success: true };
    }
  }

  triggerBlobDownload(blob, fileName);
  return { success: true };
};

/**
 * Obtiene nombre de archivo desde Content-Disposition.
 */
export const getFilenameFromDisposition = (disposition, fallbackName) => {
  if (!disposition) return fallbackName;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const basicMatch = disposition.match(/filename="?([^"]+)"?/i);
  return basicMatch?.[1] || fallbackName;
};
