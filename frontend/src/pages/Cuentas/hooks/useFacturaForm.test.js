import cuentasService from '../../../services/cuentasService';
import { act, renderHook } from '../../../testUtils/renderHook';
import useFacturaForm from './useFacturaForm';

jest.mock('../../../services/cuentasService');

const clientes = [
  { id: 1, nombre: 'Ana Torres', identificacion: '0101' },
  { id: 2, nombre: 'Luis Vera', identificacion: '0202' },
];

const baseProps = (overrides = {}) => ({
  clientes,
  reporte: [],
  isGerente: true,
  showToast: jest.fn(),
  onCreated: jest.fn(),
  ...overrides,
});

const changeField = (hook, target) => {
  act(() => {
    hook.result.handleFormChange({ target });
  });
};

describe('useFacturaForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cuentasService.createFactura.mockResolvedValue({ success: true });
  });

  test('handleFormChange actualiza campos y desactiva retención IVA si se apaga IVA', () => {
    const hook = renderHook(() => useFacturaForm(baseProps()));

    changeField(hook, { name: 'incluye_retencion_iva', type: 'checkbox', checked: true });
    changeField(hook, { name: 'incluye_iva', type: 'checkbox', checked: false });

    expect(hook.result.formData.incluye_iva).toBe(false);
    expect(hook.result.formData.incluye_retencion_iva).toBe(false);

    hook.unmount();
  });

  test('selección y búsqueda de cliente actualizan estado relacionado', () => {
    const hook = renderHook(() => useFacturaForm(baseProps()));

    act(() => {
      hook.result.handleClienteSelect(clientes[0]);
    });

    expect(hook.result.formData.cliente_id).toBe(1);
    expect(hook.result.clienteSearch).toBe('Ana Torres');
    expect(hook.result.selectedCliente).toEqual(clientes[0]);

    act(() => {
      hook.result.handleClienteSearchChange({ target: { value: 'Luis' } });
    });

    expect(hook.result.formData.cliente_id).toBe('');
    expect(hook.result.selectedCliente).toBeNull();
    expect(hook.result.filteredClientes).toEqual([clientes[1]]);

    hook.unmount();
  });

  test('submit inválido setea errores y muestra primer error', async () => {
    const props = baseProps();
    const hook = renderHook(() => useFacturaForm(props));

    await act(async () => {
      await hook.result.handleCreateFactura({ preventDefault: jest.fn() });
    });

    expect(cuentasService.createFactura).not.toHaveBeenCalled();
    expect(hook.result.facturaErrors).toEqual(
      expect.objectContaining({ num_factura: 'Ingresa el número de factura' })
    );
    expect(props.showToast).toHaveBeenCalledWith('Ingresa el número de factura', 'error');

    hook.unmount();
  });

  test('submit exitoso envía payload parseado, cierra modal y llama onCreated', async () => {
    const props = baseProps();
    const hook = renderHook(() => useFacturaForm(props));

    act(() => {
      hook.result.open();
    });
    changeField(hook, { name: 'num_factura', type: 'text', value: '12' });
    changeField(hook, { name: 'cliente_id', type: 'text', value: '1' });
    changeField(hook, { name: 'fecha_factura', type: 'date', value: '2026-07-09' });
    changeField(hook, { name: 'valor_factura', type: 'text', value: '100.50' });
    changeField(hook, { name: 'incluye_iva', type: 'checkbox', checked: true });

    await act(async () => {
      await hook.result.handleCreateFactura({ preventDefault: jest.fn() });
    });

    expect(cuentasService.createFactura).toHaveBeenCalledWith({
      num_factura: 12,
      cliente_id: 1,
      fecha_factura: '2026-07-09',
      valor_factura: 100.5,
      incluye_iva: true,
      incluye_retencion_fuente: false,
      incluye_retencion_iva: false,
    });
    expect(props.showToast).toHaveBeenCalledWith('Factura creada exitosamente', 'success');
    expect(props.onCreated).toHaveBeenCalled();
    expect(hook.result.isOpen).toBe(false);

    hook.unmount();
  });
});
