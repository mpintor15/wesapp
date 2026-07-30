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

test('lee artículos y movimientos de Inventario desde fixtures locales', async ({
  page,
  request,
}) => {
  await loginWithRole({ request, page, role: 'gerente' });
  const apiGuard = beginReadOnlyApiGuard(page, /^\/api\/inventario/);

  const articulosResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/inventario/articulos') &&
      response.status() === 200
  );
  const movimientosResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/inventario/movimientos') &&
      response.status() === 200
  );
  await page.goto('/inventario');
  await Promise.all([articulosResponse, movimientosResponse]);

  await expect(page.locator('.inventario-container')).toBeVisible();
  await expect(page.getByText(/mostrando 1 de 1 artículo\(s\)/i)).toBeVisible();
  await expect(
    page.locator('.articulos-table').getByRole('cell', { name: 'Radio E2E Alpha' })
  ).toBeVisible();
  await expect(
    page.locator('.articulos-table').getByRole('cell', { name: 'E2E-COD-RADIO-001' })
  ).toBeVisible();
  await expect(
    page.locator('.articulos-table').getByRole('cell', { name: 'Bodega E2E Norte' })
  ).toBeVisible();

  await page.getByPlaceholder(/nombre, serie, marca o modelo/i).fill('Radio E2E');
  await page.getByRole('button', { name: /aplicar/i }).click();
  await expect(
    page.locator('.articulos-table').getByRole('cell', { name: 'Radio E2E Alpha' })
  ).toBeVisible();

  await page.getByRole('button', { name: /movimientos/i }).click();

  await expect(page.getByText(/mostrando 1 de 1 movimiento\(s\)/i)).toBeVisible();
  await expect(
    page.locator('.movimientos-table').getByRole('cell', { name: 'Radio E2E Alpha' })
  ).toBeVisible();
  await expect(
    page.locator('.movimientos-table').getByRole('cell', { name: 'Bodega E2E Norte' })
  ).toBeVisible();
  await expect(
    page.locator('.movimientos-table').getByRole('cell', { name: 'e2e_gerente' })
  ).toBeVisible();
  apiGuard.expectNoWrites();
});
