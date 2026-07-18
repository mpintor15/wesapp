import {
  applyEditFacturaFieldChange,
  buildEditFacturaFormData,
  buildUpdateFacturaPayload,
  validateEditFacturaForm,
} from './facturaEditing';

describe('facturaEditing', () => {
  test('transforma factura existente a formulario editable', () => {
    expect(
      buildEditFacturaFormData({
        cliente_id: 7,
        fecha_factura: '2026-07-09T05:00:00.000Z',
        subtotal: '125.50',
        incluye_iva: 1,
        incluye_retencion_fuente: false,
        incluye_retencion_iva: true,
      })
    ).toEqual({
      cliente_id: '7',
      fecha_factura: '2026-07-09',
      valor_factura: '125.5',
      incluye_iva: true,
      incluye_retencion_fuente: false,
      incluye_retencion_iva: true,
    });
  });

  test('checkbox de IVA mantiene la regla de retención IVA', () => {
    const next = applyEditFacturaFieldChange(
      { incluye_iva: true, incluye_retencion_iva: true },
      { name: 'incluye_iva', type: 'checkbox', checked: false }
    );

    expect(next.incluye_iva).toBe(false);
    expect(next.incluye_retencion_iva).toBe(false);
  });

  test('valida campos requeridos y subtotal mayor a cero', () => {
    expect(validateEditFacturaForm({ cliente_id: '', fecha_factura: '', valor_factura: '' })).toBe(
      'Todos los campos son requeridos'
    );
    expect(
      validateEditFacturaForm({
        cliente_id: '1',
        fecha_factura: '2026-07-09',
        valor_factura: '0',
      })
    ).toBe('El subtotal debe ser mayor a 0');
  });

  test('construye payload exacto para actualizar factura', () => {
    expect(
      buildUpdateFacturaPayload({
        cliente_id: '3',
        fecha_factura: '2026-07-09',
        valor_factura: '99.75',
        incluye_iva: true,
        incluye_retencion_fuente: false,
        incluye_retencion_iva: true,
      })
    ).toEqual({
      cliente_id: 3,
      fecha_factura: '2026-07-09',
      valor_factura: 99.75,
      incluye_iva: true,
      incluye_retencion_fuente: false,
      incluye_retencion_iva: true,
    });
  });
});
