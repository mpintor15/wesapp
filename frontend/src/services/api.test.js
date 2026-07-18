const loadApiModule = async (apiUrl) => {
  jest.resetModules();

  if (apiUrl === undefined) {
    delete process.env.REACT_APP_API_URL;
  } else {
    process.env.REACT_APP_API_URL = apiUrl;
  }

  return import('./api');
};

describe('api configuration', () => {
  const originalApiUrl = process.env.REACT_APP_API_URL;

  afterEach(() => {
    jest.resetModules();
    if (originalApiUrl === undefined) {
      delete process.env.REACT_APP_API_URL;
    } else {
      process.env.REACT_APP_API_URL = originalApiUrl;
    }
  });

  test('producción resuelve a /api cuando no hay variable explícita', async () => {
    const { API_URL, default: api } = await loadApiModule(undefined);

    expect(API_URL).toBe('/api');
    expect(api.defaults.baseURL).toBe('/api');
  });

  test('desarrollo puede utilizar la variable local explícita', async () => {
    const { API_URL, default: api } = await loadApiModule('http://localhost:3001/api');

    expect(API_URL).toBe('http://localhost:3001/api');
    expect(api.defaults.baseURL).toBe('http://localhost:3001/api');
  });

  test('una variable explícita válida prevalece sobre /api', async () => {
    const { API_URL, default: api } = await loadApiModule('https://staging.example.com/api');

    expect(API_URL).toBe('https://staging.example.com/api');
    expect(api.defaults.baseURL).toBe('https://staging.example.com/api');
  });
});

describe('api permission resync detection', () => {
  test('AUTHENTICATION_REQUIRED y USER_DISABLED emiten expiración sin resincronizar', async () => {
    const { AUTH_ERROR_CODES, AUTH_EXPIRED_EVENT, default: api } = await loadApiModule(undefined);
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    const rejectedHandler = api.interceptors.response.handlers[0].rejected;

    localStorage.setItem('token', 'token');
    localStorage.setItem('user', JSON.stringify({ id: 1 }));

    await expect(
      rejectedHandler({
        response: { status: 401, data: { code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED } },
        config: { url: '/inventario/articulos' },
      })
    ).rejects.toEqual(expect.any(Object));

    expect(dispatchSpy.mock.calls[0][0].type).toBe(AUTH_EXPIRED_EVENT);
    expect(localStorage.getItem('token')).toBeNull();

    dispatchSpy.mockClear();
    localStorage.setItem('token', 'token');
    localStorage.setItem('user', JSON.stringify({ id: 1 }));

    await expect(
      rejectedHandler({
        response: { status: 403, data: { code: AUTH_ERROR_CODES.USER_DISABLED } },
        config: { url: '/inventario/articulos' },
      })
    ).rejects.toEqual(expect.any(Object));

    expect(dispatchSpy.mock.calls[0][0].type).toBe(AUTH_EXPIRED_EVENT);
    dispatchSpy.mockRestore();
  });

  test('el interceptor emite evento de resincronización ante código de permisos', async () => {
    const {
      AUTH_ERROR_CODES,
      AUTH_PERMISSIONS_CHANGED_EVENT,
      default: api,
    } = await loadApiModule(undefined);
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    const rejectedHandler = api.interceptors.response.handlers[0].rejected;

    await expect(
      rejectedHandler({
        response: {
          status: 403,
          data: {
            code: AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            message: 'Mensaje no usado para clasificar',
          },
        },
        config: { url: '/inventario/articulos/1' },
      })
    ).rejects.toEqual(expect.any(Object));

    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
    expect(dispatchSpy.mock.calls[0][0].type).toBe(AUTH_PERMISSIONS_CHANGED_EVENT);
    dispatchSpy.mockRestore();
  });

  test('detecta 403 de permisos por code sin tratarlo como sesión expirada', async () => {
    const { AUTH_ERROR_CODES, shouldResyncUserAfterForbidden } = await loadApiModule(undefined);

    expect(
      shouldResyncUserAfterForbidden({
        response: {
          status: 403,
          data: {
            code: AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            message: 'Usuario desactivado',
          },
        },
        config: { url: '/inventario/movimientos/1/pdf/regenerar' },
      })
    ).toBe(true);
  });

  test('mantiene compatibilidad legacy si no existe code', async () => {
    const { getAuthErrorCode, AUTH_ERROR_CODES, shouldResyncUserAfterForbidden } =
      await loadApiModule(undefined);

    const legacyForbidden = {
      response: {
        status: 403,
        data: { message: 'Acceso denegado. No tienes permisos para realizar esta acción' },
      },
      config: { url: '/inventario/articulos/1' },
    };

    expect(getAuthErrorCode(legacyForbidden)).toBe(AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    expect(shouldResyncUserAfterForbidden(legacyForbidden)).toBe(true);
  });

  test('si existe code ignora completamente message', async () => {
    const { getAuthErrorCode, AUTH_ERROR_CODES, shouldResyncUserAfterForbidden } =
      await loadApiModule(undefined);

    const codedDisabled = {
      response: {
        status: 403,
        data: {
          code: AUTH_ERROR_CODES.USER_DISABLED,
          message: 'Acceso denegado. No tienes permisos para realizar esta acción',
        },
      },
      config: { url: '/inventario/articulos/1' },
    };

    expect(getAuthErrorCode(codedDisabled)).toBe(AUTH_ERROR_CODES.USER_DISABLED);
    expect(shouldResyncUserAfterForbidden(codedDisabled)).toBe(false);
  });

  test('no resincroniza para auth verify, usuario desactivado, 409, 500 ni red', async () => {
    const { AUTH_ERROR_CODES, shouldResyncUserAfterForbidden } = await loadApiModule(undefined);

    expect(
      shouldResyncUserAfterForbidden({
        response: {
          status: 403,
          data: { code: AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS },
        },
        config: { url: '/auth/verify' },
      })
    ).toBe(false);

    expect(
      shouldResyncUserAfterForbidden({
        response: { status: 403, data: { code: AUTH_ERROR_CODES.USER_DISABLED } },
        config: { url: '/inventario/articulos' },
      })
    ).toBe(false);

    expect(
      shouldResyncUserAfterForbidden({
        response: { status: 409, data: { code: 'MOVEMENT_PDF_NOT_AVAILABLE' } },
        config: { url: '/inventario/movimientos/1/pdf' },
      })
    ).toBe(false);

    expect(
      shouldResyncUserAfterForbidden({
        response: { status: 500, data: { message: 'Error en el servidor' } },
        config: { url: '/inventario/articulos' },
      })
    ).toBe(false);

    expect(shouldResyncUserAfterForbidden({ request: {}, config: { url: '/inventario' } })).toBe(
      false
    );
  });
});
