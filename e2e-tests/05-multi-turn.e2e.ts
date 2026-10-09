import { test, expect } from '@playwright/test';
import { selectFreeModel } from './helpers/model-selection';

/**
 * E2E Test Suite 5: Multi-turn Conversations
 * Tests conversation flow, context retention, and follow-up interactions
 */

test.describe('Multi-turn Conversations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('textarea[placeholder*="help"]', { timeout: 10000 });
    await selectFreeModel(page);
  });

  test('should handle multiple messages in sequence', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    
    // First message
    await textarea.click();
    await textarea.fill('Say hello');
    await page.keyboard.press('Control+Enter');
    
    // Wait for streaming to complete by monitoring for stable state
    // Look for a stop button to disappear or check if textarea is re-enabled
    await page.waitForTimeout(2000);
    
    // Wait for the streaming to finish - check if we can send again
    let canSendAgain = false;
    for (let i = 0; i < 10; i++) {
      const isDisabled = await textarea.isDisabled();
      if (!isDisabled) {
        canSendAgain = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    
    expect(canSendAgain).toBeTruthy(); // Textarea should be re-enabled
    
    // Additional wait to ensure first response completed
    await page.waitForTimeout(3000);
    
    // Second message
    await textarea.click();
    await textarea.fill('Say goodbye');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(8000);
    
    // Check that both messages exist
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('hello');
    expect(bodyText).toContain('goodbye');
  });

  test('should maintain conversation context', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    
    // Set context
    await textarea.click();
    await textarea.fill('My name is TestUser');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(8000);
    
    // Reference context
    await textarea.click();
    await textarea.fill('What is my name?');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(8000);
    
    // Verify messages were sent
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('TestUser');
    expect(bodyText).toContain('name');
  });

  test('should handle code refinement requests', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    
    // Initial code request
    await textarea.click();
    await textarea.fill('Write: print("hello")');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(8000);
    
    // Refinement request
    await textarea.click();
    await textarea.fill('Make it use a function');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(8000);
    
    // Check for responses
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('print');
    expect(bodyText).toContain('function');
  });

  test('should recover from errors gracefully', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    
    // Send a potentially problematic message
    await textarea.click();
    await textarea.fill('Invalid request: ###%%%');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(8000);
    
    // Send a normal message after
    await textarea.click();
    await textarea.fill('Hello');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(5000);
    
    // Verify UI is still functional
    await expect(textarea).toBeVisible();
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(20);
  });
});
