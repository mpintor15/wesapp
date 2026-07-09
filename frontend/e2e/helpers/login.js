const fs = require('node:fs');
const path = require('node:path');
const { expect } = require('@playwright/test');

const authDir = path.resolve(__dirname, '..', '.auth');
const authFile = path.join(authDir, 'user.json');

const getBaseURL = () =>
  process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL || 'http://localhost:3000';

const getBackendHealthURL = () => {
  const explicit = process.env.E2E_BACKEND_HEALTH_URL;
  if (explicit) return explicit;

  const apiURL =
    process.env.E2E_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  return apiURL.replace(/\/api\/?$/, '/health');
};

const getCredentials = () => ({
  username: process.env.E2E_USERNAME,
  password: process.env.E2E_PASSWORD,
});

const hasCredentials = () => {
  const { username, password } = getCredentials();
  return Boolean(username && password);
};

const isURLAvailable = async (request, url, label) => {
  try {
    const response = await request.get(url, { timeout: 3_000 });
    if (!response.ok()) {
      throw new Error(`${label} returned HTTP ${response.status()} at ${url}`);
    }
  } catch (error) {
    throw new Error(`${label} is not reachable at ${url}: ${error.message}`);
  }
};

const assertFrontendAvailable = async (request) =>
  isURLAvailable(request, getBaseURL(), 'Frontend');

const assertBackendAvailable = async (request) =>
  isURLAvailable(request, getBackendHealthURL(), 'Backend');

const assertAuthStateExists = () => {
  if (!fs.existsSync(authFile)) {
    throw new Error(`Missing Playwright storageState at ${authFile}. Run npm run test:e2e:auth.`);
  }
};

const getHeader = async (response, name) => {
  const headers = await response.allHeaders();
  return headers[name.toLowerCase()];
};

const readJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const loginWithCredentials = async (page) => {
  const { username, password } = getCredentials();
  if (!username || !password) {
    throw new Error('Set E2E_USERNAME and E2E_PASSWORD to create storageState.');
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 8_000 });
  await page.locator('#usuario').fill(username);
  await page.locator('#password').fill(password);

  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login'),
    { timeout: 8_000 }
  );
  await page.getByRole('button', { name: /ingresar/i }).click();
  const loginResponse = await loginResponsePromise;
  const loginStatus = loginResponse.status();
  const loginBody = await readJsonSafely(loginResponse);

  if (loginStatus === 429) {
    const retryAfter = await getHeader(loginResponse, 'retry-after');
    throw new Error(
      [
        'Playwright auth setup is blocked by backend rate limiting on POST /api/auth/login.',
        `HTTP 429 Too Many Requests${retryAfter ? `; Retry-After=${retryAfter}s` : ''}.`,
        loginBody?.message ? `Backend message: ${loginBody.message}` : null,
        'Start backend with E2E_MODE=true for local E2E suites, then rerun npm run test:e2e:auth.',
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  if (loginStatus >= 400) {
    throw new Error(
      `POST /api/auth/login failed with HTTP ${loginStatus}: ${
        loginBody?.message || loginResponse.statusText()
      }`
    );
  }

  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 8_000 });

  const pathname = new URL(page.url()).pathname;
  if (pathname === '/change-password') {
    throw new Error(
      'E2E user is marked as primer_login; use an account with password already set.'
    );
  }

  await expect(page).not.toHaveURL(/\/login$/);
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
};

const assertAuthenticatedPage = async (page) => {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 8_000 });
  await page
    .locator(
      '.dashboard-container, .protected-route-denied, .login-container, .change-password-container'
    )
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });

  const pathname = new URL(page.url()).pathname;
  if (pathname === '/login') {
    throw new Error(
      `Stored Playwright session is invalid or expired. Regenerate it with npm run test:e2e:auth.`
    );
  }
  if (pathname === '/change-password') {
    throw new Error(
      'E2E user is marked as primer_login; use an account with password already set.'
    );
  }

  const denied = await page
    .getByText(/acceso denegado/i)
    .isVisible()
    .catch(() => false);
  if (denied) {
    throw new Error('Authenticated E2E user does not have permission for the dashboard.');
  }
};

module.exports = {
  authFile,
  assertAuthenticatedPage,
  assertAuthStateExists,
  assertBackendAvailable,
  assertFrontendAvailable,
  getBaseURL,
  getBackendHealthURL,
  hasCredentials,
  loginWithCredentials,
};
