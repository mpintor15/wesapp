const { test } = require('@playwright/test');
const {
  assertNoGlobalHorizontalOverflow,
  disableAnimations,
  gotoProtectedRoute,
} = require('./helpers/visual');

test('authenticated mobile dashboard smoke', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await disableAnimations(page);
  await gotoProtectedRoute(page, '/');
  await assertNoGlobalHorizontalOverflow(page);
});
