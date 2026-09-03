const { test } = require('@playwright/test');
const {
  assertNoGlobalHorizontalOverflow,
  assertPageLooksLoaded,
  disableAnimations,
  gotoProtectedRoute,
} = require('./helpers/visual');

const webkitViewports = [
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
];

const routes = [
  { name: 'dashboard', path: '/' },
  { name: 'cuentas', path: '/cuentas' },
  { name: 'inventario', path: '/inventario' },
  { name: 'personal', path: '/personal' },
  { name: 'configuracion', path: '/configuracion' },
  { name: 'bitacoras', path: '/bitacoras' },
];

for (const viewport of webkitViewports) {
  test.describe(`responsive webkit ${viewport.name}`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      testInfo.annotations.push({ type: 'viewport', description: viewport.name });
    });

    for (const route of routes) {
      test(`${route.name} has no global horizontal overflow`, async ({ page }) => {
        await disableAnimations(page);
        await gotoProtectedRoute(page, route.path);
        await assertPageLooksLoaded(page);
        await assertNoGlobalHorizontalOverflow(page);
      });
    }
  });
}
