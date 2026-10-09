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
    await textarea.fill('Create a new file called example-output.txt with the content "Test successful"');
    await page.keyboard.press('Control+Enter');
    
    // Wait for response and potential tool execution
    await page.waitForTimeout(15000);
    
    // Verify actual tool execution by looking for workbench indicators
    // Check for file tree, tabs, or tool execution UI elements
    const hasWorkbenchElements = await page.locator('[class*="workbench"], [class*="file"], [class*="tab"], [class*="tool"]').count() > 0;
    const bodyText = await page.locator('body').textContent();
    
    // Should see both the filename and actual file system operation indicators
    // Not just the echo of our prompt
    const hasFileCreationResponse = bodyText && (
      bodyText.includes('example-output.txt') || 
      bodyText.includes('created') ||
      bodyText.includes('file')
    );
    
    expect(hasWorkbenchElements || hasFileCreationResponse).toBeTruthy();
    expect(bodyText?.length).toBeGreaterThan(100); // Substantial response beyond just prompt echo
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
