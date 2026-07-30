const { test, expect } = require('@playwright/test');
const {
  assertBackendAvailable,
  assertFrontendAvailable,
  beginReadOnlyApiGuard,
  clearBrowserSession,
  loginWithRole,
} = require('./helpers/criticalFlows');

test.beforeEach(async ({ page, request }) => {
  await assertFrontendAvailable(request);
  await assertBackendAvailable(request);
  await clearBrowserSession(page);
});

test('lee facturas y pagos de Cuentas desde fixtures locales', async ({ page, request }) => {
  await loginWithRole({ request, page, role: 'contador' });
  const apiGuard = beginReadOnlyApiGuard(page, /^\/api\/cuentas/);

  const reporteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/cuentas/reporte') &&
      response.status() === 200
  );
  await page.goto('/cuentas');
  await reporteResponse;

  await expect(page.locator('.cuentas-container')).toBeVisible();
  await expect(page.getByText(/mostrando 1 de 1 factura\(s\)/i)).toBeVisible();
  await expect(page.locator('.cuentas-table').getByRole('cell', { name: '900001' })).toBeVisible();
  await expect(
    page.locator('.cuentas-table').getByRole('cell', { name: 'Cliente E2E Alfa' })
  ).toBeVisible();
  await expect(page.locator('.cuentas-table .badge').filter({ hasText: /^Activa$/ })).toBeVisible();

  await page.getByPlaceholder(/n° factura o cliente/i).fill('Cliente E2E Alfa');
  await page.getByRole('button', { name: /aplicar/i }).click();
  await expect(page.locator('.cuentas-table').getByRole('cell', { name: '900001' })).toBeVisible();

  const pagosResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/cuentas/pagos') &&
      response.status() === 200
  );
  await page.getByRole('button', { name: /pagos/i }).click();
  await pagosResponse;

  await expect(page.getByText(/mostrando 1 de 1 pago\(s\)/i)).toBeVisible();
  await expect(
    page.locator('.pagos-table').getByRole('cell', { name: 'Cliente E2E Alfa' })
  ).toBeVisible();
  await expect(
    page.locator('.pagos-table').getByRole('cell', { name: 'Transferencia' })
  ).toBeVisible();
  await expect(page.locator('.pagos-table').getByText(/1 factura\(s\)/i)).toBeVisible();
  apiGuard.expectNoWrites();
});
