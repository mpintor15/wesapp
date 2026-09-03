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

test('muestra la navegación principal completa para gerente', async ({ page, request }) => {
  await loginWithRole({ request, page, role: 'gerente' });
  await page.goto('/');

  await expectDashboardReady(page);
  await expect(getDashboardModule(page, 'Cuentas')).toBeVisible();
  await expect(getDashboardModule(page, 'Clientes')).toBeVisible();
  await expect(getDashboardModule(page, 'Inventario')).toBeVisible();
  await expect(getDashboardModule(page, 'Personal')).toBeVisible();
  await expect(getDashboardModule(page, 'Usuarios')).toBeVisible();
});

test('oculta módulos sin permiso para contador', async ({ page, request }) => {
  await loginWithRole({ request, page, role: 'contador' });
  await page.goto('/');

  await expectDashboardReady(page);
  await expect(getDashboardModule(page, 'Cuentas')).toBeVisible();
  await expect(getDashboardModule(page, 'Clientes')).toBeVisible();
  await expect(getDashboardModule(page, 'Personal')).toBeVisible();
  await expect(getDashboardModule(page, 'Inventario')).toHaveCount(0);
  await expect(getDashboardModule(page, 'Usuarios')).toHaveCount(0);
});
