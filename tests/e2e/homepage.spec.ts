import { test, expect } from '@playwright/test';

test('should load the homepage', async ({ page }) => {
  // Using baseURL from config
  await page.goto('/');

  const title = await page.title();
  expect(title).toContain('Replay.Builder');
  await expect(page.locator('header')).toBeVisible();
});

test('Create a project from a preset', async ({ page }) => {
  // Using baseURL from config instead of hardcoded URL
  await page.goto('/');
  await page.getByRole('button', { name: 'Build a todo app in React' }).click();
  await page
    .locator('div')
    .filter({ hasText: /^Build a todo app in React$/ })
    .first()
    .click();

  await expect(page.locator('[data-testid="message"]')).toBeVisible();
});
