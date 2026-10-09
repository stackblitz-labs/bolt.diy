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
    
    // Filter out expected/acceptable errors
    const criticalErrors = errors.filter(err => 
      !err.includes('indexedDB') && 
      !err.includes('JWT') &&
      !err.includes('favicon') &&
      !err.includes('No baseUrl found') &&
      !err.includes('Network connection lost')
    );
    
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
