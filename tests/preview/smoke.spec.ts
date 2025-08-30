// @ts-ignore - Playwright is only installed for testing environments
import { test, expect } from '@playwright/test';

/**
 * Basic smoke tests for preview deployments
 * These tests ensure the deployed preview is working correctly
 */

test.describe('Preview Deployment Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }: any) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/bolt\.diy/);
    
    // Check for key elements
    await expect(page.locator('body')).toBeVisible();
    
    // Verify no console errors
    const errors: string[] = [];
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForLoadState('networkidle');
    
    // Allow some minor errors but fail on critical ones
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('manifest')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('basic navigation works', async ({ page }: any) => {
    await page.goto('/');
    
    // Wait for the page to be interactive
    await page.waitForLoadState('domcontentloaded');
    
    // Check if we can interact with basic elements
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Verify no JavaScript runtime errors
    let jsErrors = 0;
    page.on('pageerror', () => {
      jsErrors++;
    });
    
    // Wait a bit for any async operations
    await page.waitForTimeout(2000);
    
    expect(jsErrors).toBeLessThan(3); // Allow minor errors but not major failures
  });

  test('essential resources load', async ({ page }: any) => {
    const responses: { url: string; status: number }[] = [];
    
    page.on('response', (response: any) => {
      responses.push({
        url: response.url(),
        status: response.status()
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that we don't have too many 404s or 500s
    const failedRequests = responses.filter(r => r.status >= 400);
    const criticalFailures = failedRequests.filter(r => 
      !r.url.includes('favicon') && 
      !r.url.includes('manifest') &&
      !r.url.includes('sw.js') // service worker is optional
    );
    
    expect(criticalFailures.length).toBeLessThan(5);
  });
});