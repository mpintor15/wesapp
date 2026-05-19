/**
 * serviceUtils.js — utilidades compartidas para servicios frontend
 */

/**
 * Extrae el mensaje de error más útil desde un error de Axios.
 */
export const extractError = (error, fallback) => {
  const bodyMessage = error?.response?.data?.message;
  if (bodyMessage) return bodyMessage;

  if (typeof error?.response?.data === 'string' && error.response.data.trim()) {
    return error.response.data.trim();
  }

  return fallback;
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
        types: pickerType ? [pickerType] : undefined
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
