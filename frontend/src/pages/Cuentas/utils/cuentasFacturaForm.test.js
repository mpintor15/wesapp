import {
  buildFacturaPayload,
  calculateFacturaPreview,
  filterClientesBySearch,
  getExistingInvoiceNumbers,
  getNumFacturaError,
  shouldShowFacturaCalculation,
  validateFacturaForm,
} from './cuentasFacturaForm';

describe('cuentasFacturaForm', () => {
  test('calcula subtotal, IVA, retenciones y por cobrar', () => {
    expect(
      calculateFacturaPreview({
        valor_factura: '100',
        incluye_iva: true,
        incluye_retencion_fuente: true,
        incluye_retencion_iva: true,
      })
    ).toEqual({
      subtotal: 100,
      iva: 15,
      retencionFuente: 3,
      retencionIva: 10.5,
      porCobrar: 101.5,
    });
  });

  test('construye payload parseado para crear factura', () => {
    expect(
      buildFacturaPayload({
        num_factura: '12',
        cliente_id: '3',
        fecha_factura: '2026-07-09',
        valor_factura: '100.50',
        incluye_iva: true,
        incluye_retencion_fuente: false,
        incluye_retencion_iva: true,
      })
    ).toEqual({
      num_factura: 12,
      cliente_id: 3,
      fecha_factura: '2026-07-09',
      valor_factura: 100.5,
      incluye_iva: true,
      incluye_retencion_fuente: false,
      incluye_retencion_iva: true,
    });
  });

  test('valida factura obligatoria, duplicada y subtotal inválido', () => {
    const errors = validateFacturaForm(
      {
        num_factura: '12',
        cliente_id: '',
        fecha_factura: 'not-a-date',
        valor_factura: '-1',
        incluye_iva: false,
        incluye_retencion_iva: true,
      },
      new Set([12])
    );

    expect(errors).toEqual(
      expect.objectContaining({
        num_factura: expect.stringMatching(/registrado/),
        cliente_id: expect.stringMatching(/Selecciona/),
        fecha_factura: expect.stringMatching(/no es válida/),
        valor_factura: expect.stringMatching(/mayor a 0/),
        incluye_retencion_iva: expect.stringMatching(/IVA/),
      })
    );
  });

  test('extrae números de factura válidos existentes', () => {
    expect(
      Array.from(
        getExistingInvoiceNumbers([
          { num_factura: '3' },
          { num_factura: 4 },
          { num_factura: 'abc' },
          { num_factura: 0 },
        ])
      )
    ).toEqual([3, 4]);
  });

  test('prioriza error de factura duplicada sobre fallback', () => {
    expect(getNumFacturaError('7', new Set([7]), 'Fallback')).toMatch(/registrado/);
    expect(getNumFacturaError('8', new Set([7]), 'Fallback')).toBe('Fallback');
  });

  test('detecta cuándo mostrar preview de cálculo', () => {
    expect(
      shouldShowFacturaCalculation(
        { num_factura: '1', valor_factura: '0.01' },
        { cliente_id: '2', fecha_factura: '2026-07-09' }
      )
    ).toBe(true);
    expect(
      shouldShowFacturaCalculation(
        { num_factura: '0', valor_factura: '100' },
        { cliente_id: '2', fecha_factura: '2026-07-09' }
      )
    ).toBe(false);
  });

  test('filtra clientes por nombre o identificación', () => {
    const clientes = [
      { nombre: 'Ana Torres', identificacion: '0101' },
      { nombre: 'Luis Vera', identificacion: '0202' },
    ];

    expect(filterClientesBySearch(clientes, 'tor')).toEqual([clientes[0]]);
    expect(filterClientesBySearch(clientes, '0202')).toEqual([clientes[1]]);
  });

  test('omite clientes inactivos en buscadores operativos', () => {
    const clientes = [
      { nombre: 'Cliente Activo', identificacion: '0101', estado: 'activo' },
      { nombre: 'Cliente Inactivo', identificacion: '0202', estado: 'inactivo' },
    ];

    expect(filterClientesBySearch(clientes, 'cliente')).toEqual([clientes[0]]);
    expect(filterClientesBySearch(clientes, '0202')).toEqual([]);
  });
});
