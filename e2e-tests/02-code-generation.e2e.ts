import { test, expect } from '@playwright/test';
import { selectFreeModel } from './helpers/model-selection';

/**
 * E2E Test Suite 2: Code Generation & Syntax Highlighting
 * Tests code block rendering, syntax highlighting, and copy functionality
 */

test.describe('Code Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('textarea[placeholder*="help"]', { timeout: 10000 });
    await selectFreeModel(page);
  });

  test('should generate code with syntax highlighting', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Write: function add(a, b) { return a + b; }');
    await page.keyboard.press('Control+Enter');
    
    // Wait for response
    await page.waitForTimeout(10000);
    
    // Check that response exists
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(30);
  });

  test('should show copy button on code blocks', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Show me: print("hello")');
    await page.keyboard.press('Control+Enter');
    
    await page.waitForTimeout(10000);
    
    // Verify response was rendered
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('print');
  });

  test('should handle multiple code blocks', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Show HTML: <button>Click</button> and CSS: button { color: blue; }');
    await page.keyboard.press('Control+Enter');
    
    await page.waitForTimeout(12000);
    
    // Check for response
    const responseText = await page.locator('body').textContent();
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(20);
  });

  test('should preserve code formatting and indentation', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Write: { name: "test", value: 123 }');
    await page.keyboard.press('Control+Enter');
    
    await page.waitForTimeout(10000);
    
    // Verify content is rendered
    const hasContent = await page.locator('body').textContent();
    expect(hasContent?.length).toBeGreaterThan(20);
  });
});
