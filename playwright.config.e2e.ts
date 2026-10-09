import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-tests', // Our new comprehensive test suite
  testMatch: '**/*.e2e.ts', // Match our test naming pattern
  // Also include existing e2e tests from tests/e2e
  projects: [
    {
      name: 'chromium',
      testDir: './e2e-tests',
      testMatch: '**/*.e2e.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'existing-e2e',
      testDir: './tests/e2e',
      testMatch: '**/*.spec.ts',
      timeout: 600000, // 10 minutes for hello-website.spec.ts (has 180-300s waits)
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
  timeout: 60000, // 1 minute per test (most tests)
  // Note: hello-website.spec.ts from tests/e2e may need longer timeout (180-300s)
  // Individual tests can override this with test.setTimeout()
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    // Note: Even if E2E_BASE_URL points to a remote app, webServer below still
    // starts a local dev server at localhost:5173. To test against a truly remote
    // instance, comment out the webServer section below.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
