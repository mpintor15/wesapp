import api from './api';
import clientesService from './clientesService';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

describe('clientesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('usa el cliente HTTP central para CRUD de clientes', async () => {
    api.get
      .mockResolvedValueOnce({ data: { success: true, data: [{ id: 1, nombre: 'ACME' }] } })
      .mockResolvedValueOnce({ data: { success: true, data: [{ id: 1, nombre: 'ACME' }] } })
      .mockResolvedValueOnce({ data: { success: true, data: { id: 1, nombre: 'ACME' } } });
    api.post.mockResolvedValueOnce({
      data: { success: true, data: { id: 2, nombre: 'Nuevo' } },
    });
    api.put.mockResolvedValueOnce({
      data: { success: true, data: { id: 2, nombre: 'Editado' } },
    });
    api.delete.mockResolvedValueOnce({ data: { success: true } });

    await clientesService.listClientes({ search: 'acme', estado: 'activo' });
    await clientesService.listOpcionesUbicaciones();
    await clientesService.getCliente(1);
    await clientesService.createCliente({ nombre: 'Nuevo' });
    await clientesService.updateCliente(2, { nombre: 'Editado' });
    await clientesService.deleteCliente(2);

    expect(api.get).toHaveBeenNthCalledWith(1, '/clientes', {
      params: { search: 'acme', estado: 'activo' },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/clientes/opciones-ubicaciones');
    expect(api.get).toHaveBeenNthCalledWith(3, '/clientes/1');
    expect(api.post).toHaveBeenCalledWith('/clientes', { nombre: 'Nuevo' });
    expect(api.put).toHaveBeenCalledWith('/clientes/2', { nombre: 'Editado' });
    expect(api.delete).toHaveBeenCalledWith('/clientes/2');
  });

  test('preserva error 409 de identificación duplicada', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'Ya existe un cliente con esa identificación' },
      },
    });

    const result = await clientesService.createCliente({
      nombre: 'ACME',
      identificacion: '099001',
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        code: undefined,
        message: 'Ya existe un cliente con esa identificación',
        status: 409,
        isNetworkError: false,
      })
    );
    expect(result.originalError.response.status).toBe(409);
  });
});
