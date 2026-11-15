import { test, expect } from './helpers/fixtures';

/**
 * E2E Test Suite 4: Attachment Menu
 * Tests the new + menu functionality with Attach File, Enhance Prompt, Design Palette, and Connectors
 */

test.describe('Attachment Menu', () => {
  test.beforeEach(async ({ readyPage: page }) => {
    await page.route('**/api/enhancer', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Create a responsive website for the requested idea.',
      }),
    );
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('textarea[placeholder*="help"]', { timeout: 10000 });
  });

  test('should open and close attachment menu', async ({ readyPage: page }) => {
    // Find the + button by title
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.waitFor({ state: 'visible', timeout: 10000 });

    // Click to open
    await plusButton.click();

    // Menu should be visible (look for menu items)
    const attachFileOption = page.locator('text=Attach File');
    await expect(attachFileOption).toBeVisible({ timeout: 5000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
  });

  test('should show Attach File option', async ({ readyPage: page }) => {
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();

    const attachFileOption = page.locator('text=Attach File');
    await expect(attachFileOption).toBeVisible({ timeout: 5000 });
  });

  test('should show Enhance Prompt option', async ({ readyPage: page }) => {
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();

    const enhanceOption = page.locator('text=Enhance Prompt');
    await expect(enhanceOption).toBeVisible({ timeout: 5000 });
  });

  test('should show Design Palette option', async ({ readyPage: page }) => {
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();

    const designOption = page.locator('text=Design Palette');
    await expect(designOption).toBeVisible({ timeout: 5000 });
  });

  test('should show Search while unconfigured connectors stay hidden', async ({ readyPage: page }) => {
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();
    await page.waitForTimeout(500);

    // Find and hover over Connectors
    const connectorsOption = page.locator('text=Connectors').first();
    await expect(connectorsOption).toBeVisible({ timeout: 5000 });
    await connectorsOption.hover();

    // Search remains available without a connector account.
    const searchOption = page.locator('text=Web Search');
    const supabaseOption = page.getByRole('menuitem', { name: 'Supabase' });
    const githubOption = page.getByRole('menuitem', { name: 'GitHub' });

    await expect(searchOption).toBeVisible({ timeout: 5000 });
    await expect(supabaseOption).toHaveCount(0);
    await expect(githubOption).toHaveCount(0);
  });

  test('should click Enhance Prompt', async ({ readyPage: page }) => {
    // Type something in the textarea
    const textarea = page.locator('textarea[placeholder*="help"]').first();
    await textarea.click();
    await textarea.fill('make a website');

    // Open menu and click Enhance Prompt
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();

    const enhanceOption = page.locator('text=Enhance Prompt').first();
    await enhanceOption.click();

    await expect(textarea).toHaveValue('Create a responsive website for the requested idea.');
  });

  test('should keep GitHub out of the menu until it is configured', async ({ readyPage: page }) => {
    // Open menu
    const plusButton = page.locator('button[title="Add attachment or connector"]');
    await plusButton.click();

    // Hover over Connectors without a saved GitHub connection.
    const connectorsOption = page.locator('text=Connectors').first();
    await connectorsOption.hover();

    await expect(page.getByRole('menuitem', { name: 'GitHub' })).toHaveCount(0);
  });
});
