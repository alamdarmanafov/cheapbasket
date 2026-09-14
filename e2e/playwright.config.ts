import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the exported web build with the backend mocked.
 *
 * `npm run e2e:build` exports the app for web pointed at a Supabase host
 * that does not exist; the tests answer its REST calls from fixtures, so
 * the flows run the real app code with no network and no database.
 */
export default defineConfig({
  testDir: '.',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]] : 'list',
  outputDir: '../test-results',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'node e2e/serve.mjs',
    cwd: '..',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
