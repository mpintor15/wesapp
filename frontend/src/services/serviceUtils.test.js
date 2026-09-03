import { buildServiceFailure, getVisibleErrorMessage, normalizeServiceError } from './serviceUtils';

describe('serviceUtils error handling', () => {
  test('preserva status, code, details y message de JSON backend', () => {
    const error = {
      response: {
        status: 409,
        data: {
          code: 'CLIENT_HAS_RELATIONS',
          message: 'Cliente con historial',
          details: { facturas: 2 },
        },
      },
    };

    expect(buildServiceFailure(error, 'fallback')).toMatchObject({
      success: false,
      status: 409,
      code: 'CLIENT_HAS_RELATIONS',
      message: 'Cliente con historial',
      details: { facturas: 2 },
      isNetworkError: false,
    });
  });

  test('maneja cuerpo vacío, texto plano y error de red', () => {
    expect(
      normalizeServiceError({ response: { status: 404, data: '' } }, 'No encontrado')
    ).toMatchObject({
      status: 404,
      message: 'No encontrado',
    });
    expect(
      normalizeServiceError({ response: { status: 400, data: 'Validación fallida' } }, 'fallback')
    ).toMatchObject({ message: 'Validación fallida' });
    expect(normalizeServiceError({ request: {}, code: 'ECONNABORTED' }, 'fallback')).toMatchObject({
      isNetworkError: true,
      message: 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.',
    });
  });

  test('traduce status comunes a mensajes visibles seguros', () => {
    expect(getVisibleErrorMessage({ status: 403 })).toBe(
      'No tienes permisos para realizar esta acción.'
    );
    expect(getVisibleErrorMessage({ status: 404 })).toBe(
      'El registro ya no existe o fue eliminado.'
    );
    expect(getVisibleErrorMessage({ status: 409, code: 'USER_HAS_ACTIVITY' })).toContain(
      'Desactívalo'
    );
    expect(getVisibleErrorMessage({ status: 500, message: 'stack SQL secreto' })).toBe(
      'Ocurrió un error interno. Inténtalo nuevamente.'
    );
  });
});
