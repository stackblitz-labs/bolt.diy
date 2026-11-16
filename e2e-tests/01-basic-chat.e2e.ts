import { test, expect } from './helpers/fixtures';

test.describe('Basic Chat Functionality', () => {
  test('loads the composer and keeps typed input', async ({ readyPage: page }) => {
    await page.goto('/');

    const input = page.locator('textarea[placeholder*="help"]').first();
    await expect(input).toBeVisible();
    await input.fill('Build a small landing page');
    await expect(input).toHaveValue('Build a small landing page');
  });

  test('offers the Discuss chat mode', async ({ readyPage: page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Agent' }).click();
    await expect(page.getByText('Discuss', { exact: false }).first()).toBeVisible();
  });
});
