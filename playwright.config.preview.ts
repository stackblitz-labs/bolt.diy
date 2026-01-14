// @ts-ignore - Playwright is only installed for testing environments
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for preview environment testing
 * Used by the preview deployment workflow for smoke tests
 */
export default defineConfig({
  testDir: './tests/preview',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: process.env.PREVIEW_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'pnpm run start',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});