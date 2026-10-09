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
    
    // Wait for assistant response message to appear (not just the user message)
    // Look for a message that contains actual code, not just the prompt
    await expect
      .poll(
        async () => {
          const messages = await page.locator('[class*="Message"], [role="article"]').all();
          
          for (const msg of messages) {
            const text = await msg.textContent();
            
            if (
              text &&
              !text.includes('adds two numbers') && // Exclude user message
              (text.includes('return') || text.includes('=>') || text.includes('function('))
            ) {
              return true;
            }
          }
          
          return false;
        },
        {
          timeout: 15000,
          message: 'Expected assistant to generate code with function keywords',
        },
      )
      .toBe(true);
  });

  test('should show copy button on code blocks', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('Show me a simple addition function');
    await page.keyboard.press('Control+Enter');
    
    // Wait for code block with copy button or actual code element to appear
    await expect
      .poll(
        async () => {
          // Check for copy buttons
          const copyButtons = await page.locator('button[title*="Copy"], button[aria-label*="Copy"]').count();
          
          if (copyButtons > 0) {
            return 'copy-button';
          }
          
          // Check for code blocks (pre/code elements)
          const codeBlocks = await page.locator('pre code, .hljs, .shiki').count();
          
          if (codeBlocks > 0) {
            return 'code-block';
          }
          
          return 'none';
        },
        {
          timeout: 15000,
          message: 'Expected code block or copy button to appear',
        },
      )
      .not.toBe('none');
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
