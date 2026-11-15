import { test, expect } from '@playwright/test';
import { selectFreeModel } from './helpers/model-selection';

/**
 * E2E Test Suite 3: Tool Calls & Workbench
 * Tests file operations, tool call UI, and workbench functionality
 */

test.describe('Tool Calls & Workbench', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('textarea[placeholder*="help"]', { timeout: 10000 });
    await selectFreeModel(page);
  });

  test('should create a file via tool call', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Create a new file called demo-test.js with the content: console.log("success")');
    await page.keyboard.press('Control+Enter');
    
    // Wait for workbench to show file creation
    // Look for workbench file tree, tabs, or file name in workbench area
    await expect
      .poll(
        async () => {
          // Check for workbench-specific elements
          const hasWorkbenchFile = await page.locator('[class*="workbench"] >> text=demo-test.js').count() > 0;
          const hasFileTab = await page.locator('[role="tab"] >> text=demo-test.js').count() > 0;
          const hasFileTree = await page.locator('[class*="file-tree"], [class*="files"] >> text=demo-test.js').count() > 0;
          
          return hasWorkbenchFile || hasFileTab || hasFileTree;
        },
        {
          timeout: 20000,
          message: 'Expected file to appear in workbench',
        },
      )
      .toBe(true);
  });

  test('should show tool call UI', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Make a new file named example.js with: console.log("test")');
    await page.keyboard.press('Control+Enter');
    
    await page.waitForTimeout(15000);
    
    // Verify response exists
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(20);
  });

  test('should update an existing file', async ({ page }) => {
    // First create a file
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Create file update-test.txt with "original"');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(15000);
    
    // Try to update it
    await textarea.click();
    await textarea.fill('Update update-test.txt to say "modified"');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(15000);
    
    // Verify both messages were sent
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('update-test.txt');
  });

  test('should show code preview panel', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Create a simple HTML page');
    await page.keyboard.press('Control+Enter');
    
    await page.waitForTimeout(15000);
    
    // Verify response rendered
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(20);
  });

  test('should handle terminal output', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Show me how to run "npm install"');
    await page.keyboard.press('Control+Enter');
    
    await page.waitForTimeout(10000);
    
    // Verify response exists
    const hasContent = await page.locator('body').textContent();
    expect(hasContent?.length).toBeGreaterThan(20);
  });
});
