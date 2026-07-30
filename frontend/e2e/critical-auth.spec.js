const { test, expect } = require('@playwright/test');
const {
  USERS,
  assertBackendAvailable,
  assertFrontendAvailable,
  clearBrowserSession,
  expectDashboardReady,
} = require('./helpers/criticalFlows');

test.beforeEach(async ({ page, request }) => {
  await assertFrontendAvailable(request);
  await assertBackendAvailable(request);
  await clearBrowserSession(page);
});

test('permite login válido con fixture local', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#usuario').fill(USERS.gerente.username);
  await page.locator('#password').fill(USERS.gerente.password);

  const loginResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/login')
  );
  await page.getByRole('button', { name: /ingresar/i }).click();

  expect((await loginResponse).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/);
  await expectDashboardReady(page);
  await expect(page.getByText(USERS.gerente.username)).toBeVisible();
});

test('rechaza login inválido sin crear sesión', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#usuario').fill('e2e_usuario_invalido');
  await page.locator('#password').fill('password_invalido');

  const loginResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/login')
  );
  await page.getByRole('button', { name: /ingresar/i }).click();

  expect((await loginResponse).status()).toBe(401);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toContainText(/usuario o contraseña incorrectos/i);
  await expect(
    page.evaluate(() => ({
      token: window.localStorage.getItem('token'),
      user: window.localStorage.getItem('user'),
    }))
  ).resolves.toEqual({ token: null, user: null });
});
