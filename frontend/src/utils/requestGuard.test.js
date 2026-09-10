import createRequestGuard from './requestGuard';

describe('createRequestGuard', () => {
  test('solo el token más reciente es considerado vigente', () => {
    const guard = createRequestGuard();
    const first = guard.start();
    const second = guard.start();

    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  test('una respuesta tardía de una petición vieja no pisa a la más nueva', () => {
    const guard = createRequestGuard();
    const staleToken = guard.start();
    const freshToken = guard.start();

    // Simula que la petición vieja resuelve después de la nueva.
    expect(guard.isCurrent(staleToken)).toBe(false);
    expect(guard.isCurrent(freshToken)).toBe(true);
  });
});
