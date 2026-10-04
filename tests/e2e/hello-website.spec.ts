import { test, expect } from '@playwright/test';

test('hello website end-to-end via OpenRouter Space Bunny Alpha', async ({ page }) => {
  await page.goto('/');

  // Select OpenRouter provider
  const providerCombo = page.getByRole('combobox').first();
  await providerCombo.click();
  await page.getByPlaceholder(/Search providers/).fill('OpenRouter');
  await page.getByRole('option', { name: /OpenRouter/ }).first().click();

  // Select the Space Bunny Alpha model
  const modelCombo = page.getByRole('combobox').nth(1);
  await modelCombo.click();
  await page.getByPlaceholder(/Search models/).fill('space-bunny');
  await page.getByRole('option').first().click();

  // Build a hello website
  const textarea = page.locator('textarea').first();
  await textarea.fill(
    'Build a simple hello world website. Create the project files including index.html, package.json, and a script to run the dev server. Do not only run terminal commands; create the files.',
  );
  await page.keyboard.press('Enter');

  // Wait for the build to finish and artifacts to appear
  await expect(page.getByText('Response Generated').first()).toBeVisible({ timeout: 240_000 });
  await expect(page.getByText(/Click to open Workbench/i).first()).toBeVisible({ timeout: 60_000 });

  // Workbench shows the generated files
  await expect(page.getByRole('button', { name: 'Code' }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('index.html').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('package.json').first()).toBeVisible({ timeout: 60_000 });

  // Preview renders the site
  await page.getByRole('button', { name: 'Preview' }).first().click();
  const previewFrame = page.frameLocator('iframe').first();
  await expect(previewFrame.getByText(/Hello/i).first()).toBeVisible({ timeout: 300_000 });
});
