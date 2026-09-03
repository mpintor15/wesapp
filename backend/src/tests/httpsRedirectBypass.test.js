const request = require('supertest');

// El middleware de redirección HTTP→HTTPS solo se registra cuando
// config.nodeEnv === 'production', evaluado al cargar app.js. Cada test
// recarga los módulos con NODE_ENV=production para ejercitarlo de verdad.
const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  DB_HOST: 'db.internal',
  DB_PORT: '5432',
  DB_NAME: 'wesapp',
  DB_USER: 'wesapp_user',
  DB_PASSWORD: 'super-secret-password',
  JWT_SECRET: 'a-sufficiently-random-production-secret',
  CORS_ORIGIN: 'https://app.wessecurity.com.ec',
  PDF_STORAGE_PATH: '/data/pdfs',
};

describe('HTTPS redirect middleware (production)', () => {
  const originalEnv = { ...process.env };
  let app;
  let db;
  let movementPdfStorage;

  beforeEach(() => {
    jest.resetModules();
    Object.assign(process.env, PRODUCTION_ENV);

    jest.doMock('../config/database', () => ({
      query: jest.fn(),
      getClient: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue({
        healthy: true,
        pool: { total: 1, idle: 1, waiting: 0, max: 10 },
      }),
    }));
    jest.doMock('../utils/movementPdfStorage', () => ({
      checkReady: jest.fn().mockResolvedValue({ ready: true }),
      ensureReady: jest.fn().mockResolvedValue(undefined),
    }));

    // eslint-disable-next-line global-require
    app = require('../app');
    // eslint-disable-next-line global-require
    db = require('../config/database');
    // eslint-disable-next-line global-require
    movementPdfStorage = require('../utils/movementPdfStorage');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('health/live responde 200 sin x-forwarded-proto (healthcheck interno de Railway)', async () => {
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: 'live' });
  });

  test('health/ready responde 200 sin x-forwarded-proto (healthcheck interno de Railway)', async () => {
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'ready' });
    expect(db.healthCheck).toHaveBeenCalled();
    expect(movementPdfStorage.checkReady).toHaveBeenCalled();
  });

  test('una ruta normal sin x-forwarded-proto sigue redirigiendo 301 a HTTPS', async () => {
    const res = await request(app).get('/api/no-existe').set('Host', 'app.wessecurity.com.ec');

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://app.wessecurity.com.ec/api/no-existe');
  });

  test('la misma ruta con x-forwarded-proto: https no redirige', async () => {
    const res = await request(app)
      .get('/api/no-existe')
      .set('Host', 'app.wessecurity.com.ec')
      .set('x-forwarded-proto', 'https');

    expect(res.status).not.toBe(301);
  });
});
