const { test, expect } = require('@playwright/test');
const {
  assertBackendAvailable,
  assertFrontendAvailable,
  clearBrowserSession,
  expectDashboardReady,
  loginWithRole,
} = require('./helpers/criticalFlows');
const {
  VIEWPORTS,
  assertResponsiveStructure,
  expectBaselineScreenshot,
} = require('./helpers/visualResponsiveBaseline');

test.beforeEach(async ({ page, request }) => {
  await assertFrontendAvailable(request);
  await assertBackendAvailable(request);
  await clearBrowserSession(page);
});

const loginCases = [
  { name: 'login-mobile', viewport: VIEWPORTS.mobile },
  { name: 'login-desktop', viewport: VIEWPORTS.desktop },
];

for (const testCase of loginCases) {
  test(`${testCase.name} mantiene el formulario dentro del viewport`, async ({ page }) => {
    await page.setViewportSize(testCase.viewport);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    await assertResponsiveStructure(page, page.locator('.login-card'));
    await expectBaselineScreenshot(page, testCase.name);
  });
}

const dashboardCases = [
  { name: 'manager-dashboard-mobile', viewport: VIEWPORTS.mobile },
  { name: 'manager-dashboard-tablet', viewport: VIEWPORTS.tablet },
  { name: 'manager-dashboard-desktop', viewport: VIEWPORTS.desktop },
];

for (const testCase of dashboardCases) {
  test(`${testCase.name} mantiene cabecera y módulos contenidos`, async ({ page, request }) => {
    await page.setViewportSize(testCase.viewport);
    await loginWithRole({ request, page, role: 'gerente' });
    await page.goto('/');
    await expectDashboardReady(page);
    await assertResponsiveStructure(page, page.locator('.dashboard-header'));
    await assertResponsiveStructure(page, page.locator('.module-card').first());
    await expectBaselineScreenshot(page, testCase.name);
  });
}

const inventoryCases = [
  { name: 'manager-inventory-mobile', viewport: VIEWPORTS.mobile },
  { name: 'manager-inventory-desktop', viewport: VIEWPORTS.desktop },
];

for (const testCase of inventoryCases) {
  test(`${testCase.name} contiene filtros y listado`, async ({ page, request }) => {
    await page.setViewportSize(testCase.viewport);
    await loginWithRole({ request, page, role: 'gerente' });
    const response = page.waitForResponse(
      (item) =>
        item.request().method() === 'GET' &&
        item.url().includes('/api/inventario/articulos') &&
        item.status() === 200
    );
    await page.goto('/inventario');
    await response;
    await expect(page.getByText(/mostrando 1 de 1 artículo\(s\)/i)).toBeVisible();
    const inventoryContent =
      testCase.viewport.width <= 768
        ? page.locator('.records-mobile:visible')
        : page.locator('.articulos-table:visible');
    await expect(inventoryContent.getByText('Radio E2E Alpha').first()).toBeVisible();
    await assertResponsiveStructure(page, page.locator('.page-header'), { table: true });
    if (testCase.viewport.width <= 768) {
      const actionsFit = await page.locator('.inventory-card').evaluate((card) => {
        const cardRect = card.getBoundingClientRect();
        return [...card.querySelectorAll('.inventory-card-action')].every((button) => {
          const buttonRect = button.getBoundingClientRect();
          return (
            buttonRect.left >= cardRect.left - 1 &&
            buttonRect.right <= cardRect.right + 1 &&
            buttonRect.width <= cardRect.width + 1
          );
        });
      });
      expect(actionsFit).toBe(true);
    }
    await expectBaselineScreenshot(page, testCase.name);
  });
}

const accountsCases = [
  { name: 'accountant-accounts-mobile', viewport: VIEWPORTS.mobile },
  { name: 'accountant-accounts-desktop', viewport: VIEWPORTS.desktop },
];

for (const testCase of accountsCases) {
  test(`${testCase.name} contiene filtros y listado`, async ({ page, request }) => {
    await page.setViewportSize(testCase.viewport);
    await loginWithRole({ request, page, role: 'contador' });
    const response = page.waitForResponse(
      (item) =>
        item.request().method() === 'GET' &&
        item.url().includes('/api/cuentas/reporte') &&
        item.status() === 200
    );
    await page.goto('/cuentas');
    await response;
    await expect(page.getByText(/mostrando 1 de 1 factura\(s\)/i)).toBeVisible();
    await expect(page.getByText('Cliente E2E Alfa').first()).toBeVisible();
    await assertResponsiveStructure(page, page.locator('.page-header'), { table: true });
    await expectBaselineScreenshot(page, testCase.name);
  });
}
