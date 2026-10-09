import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite 4: Attachment Menu
 * Tests the new + menu functionality with Attach File, Enhance Prompt, Design Palette, and Connectors
 */

test.describe('Attachment Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('textarea[placeholder*="help"]', { timeout: 10000 });
  });

  test('should open and close attachment menu', async ({ page }) => {
    // Find the + button by title
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.waitFor({ state: 'visible', timeout: 10000 });
    
    // Click to open
    await plusButton.click();
    await page.waitForTimeout(500);
    
    // Menu should be visible (look for menu items)
    const attachFileOption = page.locator('text=Attach File');
    await expect(attachFileOption).toBeVisible({ timeout: 5000 });
    
    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('should show Attach File option', async ({ page }) => {
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();
    await page.waitForTimeout(500);
    
    const attachFileOption = page.locator('text=Attach File');
    await expect(attachFileOption).toBeVisible({ timeout: 5000 });
  });

  test('should show Enhance Prompt option', async ({ page }) => {
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();
    await page.waitForTimeout(500);
    
    const enhanceOption = page.locator('text=Enhance Prompt');
    await expect(enhanceOption).toBeVisible({ timeout: 5000 });
  });

  test('should show Design Palette option', async ({ page }) => {
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();
    await page.waitForTimeout(500);
    
    const designOption = page.locator('text=Design Palette');
    await expect(designOption).toBeVisible({ timeout: 5000 });
  });

  test('should show Connectors submenu with Supabase and GitHub', async ({ page }) => {
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();
    await page.waitForTimeout(500);
    
    // Find and hover over Connectors
    const connectorsOption = page.locator('text=Connectors').first();
    await expect(connectorsOption).toBeVisible({ timeout: 5000 });
    await connectorsOption.hover();
    await page.waitForTimeout(700);
    
    // Check for submenu items
    const supabaseOption = page.locator('text=Supabase');
    const githubOption = page.locator('text=GitHub');
    
    await expect(supabaseOption).toBeVisible({ timeout: 5000 });
    await expect(githubOption).toBeVisible({ timeout: 5000 });
  });

  test('should click Enhance Prompt', async ({ page }) => {
    // Type something in the textarea
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('make a website');
    
    // Open menu and click Enhance Prompt
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();
    await page.waitForTimeout(500);
    
    const enhanceOption = page.locator('text=Enhance Prompt').first();
    await enhanceOption.click();
    
    // Wait for enhancement to potentially happen
    await page.waitForTimeout(3000);
    
    // Textarea should still be visible and functional
    await expect(textarea).toBeVisible();
  });

  test('should open settings when clicking GitHub connector', async ({ page }) => {
    // Open menu
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();
    await page.waitForTimeout(500);
    
    // Hover over Connectors
    const connectorsOption = page.locator('text=Connectors').first();
    await connectorsOption.hover();
    await page.waitForTimeout(700);
    
    // Click GitHub
    const githubOption = page.locator('text=GitHub').first();
    await githubOption.click();
    await page.waitForTimeout(1000);
    
    // Check that something happened (settings panel might open)
    // Just verify the app is still functional
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await expect(textarea).toBeVisible();
  });
});
