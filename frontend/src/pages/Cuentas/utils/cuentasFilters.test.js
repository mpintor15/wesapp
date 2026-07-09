import {
  calculateFacturaTotals,
  filterAndSortFacturas,
  filterAndSortPagos,
  paginateRows,
  toReportDate,
} from './cuentasFilters';

describe('cuentasFilters', () => {
  test('parsea fechas ISO simples y rechaza inválidas', () => {
    expect(toReportDate('2026-07-09')?.getFullYear()).toBe(2026);
    expect(toReportDate('not-a-date')).toBeNull();
  });

  test('filtra facturas por saldo, estado, búsqueda y fecha', () => {
    const facturas = [
      {
        num_factura: 1,
        cliente: 'Ana',
        fecha_factura: '2026-01-01',
        saldo_pendiente: '10',
        cancelada: false,
      },
      {
        num_factura: 2,
        cliente: 'Luis',
        fecha_factura: '2026-02-01',
        saldo_pendiente: '0',
        cancelada: false,
      },
      {
        num_factura: 3,
        cliente: 'Ana',
        fecha_factura: '2026-03-01',
        saldo_pendiente: '5',
        cancelada: true,
      },
    ];

    expect(
      filterAndSortFacturas(
        facturas,
        {
          fechaInicio: '2026-01-01',
          fechaFin: '2026-02-28',
          conSaldo: true,
          estado: 'activa',
          search: 'ana',
        },
        { field: 'num_factura', direction: 'asc' }
      )
    ).toEqual([facturas[0]]);
  });

  test('ordena pagos por total con desempate por fecha descendente', () => {
    const pagos = [
      { id: 1, fecha: '2026-01-01', total: '20', cliente: 'A' },
      { id: 2, fecha: '2026-02-01', total: '20', cliente: 'B' },
      { id: 3, fecha: '2026-03-01', total: '10', cliente: 'C' },
    ];

    expect(
      filterAndSortPagos(
        pagos,
        { search: '', metodoPago: '' },
        { field: 'total', direction: 'asc' }
      ).map((p) => p.id)
    ).toEqual([3, 2, 1]);
  });

  test('calcula totales excluyendo facturas anuladas', () => {
    expect(
      calculateFacturaTotals([
        { subtotal: '100', iva: '15', por_cobrar: '115', saldo_pendiente: '50', cancelada: false },
        {
          subtotal: '1000',
          iva: '150',
          por_cobrar: '1150',
          saldo_pendiente: '1150',
          cancelada: true,
        },
      ])
    ).toEqual(
      expect.objectContaining({
        subtotal: 100,
        iva: 15,
        total: 115,
        por_cobrar: 115,
        saldo_pendiente: 50,
      })
    );
  });

  test('pagina filas sin alterar el arreglo original', () => {
    const rows = [1, 2, 3, 4, 5];
    expect(paginateRows(rows, 2, 2)).toEqual([3, 4]);
    expect(rows).toEqual([1, 2, 3, 4, 5]);
  });
});
