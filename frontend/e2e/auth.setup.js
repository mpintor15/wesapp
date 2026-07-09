const { test } = require('@playwright/test');
const {
  assertAuthenticatedPage,
  assertBackendAvailable,
  assertFrontendAvailable,
  loginWithCredentials,
} = require('./helpers/login');

test('authenticate reusable E2E session', async ({ page, request }) => {
  await assertFrontendAvailable(request);
  await assertBackendAvailable(request);
  await loginWithCredentials(page);
  await assertAuthenticatedPage(page);
});
