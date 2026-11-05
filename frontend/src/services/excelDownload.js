import api from './api';
import {
  buildServiceFailure,
  getFilenameFromDisposition,
  saveBlobWithPickerOrDownload,
} from './serviceUtils';

// Descarga un reporte .xlsx del backend (con selector de destino cuando el navegador lo permite).
export const downloadExcel = async (path, params, fallbackName) => {
  try {
    const response = await api.get(path, { params, responseType: 'blob' });
    const fileName = getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      fallbackName
    );
    return await saveBlobWithPickerOrDownload(new Blob([response.data]), fileName, {
      description: 'Excel',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    });
  } catch (error) {
    return buildServiceFailure(error, 'Error al exportar reporte');
  }
};
