const { test, expect } = require('@playwright/test');
const {
  assertBackendAvailable,
  assertFrontendAvailable,
  clearBrowserSession,
  expectDashboardReady,
  getDashboardModule,
  loginWithRole,
} = require('./helpers/criticalFlows');

test.beforeEach(async ({ page, request }) => {
  await assertFrontendAvailable(request);
  await assertBackendAvailable(request);
  await clearBrowserSession(page);
});

test('redirige rutas protegidas sin sesión al login', async ({ page }) => {
  await page.goto('/inventario');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.login-container')).toBeVisible();
  await expect(page.locator('.inventario-container')).toHaveCount(0);
});

test('muestra acceso denegado cuando el rol no tiene permiso de ruta', async ({
  page,
  request,
}) => {
  await loginWithRole({ request, page, role: 'contador' });
  await page.goto('/inventario');

  await expect(page.locator('.protected-route-denied')).toBeVisible();
  await expect(page.getByText(/acceso denegado/i)).toBeVisible();
  await expect(page.getByText(/no tienes permisos/i)).toBeVisible();
});

test('permite navegar a una ruta autorizada', async ({ page, request }) => {
  await loginWithRole({ request, page, role: 'gerente' });
  await page.goto('/');

  await expectDashboardReady(page);
  await getDashboardModule(page, 'Inventario').click();
  await expect(page).toHaveURL(/\/inventario$/);
  await expect(page.locator('.inventario-container')).toBeVisible();
});
