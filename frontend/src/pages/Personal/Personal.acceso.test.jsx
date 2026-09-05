import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import personalService from '../../services/personalService';
import usuariosService from '../../services/usuariosService';
import Personal from './Personal';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../context/ToastContext', () => ({
  useToast: jest.fn(),
}));

jest.mock('../../services/personalService', () => ({
  __esModule: true,
  default: {
    getColaboradores: jest.fn(),
    createColaborador: jest.fn(),
    updateColaborador: jest.fn(),
    deleteColaborador: jest.fn(),
    exportExcel: jest.fn(),
  },
}));

jest.mock('../../services/usuariosService', () => ({
  __esModule: true,
  default: {
    getColaboradoresElegibles: jest.fn(),
    getUbicacionesAsignables: jest.fn(),
    getUsuarioByColaborador: jest.fn(),
    createUsuario: jest.fn(),
    updateUsuario: jest.fn(),
    reenviarInvitacion: jest.fn(),
    deleteUsuario: jest.fn(),
  },
}));

jest.mock('../../hooks/useScrollToTopOnMount', () => jest.fn());

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const pagination = (overrides = {}) => ({
  page: 1,
  pageSize: 25,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  ...overrides,
});

const sinAcceso = {
  id: 1,
  nombres_completos: 'Ana Torres',
  cedula: '0102030405',
  cargo: 'Recepcionista',
  estado: 'activo',
  celular: '0999999999',
  banco: 'Banco Pichincha',
  numero_cuenta: '2200123456',
  sueldo: '450.00',
  acceso: { tiene_usuario: false },
};

const conAcceso = {
  id: 2,
  nombres_completos: 'Beto Ruiz',
  cedula: '0203040506',
  cargo: 'Guardia',
  estado: 'activo',
  celular: '0988888888',
  banco: null,
  numero_cuenta: null,
  sueldo: '400.00',
  acceso: {
    tiene_usuario: true,
    usuario_id: 9,
    usuario: 'bruiz',
    tipo_usuario: 'guardia',
    activo: true,
    pendiente: false,
  },
};

const render = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Personal />));
  await act(async () => {
    jest.advanceTimersByTime(300);
    await flush();
  });
  return { container, root };
};

describe('Personal — gestión de acceso e integración con Usuarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useToast.mockReturnValue({ showToast: jest.fn() });
    usuariosService.getColaboradoresElegibles.mockResolvedValue({ success: true, data: [] });
    usuariosService.getUbicacionesAsignables.mockResolvedValue({ success: true, data: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('colaborador sin usuario muestra "Sin acceso" y abre el modal de creación con el colaborador bloqueado', async () => {
    useAuth.mockReturnValue({ user: { id: 1, tipo_usuario: 'gerente', activo: true } });
    personalService.getColaboradores.mockResolvedValue({
      success: true,
      data: [sinAcceso],
      pagination: pagination(),
    });

    const { container } = await render();
    expect(container.textContent).toContain('Sin acceso');

    const accesoBtn = container.querySelector('[aria-label="Gestionar acceso de Ana Torres"]');
    expect(accesoBtn).toBeTruthy();
    await act(async () => {
      accesoBtn.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(usuariosService.getUsuarioByColaborador).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Crear nuevo usuario');
    expect(usuariosService.getColaboradoresElegibles).toHaveBeenCalled();
  });

  test('colaborador con usuario activo muestra el rol como badge y abre el modal de edición', async () => {
    useAuth.mockReturnValue({ user: { id: 1, tipo_usuario: 'gerente', activo: true } });
    personalService.getColaboradores.mockResolvedValue({
      success: true,
      data: [conAcceso],
      pagination: pagination(),
    });
    usuariosService.getUsuarioByColaborador.mockResolvedValue({
      success: true,
      data: {
        id: 9,
        nombre: 'Beto',
        apellido: 'Ruiz',
        tipo_usuario: 'guardia',
        activo: true,
        colaborador_id: 2,
        ubicacion_ids: [],
      },
    });

    const { container } = await render();
    expect(container.textContent).toContain('Guardia');

    const accesoBtn = container.querySelector('[aria-label="Gestionar acceso de Beto Ruiz"]');
    await act(async () => {
      accesoBtn.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(usuariosService.getUsuarioByColaborador).toHaveBeenCalledWith(2);
    expect(container.textContent).toContain('Revocar acceso');
  });

  test('un rol sin acceso a datos sensibles no ve columnas de Banco/Cuenta ni Sueldo', async () => {
    useAuth.mockReturnValue({ user: { id: 3, tipo_usuario: 'contador', activo: true } });
    personalService.getColaboradores.mockResolvedValue({
      success: true,
      data: [sinAcceso],
      pagination: pagination(),
    });

    const { container } = await render();

    expect(container.textContent).not.toContain('Banco / Cuenta');
    expect(container.textContent).not.toContain('Banco Pichincha');
    expect(container.textContent).not.toContain('2200123456');
  });
});
