const { defineConfig, devices } = require('@playwright/test');

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL || 'http://localhost:3200';

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: /visual-responsive-baseline\.spec\.js/,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
      scale: 'css',
    },
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/visual-responsive-baseline.spec.js-snapshots/{arg}{ext}',
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'visual-responsive-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
