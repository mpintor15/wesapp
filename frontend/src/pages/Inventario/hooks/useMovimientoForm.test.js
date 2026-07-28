import useMovimientoForm from './useMovimientoForm';
import inventarioService from '../../../services/inventarioService';
import { act, renderHook } from '../../../testUtils/renderHook';

jest.mock('../../../services/inventarioService', () => ({
  __esModule: true,
  default: {
    createMovimiento: jest.fn(),
  },
}));

const submitEvent = () => ({ preventDefault: jest.fn() });

const catalogArticulos = [
  {
    id: 7,
    tipo_articulo: 'radio',
    nombre_articulo: 'Radio portátil',
    codigo_radio: 'RAD-7',
    talla: 'M',
  },
];

describe('useMovimientoForm', () => {
  const showMessage = jest.fn();
  const onCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    inventarioService.createMovimiento.mockResolvedValue({ success: true });
  });

  test('abre, resetea y cierra el formulario', () => {
    const hook = renderHook(() => useMovimientoForm({ catalogArticulos, showMessage, onCreated }));

    act(() => {
      hook.result.open();
    });

    expect(hook.result.isOpen).toBe(true);
    expect(hook.result.movimientoForm.items).toEqual([{ articulo_id: '', cantidad: 1, talla: '' }]);
    expect(hook.result.itemSearchTerms).toEqual(['']);

    act(() => {
      hook.result.close();
    });

    expect(hook.result.isOpen).toBe(false);

    hook.unmount();
  });

  test('actualiza campos del movimiento y limpia errores del campo', () => {
    const hook = renderHook(() => useMovimientoForm({ catalogArticulos, showMessage, onCreated }));

    act(() => {
      hook.result.handleMovimientoFormChange({
        target: { name: 'ubicacion_destino_nombre', value: 'Bodega norte' },
      });
    });

    expect(hook.result.movimientoForm.ubicacion_destino_nombre).toBe('Bodega norte');
    expect(hook.result.movimientoErrors.ubicacion_destino_nombre).toBe('');

    hook.unmount();
  });

  test('agrega, elimina y selecciona artículos del movimiento', () => {
    const hook = renderHook(() => useMovimientoForm({ catalogArticulos, showMessage, onCreated }));

    act(() => {
      hook.result.handleAddMovimientoItem();
      hook.result.selectArticuloForItem(0, catalogArticulos[0]);
    });

    expect(hook.result.movimientoForm.items).toHaveLength(2);
    expect(hook.result.movimientoForm.items[0]).toEqual({
      articulo_id: '7',
      cantidad: 1,
      talla: 'M',
    });
    expect(hook.result.itemSearchTerms[0]).toContain('Radio portátil');
    expect(hook.result.itemDropdownOpen[0]).toBe(false);

    act(() => {
      hook.result.clearArticuloForItem(0);
      hook.result.handleRemoveMovimientoItem(1);
    });

    expect(hook.result.movimientoForm.items).toEqual([{ articulo_id: '', cantidad: 1, talla: '' }]);

    hook.unmount();
  });

  test('filtra artículos usando el catálogo recibido', () => {
    const hook = renderHook(() => useMovimientoForm({ catalogArticulos, showMessage, onCreated }));

    expect(hook.result.filterArticulos('rad-7')).toEqual([catalogArticulos[0]]);

    hook.unmount();
  });

  test('submit inválido setea errores y muestra el primer error', async () => {
    const hook = renderHook(() => useMovimientoForm({ catalogArticulos, showMessage, onCreated }));

    await act(async () => {
      await hook.result.handleCreateMovimiento(submitEvent());
    });

    expect(inventarioService.createMovimiento).not.toHaveBeenCalled();
    expect(hook.result.movimientoErrors).toEqual(
      expect.objectContaining({
        cliente_destino_id: 'Selecciona el cliente destino',
        items: 'Selecciona los artículos del movimiento',
        ubicacion_destino_nombre: 'Ingresa la ubicación destino',
      })
    );
    expect(showMessage).toHaveBeenCalledWith('error', 'Selecciona los artículos del movimiento');

    hook.unmount();
  });

  test('submit exitoso envía payload, cierra modal y recarga datos externos', async () => {
    const hook = renderHook(() => useMovimientoForm({ catalogArticulos, showMessage, onCreated }));

    act(() => {
      hook.result.open();
      hook.result.handleMovimientoFormChange({
        target: { name: 'cliente_destino_id', value: '4' },
      });
      hook.result.handleMovimientoFormChange({
        target: { name: 'ubicacion_destino_nombre', value: 'Bodega norte' },
      });
      hook.result.selectArticuloForItem(0, catalogArticulos[0]);
      hook.result.handleMovimientoItemChange(0, 'cantidad', '3');
    });

    await act(async () => {
      await hook.result.handleCreateMovimiento(submitEvent());
    });

    expect(inventarioService.createMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({
        cliente_destino_id: 4,
        ubicacion_destino_nombre: 'Bodega norte',
        items: [{ articulo_id: 7, cantidad: 3, talla: 'M' }],
      })
    );
    expect(showMessage).toHaveBeenCalledWith('success', 'Movimiento registrado exitosamente');
    expect(hook.result.isOpen).toBe(false);
    expect(onCreated).toHaveBeenCalledTimes(1);

    hook.unmount();
  });

  test('avisa cuando el movimiento se crea pero falla el PDF', async () => {
    inventarioService.createMovimiento.mockResolvedValue({
      success: true,
      message: 'Movimiento registrado',
      pdf: {
        available: false,
        code: 'PDF_GENERATION_FAILED',
        message: 'El PDF no pudo generarse.',
      },
    });
    const hook = renderHook(() =>
      useMovimientoForm({
        catalogArticulos,
        canRegeneratePdf: true,
        showMessage,
        onCreated,
      })
    );

    act(() => {
      hook.result.open();
      hook.result.handleMovimientoFormChange({
        target: { name: 'cliente_destino_id', value: '4' },
      });
      hook.result.handleMovimientoFormChange({
        target: { name: 'ubicacion_destino_nombre', value: 'Bodega norte' },
      });
      hook.result.selectArticuloForItem(0, catalogArticulos[0]);
    });

    await act(async () => {
      await hook.result.handleCreateMovimiento(submitEvent());
    });

    expect(showMessage).toHaveBeenCalledWith('success', 'Movimiento registrado');
    expect(showMessage).toHaveBeenCalledWith(
      'warning',
      'El PDF no pudo generarse. Puedes regenerarlo desde la tabla de movimientos.'
    );
    expect(onCreated).toHaveBeenCalledTimes(1);

    hook.unmount();
  });
});
