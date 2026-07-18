import cuentasService from '../../../services/cuentasService';
import { act, renderHook } from '../../../testUtils/renderHook';
import useClientesActions, { validateClienteForm } from './useClientesActions';

jest.mock('../../../services/cuentasService');

const baseProps = (overrides = {}) => ({
  showToast: jest.fn(),
  onClienteCreated: jest.fn(),
  onClienteDeleted: jest.fn(),
  ...overrides,
});

describe('useClientesActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cuentasService.createCliente.mockResolvedValue({ success: true });
    cuentasService.deleteCliente.mockResolvedValue({ success: true });
  });

  test('valida nombre e identificación requeridos', () => {
    expect(validateClienteForm({ nombre: '', identificacion: '' })).toEqual({
      nombre: 'Ingresa el nombre del cliente',
      identificacion: 'Ingresa la identificación del cliente',
    });
  });

  test('crea cliente con payload preservado y ejecuta callbacks', async () => {
    const props = baseProps();
    const onSuccess = jest.fn();
    const hook = renderHook(() => useClientesActions(props));

    await act(async () => {
      await hook.result.createCliente({
        nombre: 'Ana Torres',
        identificacion: '0101',
        onValidationError: jest.fn(),
        onSuccess,
      });
    });

    expect(cuentasService.createCliente).toHaveBeenCalledWith('Ana Torres', '0101');
    expect(props.showToast).toHaveBeenCalledWith('Cliente creado exitosamente', 'success');
    expect(onSuccess).toHaveBeenCalled();
    expect(props.onClienteCreated).toHaveBeenCalled();

    hook.unmount();
  });

  test('elimina cliente y limpia confirmación al finalizar', async () => {
    const props = baseProps();
    const onSettled = jest.fn();
    const hook = renderHook(() => useClientesActions(props));

    await act(async () => {
      await hook.result.deleteCliente({ id: 5 }, onSettled);
    });

    expect(cuentasService.deleteCliente).toHaveBeenCalledWith(5);
    expect(props.showToast).toHaveBeenCalledWith('Cliente eliminado exitosamente', 'success');
    expect(props.onClienteDeleted).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();

    hook.unmount();
  });
});
