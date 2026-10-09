import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite 0: Health Check
 * Quick smoke tests to verify app is working before running full suite
 */

test.describe('Health Check', () => {
  test('app loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Bolt/i);
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('textarea', { timeout: 10000 });
    
    // Filter out known acceptable non-critical errors
    // Note: JWT and indexedDB errors should still be logged, only truly benign errors filtered
    const criticalErrors = errors.filter(err => 
      !err.includes('favicon') &&
      !err.includes('No baseUrl found in request context')
    );
    
    // Warn about any JWT or indexedDB errors but don't fail the test for now
    // These may indicate real issues that should be investigated separately
    const authStorageErrors = errors.filter(err => 
      err.includes('JWT') || err.includes('indexedDB')
    );
    if (authStorageErrors.length > 0) {
      console.warn('Auth/storage errors detected (not failing test):', authStorageErrors);
    }
    
    expect(criticalErrors.length).toBe(0);
  });

  test('main UI elements are present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('textarea', { timeout: 10000 });
    
    // Check for key elements
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('button[title*="Model"], [class*="ModelSelector"]').first()).toBeVisible();
  });
});
