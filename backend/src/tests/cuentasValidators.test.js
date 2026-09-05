const {
  parsePositiveIntegerId,
  validateBatchPaymentPayload,
  validateClientePayload,
  validateFacturaCancellationDetail,
  validateFacturaCreatePayload,
  validateFacturaUpdatePayload,
} = require('../modules/cuentas/cuentas.validators');
const {
  calculateBatchPaymentTotal,
  normalizePaymentAmount,
  roundCurrency,
} = require('../modules/cuentas/cuentas.calculations');
const { CUENTAS_LIMITS, PAYMENT_METHODS } = require('../modules/cuentas/cuentas.constants');

describe('cuentas validators', () => {
  describe('parsePositiveIntegerId', () => {
    test.each([
      ['1', true, 1],
      [1, true, 1],
      ['0', false, undefined],
      [0, false, undefined],
      ['-1', false, undefined],
      ['1.5', false, undefined],
      ['abc', false, undefined],
      ['12abc', false, undefined],
      ['1e2', false, undefined],
      ['', false, undefined],
      ['   ', false, undefined],
      [String(Number.MAX_SAFE_INTEGER + 1), false, undefined],
      [null, false, undefined],
      [undefined, false, undefined],
    ])('valida ID %p', (value, expectedValid, expectedValue) => {
      const result = parsePositiveIntegerId(value, 'ID inválido');

      expect(result.valid).toBe(expectedValid);
      if (expectedValid) {
        expect(result.value).toBe(expectedValue);
      } else {
        expect(result.message).toBe('ID inválido');
        expect(result.status).toBe(400);
      }
    });
  });

  describe('clientes', () => {
    test('normaliza cliente válido', () => {
      expect(validateClientePayload({ nombre: ' Ana ', identificacion: ' 0101 ' })).toEqual({
        valid: true,
        value: { nombre: 'Ana', identificacion: '0101' },
      });
    });

    test('preserva orden de errores de cliente', () => {
      expect(validateClientePayload({ nombre: '', identificacion: '' }).message).toBe(
        'El nombre del cliente es requerido'
      );
      expect(validateClientePayload({ nombre: 'Ana', identificacion: '   ' }).message).toBe(
        'La identificación del cliente es requerida'
      );
    });
  });

  describe('facturas', () => {
    test('normaliza creación de factura válida', () => {
      expect(
        validateFacturaCreatePayload({
          num_factura: '1001',
          cliente_id: '7',
          fecha_factura: '2024-01-01',
          valor_factura: '10.50',
          incluye_iva: true,
          incluye_retencion_fuente: false,
          incluye_retencion_iva: true,
        })
      ).toEqual({
        valid: true,
        value: {
          parsedNumFactura: 1001,
          parsedClienteId: 7,
          parsedValorFactura: 10.5,
          fecha_factura: '2024-01-01',
          incluye_iva: true,
          incluye_retencion_fuente: false,
          incluye_retencion_iva: true,
        },
      });
    });

    test('preserva orden de errores de creación de factura', () => {
      expect(validateFacturaCreatePayload({}).message).toBe(
        'Todos los campos son requeridos: num_factura, cliente_id, fecha_factura, valor_factura'
      );
      expect(
        validateFacturaCreatePayload({
          num_factura: '1.5',
          cliente_id: 'x',
          fecha_factura: 'bad',
          valor_factura: '-1',
        }).message
      ).toBe('El número de factura debe ser un entero mayor a 0');
    });

    test('valida subtotal, fecha y retención IVA de creación', () => {
      expect(
        validateFacturaCreatePayload({
          num_factura: 1,
          cliente_id: 1,
          fecha_factura: '2024-01-01',
          valor_factura: 0,
        }).message
      ).toBe(
        'Todos los campos son requeridos: num_factura, cliente_id, fecha_factura, valor_factura'
      );
      expect(
        validateFacturaCreatePayload({
          num_factura: 1,
          cliente_id: 1,
          fecha_factura: '2026-02-30',
          valor_factura: 10,
        }).message
      ).toBe('La fecha de factura no es válida');
      expect(
        validateFacturaCreatePayload({
          num_factura: 1,
          cliente_id: 1,
          fecha_factura: '2024-01-01',
          valor_factura: 10,
          incluye_iva: false,
          incluye_retencion_iva: true,
        }).message
      ).toBe('La retención de IVA requiere que IVA esté habilitado');
    });

    test('acepta valor_factura en el límite de NUMERIC(10,2) y rechaza si lo excede con 400', () => {
      expect(
        validateFacturaCreatePayload({
          num_factura: 1,
          cliente_id: 1,
          fecha_factura: '2024-01-01',
          valor_factura: '99999999.99',
        })
      ).toMatchObject({ valid: true, value: { parsedValorFactura: 99999999.99 } });

      const overLimit = validateFacturaCreatePayload({
        num_factura: 1,
        cliente_id: 1,
        fecha_factura: '2024-01-01',
        valor_factura: '999999999999',
      });
      expect(overLimit.valid).toBe(false);
      expect(overLimit.status).toBe(400);
      expect(overLimit.message).toBe('El valor de la factura debe ser mayor a 0');
    });

    test('normaliza actualización y desactiva retención IVA sin IVA', () => {
      expect(
        validateFacturaUpdatePayload({
          cliente_id: '3',
          fecha_factura: '2024-01-01',
          valor_factura: '99.99',
          incluye_iva: false,
          incluye_retencion_fuente: true,
          incluye_retencion_iva: true,
        })
      ).toEqual({
        valid: true,
        value: {
          parsedClienteId: 3,
          parsedValorFactura: 99.99,
          fecha_factura: '2024-01-01',
          incluye_iva: false,
          incluye_retencion_fuente: true,
          incluye_retencion_iva: false,
        },
      });
    });

    test('preserva errores de actualización de factura', () => {
      expect(validateFacturaUpdatePayload({}).message).toBe(
        'Campos requeridos: cliente_id, fecha_factura, valor_factura'
      );
      expect(
        validateFacturaUpdatePayload({
          cliente_id: 'abc',
          fecha_factura: '2024-01-01',
          valor_factura: 10,
        }).message
      ).toBe('El cliente especificado no es válido');
      expect(
        validateFacturaUpdatePayload({
          cliente_id: '1',
          fecha_factura: '2026-13-01',
          valor_factura: 10,
        }).message
      ).toBe('La fecha de factura no es válida');
    });
  });

  describe('anulación', () => {
    test('normaliza detalle válido', () => {
      expect(validateFacturaCancellationDetail('  Error operativo  ')).toEqual({
        valid: true,
        value: 'Error operativo',
      });
    });

    test.each(['', '   ', null, undefined])('rechaza detalle %p', (detalle) => {
      expect(validateFacturaCancellationDetail(detalle).message).toBe(
        'El detalle de anulación es obligatorio'
      );
    });
  });

  describe('pagos por lote', () => {
    test('usa métodos de pago y límites reales', () => {
      expect(PAYMENT_METHODS).toEqual(['efectivo', 'transferencia', 'cheque', 'otro']);
      expect(CUENTAS_LIMITS).toEqual({
        PAYMENT_REFERENCE_MAX_LENGTH: 100,
        PAYMENT_NOTES_MAX_LENGTH: 500,
      });
    });

    test('normaliza lote válido y redondea montos', () => {
      const result = validateBatchPaymentPayload({
        cliente_id: '8',
        fecha: '2024-01-01',
        metodo_pago: ' TRANSFERENCIA ',
        referencia: ' ref ',
        notas: ' nota ',
        abonos: [
          { num_factura: '1001', valor_abono: '10.239' },
          { num_factura: 1002, valor_abono: 20 },
        ],
      });

      expect(result).toEqual({
        valid: true,
        value: {
          parsedClienteId: 8,
          fecha: '2024-01-01',
          metodoPagoNormalizado: 'transferencia',
          referenciaNormalizada: 'ref',
          notasNormalizadas: 'nota',
          abonosNormalizados: [
            { num_factura: 1001, valor_abono: 10.24 },
            { num_factura: 1002, valor_abono: 20 },
          ],
          total: 30.24,
        },
      });
    });

    test('rechaza fecha imposible, factura parcial y notación científica', () => {
      expect(
        validateBatchPaymentPayload({
          cliente_id: '8',
          fecha: '2026-02-30',
          abonos: [{ num_factura: '1001', valor_abono: '10' }],
        }).message
      ).toBe('La fecha del pago es obligatoria y debe ser válida');

      expect(
        validateBatchPaymentPayload({
          cliente_id: '8',
          fecha: '2024-01-01',
          abonos: [{ num_factura: '1001abc', valor_abono: '10' }],
        }).message
      ).toBe('Cada abono debe tener num_factura y valor_abono mayor a 0');

      expect(
        validateBatchPaymentPayload({
          cliente_id: '8',
          fecha: '2024-01-01',
          abonos: [{ num_factura: '1001', valor_abono: '1e2' }],
        }).message
      ).toBe('Cada abono debe tener num_factura y valor_abono mayor a 0');

      const overLimit = validateBatchPaymentPayload({
        cliente_id: '8',
        fecha: '2024-01-01',
        abonos: [{ num_factura: '1001', valor_abono: '999999999999' }],
      });
      expect(overLimit.valid).toBe(false);
      expect(overLimit.status).toBe(400);
      expect(overLimit.message).toBe('Cada abono debe tener num_factura y valor_abono mayor a 0');
    });

    test('preserva orden de errores de lote', () => {
      expect(validateBatchPaymentPayload({}).message).toBe(
        'Se requiere un cliente válido para registrar el pago'
      );
      expect(validateBatchPaymentPayload({ cliente_id: 1 }).message).toBe(
        'La fecha del pago es obligatoria y debe ser válida'
      );
      expect(
        validateBatchPaymentPayload({
          cliente_id: 1,
          fecha: '2024-01-01',
          metodo_pago: 'tarjeta',
        }).message
      ).toBe('El método de pago no es válido');
    });

    test('valida límites, lista vacía, abono inválido y duplicados', () => {
      expect(
        validateBatchPaymentPayload({
          cliente_id: 1,
          fecha: '2024-01-01',
          referencia: 'x'.repeat(101),
        }).message
      ).toBe('La referencia no puede superar los 100 caracteres');
      expect(
        validateBatchPaymentPayload({
          cliente_id: 1,
          fecha: '2024-01-01',
          notas: 'x'.repeat(501),
        }).message
      ).toBe('Las notas no pueden superar los 500 caracteres');
      expect(
        validateBatchPaymentPayload({ cliente_id: 1, fecha: '2024-01-01', abonos: [] }).message
      ).toBe('Debes seleccionar al menos una factura con monto');
      expect(
        validateBatchPaymentPayload({
          cliente_id: 1,
          fecha: '2024-01-01',
          abonos: [{ num_factura: 1, valor_abono: 0 }],
        }).message
      ).toBe('Cada abono debe tener num_factura y valor_abono mayor a 0');
      expect(
        validateBatchPaymentPayload({
          cliente_id: 1,
          fecha: '2024-01-01',
          abonos: [
            { num_factura: 1, valor_abono: 1 },
            { num_factura: 1, valor_abono: 2 },
          ],
        }).message
      ).toBe('La factura #1 está repetida en la distribución');
    });
  });
});

describe('cuentas calculations', () => {
  test('redondea importes y total del batch igual que el controller original', () => {
    expect(roundCurrency(10.235)).toBe(10.24);
    expect(normalizePaymentAmount(1.234)).toBe(1.23);
    expect(calculateBatchPaymentTotal([{ valor_abono: 10.24 }, { valor_abono: 20 }])).toBe(30.24);
  });
});
