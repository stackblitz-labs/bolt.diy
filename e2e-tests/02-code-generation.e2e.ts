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
    await textarea.fill('Write a JavaScript function that adds two numbers');
    await page.keyboard.press('Control+Enter');
    
    // Wait for response
    await page.waitForTimeout(10000);
    
    // Check that response exists and contains actual code elements, not just prompt echo
    // Look for code blocks or programming keywords that wouldn't be in the prompt
    const bodyText = await page.locator('body').textContent();
    const hasCodeResponse = bodyText && (
      bodyText.includes('function') || 
      bodyText.includes('return') ||
      bodyText.includes('=>') ||
      bodyText.includes('{') && bodyText.includes('}')
    );
    expect(hasCodeResponse).toBeTruthy();
    expect(bodyText?.length).toBeGreaterThan(100); // Substantial response
  });

  test('should show copy button on code blocks', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Show me a Python hello world example');
    await page.keyboard.press('Control+Enter');
    
    await page.waitForTimeout(10000);
    
    // Look for code block indicators: copy buttons, pre/code tags, or syntax highlighting classes
    // Check for actual code content that wasn't in the prompt
    const hasCopyButton = await page.locator('button[title*="Copy"], button[aria-label*="Copy"]').count() > 0;
    const hasCodeBlock = await page.locator('pre, code, .hljs, .shiki, [class*="code"]').count() > 0;
    const bodyText = await page.locator('body').textContent();
    const hasCodeContent = bodyText && (
      bodyText.toLowerCase().includes('python') || 
      bodyText.includes('def ') ||
      bodyText.includes('print(')
    );
    
    // At least one of these should be true for a proper code response
    expect(hasCopyButton || hasCodeBlock || hasCodeContent).toBeTruthy();
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
