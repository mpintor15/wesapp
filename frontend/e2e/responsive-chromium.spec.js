const { test } = require('@playwright/test');
const { responsiveViewports } = require('./helpers/viewportMatrix');
const {
  assertNoGlobalHorizontalOverflow,
  assertPageLooksLoaded,
  disableAnimations,
  gotoProtectedRoute,
} = require('./helpers/visual');

const routes = [
  { name: 'dashboard', path: '/' },
  { name: 'cuentas', path: '/cuentas' },
  { name: 'inventario', path: '/inventario' },
  { name: 'personal', path: '/personal' },
  { name: 'usuarios', path: '/usuarios' },
];

for (const viewport of responsiveViewports) {
  test.describe(`responsive chromium ${viewport.name}`, () => {
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
