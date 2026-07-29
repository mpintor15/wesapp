import api from './api';
import cuentasService from './cuentasService';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('./serviceUtils', () => ({
  extractError: jest.fn((error, fallback) => error?.response?.data?.message || fallback),
  getFilenameFromDisposition: jest.fn((_, fallback) => fallback),
  saveBlobWithPickerOrDownload: jest.fn(),
}));

describe('cuentasService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('anula facturas solo con PATCH de cancelacion', async () => {
    api.patch.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Factura anulada exitosamente',
        data: { num_factura: 1001 },
      },
    });

    const result = await cuentasService.cancelFactura(1001, {
      detalle_anulacion: 'Error de emision',
    });

    expect(result.success).toBe(true);
    expect(api.patch).toHaveBeenCalledWith('/cuentas/facturas/1001/cancelar', {
      detalle_anulacion: 'Error de emision',
    });
    expect(api.delete).not.toHaveBeenCalled();
    expect(cuentasService.deleteFactura).toBeUndefined();
    expect(cuentasService.deleteAbono).toBeUndefined();
  });
});
