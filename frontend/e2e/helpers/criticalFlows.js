const { expect } = require('@playwright/test');
const {
  assertBackendAvailable,
  assertFrontendAvailable,
  getBackendHealthURL,
  getBaseURL,
} = require('./login');

const E2E_PASSWORD = process.env.E2E_PASSWORD || 'E2E_Local_Password_123!';

const USERS = {
  gerente: {
    username: process.env.E2E_GERENTE_USERNAME || 'e2e_gerente',
    password: E2E_PASSWORD,
  },
  contador: {
    username: process.env.E2E_CONTADOR_USERNAME || 'e2e_contador',
    password: E2E_PASSWORD,
  },
  guardia: {
    username: process.env.E2E_GUARDIA_USERNAME || 'e2e_guardia',
    password: E2E_PASSWORD,
  },
  supervisor: {
    username: process.env.E2E_SUPERVISOR_USERNAME || 'e2e_supervisor',
    password: E2E_PASSWORD,
  },
};

const getApiURL = () =>
  (process.env.E2E_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace(
    /\/$/,
    ''
  );

const loginWithRole = async ({ request, page, role = 'gerente' }) => {
  const credentials = USERS[role];
  if (!credentials) {
    throw new Error(`Unknown E2E role: ${role}`);
  }

  const response = await request.post(`${getApiURL()}/auth/login`, {
    data: {
      usuario: credentials.username,
      password: credentials.password,
    },
  });
  expect(response.ok()).toBe(true);

  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.data?.token).toBeTruthy();
  expect(body.data?.user?.tipo_usuario).toBe(role);

  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('user', JSON.stringify(user));
  }, body.data);

  return body.data;
};

const expectDashboardReady = async (page) => {
  await expect(page.locator('.dashboard-container')).toBeVisible();
  await expect(page.getByRole('button', { name: /cerrar sesión/i })).toBeVisible();
};

const getDashboardModule = (page, label) =>
  page.locator('.module-card').filter({
    has: page.getByRole('heading', { name: new RegExp(`^${label}$`, 'i') }),
  });

const clearBrowserSession = async (page) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
};

const beginReadOnlyApiGuard = (page, pathPattern) => {
  const writeRequests = [];

  page.on('request', (request) => {
    const method = request.method();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

    const pathname = new URL(request.url()).pathname;
    if (pathPattern.test(pathname)) {
      writeRequests.push(`${method} ${pathname}`);
    }
  });

  return {
    expectNoWrites() {
      expect(writeRequests).toEqual([]);
    },
  };
};

module.exports = {
  USERS,
  assertBackendAvailable,
  assertFrontendAvailable,
  beginReadOnlyApiGuard,
  clearBrowserSession,
  expectDashboardReady,
  getApiURL,
  getBackendHealthURL,
  getBaseURL,
  getDashboardModule,
  loginWithRole,
};
