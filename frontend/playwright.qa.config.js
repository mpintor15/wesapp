const path = require('node:path');
const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL;

module.exports = defineConfig({
  testDir: './e2e/qa',
  testMatch: /qa-visual\.spec\.js/,
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: path.join(__dirname, 'qa-results', 'test-results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: 'qa-results/playwright-report', open: 'never' }],
    [path.join(__dirname, 'e2e/qa/reporters/qaReporter.js')],
  ],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'qa-visual-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
