import api from './api';
import cuentasService from './cuentasService';
import { saveBlobWithPickerOrDownload } from './serviceUtils';

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

  test('getReporte conserva parámetros y metadata de paginación del backend', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [{ num_factura: 1001 }],
        pagination: {
          page: 2,
          pageSize: 50,
          totalItems: 60,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      },
    });

    const result = await cuentasService.getReporte({
      page: 2,
      pageSize: 50,
      search: 'Acme',
      sortBy: 'fecha_factura',
      sortOrder: 'desc',
    });

    expect(api.get).toHaveBeenCalledWith('/cuentas/reporte', {
      params: {
        page: 2,
        pageSize: 50,
        search: 'Acme',
        sortBy: 'fecha_factura',
        sortOrder: 'desc',
      },
    });
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 50,
      totalItems: 60,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  test('getPagos conserva filtros paginados y metadata vacía', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [],
        pagination: {
          page: 4,
          pageSize: 25,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      },
    });

    const result = await cuentasService.getPagos({
      page: 4,
      pageSize: 25,
      metodo_pago: 'efectivo',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-01-31',
    });

    expect(api.get).toHaveBeenCalledWith('/cuentas/pagos', {
      params: {
        page: 4,
        pageSize: 25,
        metodo_pago: 'efectivo',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-01-31',
      },
    });
    expect(result.data).toEqual([]);
    expect(result.pagination.totalItems).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });

  test('catálogo de facturas no usa parámetros de paginación', async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: [{ num_factura: 2001 }] },
    });

    const result = await cuentasService.getFacturasCatalogo();

    expect(result.data).toEqual([{ num_factura: 2001 }]);
    expect(api.get).toHaveBeenCalledWith('/cuentas/facturas/catalogo');
  });

  test('exportaciones de Cuentas conservan filtros sin page ni pageSize implícitos', async () => {
    api.get.mockResolvedValue({
      data: new Blob(['excel']),
      headers: {},
    });
    saveBlobWithPickerOrDownload.mockResolvedValue({ success: true });

    await cuentasService.exportExcel({ solo_deudores: 'true', search: 'Acme' });
    await cuentasService.exportPagosExcel({ metodo_pago: 'transferencia' });

    expect(api.get).toHaveBeenNthCalledWith(1, '/cuentas/reporte/excel', {
      params: { solo_deudores: 'true', search: 'Acme' },
      responseType: 'blob',
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/cuentas/pagos/excel', {
      responseType: 'blob',
      params: { metodo_pago: 'transferencia' },
    });
  });
});
