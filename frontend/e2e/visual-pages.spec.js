const { test } = require('@playwright/test');
const { visualViewports } = require('./helpers/viewportMatrix');
const {
  assertNoGlobalHorizontalOverflow,
  captureVisual,
  clickFirstVisible,
  gotoProtectedRoute,
} = require('./helpers/visual');

const pages = [
  { name: 'dashboard', path: '/' },
  { name: 'cuentas-facturas', path: '/cuentas', tab: [/facturas/i] },
  { name: 'cuentas-pagos', path: '/cuentas', tab: [/pagos/i] },
  { name: 'cuentas-clientes', path: '/cuentas', tab: [/clientes/i] },
  { name: 'inventario-articulos', path: '/inventario', tab: [/art[ií]culos/i] },
  { name: 'inventario-movimientos', path: '/inventario', tab: [/movimientos/i] },
  { name: 'inventario-bajas', path: '/inventario', tab: [/dados de baja|bajas/i] },
  { name: 'personal', path: '/personal' },
];

for (const viewport of visualViewports) {
  test.describe(`visual pages ${viewport.name}`, () => {
    test(`login page`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await captureVisual(page, testInfo, `login-${viewport.name}`);
      await assertNoGlobalHorizontalOverflow(page);
    });

    for (const pageCase of pages) {
      test(pageCase.name, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoProtectedRoute(page, pageCase.path);

        if (pageCase.tab) {
          await clickFirstVisible(page, pageCase.tab);
        }

        await captureVisual(page, testInfo, `${pageCase.name}-${viewport.name}`);
        await assertNoGlobalHorizontalOverflow(page);
      });
    }
  });
}
