import {
  buildFacturasReportParams,
  buildPagosReportParams,
  getInitialFacturasReportFilters,
  getInitialPagosReportFilters,
} from './cuentasReportParams';

describe('cuentasReportParams', () => {
  test('construye parámetros de facturas y omite vacíos', () => {
    expect(
      buildFacturasReportParams({
        fechaInicio: '2026-01-01',
        fechaFin: '',
        soloDeudores: true,
        agruparCliente: false,
      })
    ).toEqual({
      fecha_inicio: '2026-01-01',
      solo_deudores: true,
    });
  });

  test('construye parámetros de pagos y omite vacíos', () => {
    expect(
      buildPagosReportParams({
        fechaInicio: '',
        fechaFin: '2026-01-31',
        metodoPago: 'transferencia',
      })
    ).toEqual({
      fecha_fin: '2026-01-31',
      metodo_pago: 'transferencia',
    });
  });

  test('expone filtros iniciales independientes', () => {
    const facturas = getInitialFacturasReportFilters();
    const pagos = getInitialPagosReportFilters();

    facturas.fechaInicio = '2026-01-01';
    pagos.metodoPago = 'efectivo';

    expect(getInitialFacturasReportFilters().fechaInicio).toBe('');
    expect(getInitialPagosReportFilters().metodoPago).toBe('');
  });
});
