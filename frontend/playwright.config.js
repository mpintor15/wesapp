const { defineConfig, devices } = require('@playwright/test');
const { authFile } = require('./e2e/helpers/login');

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL || 'http://localhost:3000';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    },
  },
  fullyParallel: false,
  workers: Number(process.env.E2E_WORKERS || 1),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.js/, /responsive-webkit\.spec\.js/],
      use: { ...devices['Desktop Chrome'], storageState: authFile },
    },
    {
      name: 'webkit',
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.js/, /responsive-chromium\.spec\.js/, /smoke\.spec\.js/],
      use: { ...devices['Desktop Safari'], storageState: authFile },
    },
  ],
});
