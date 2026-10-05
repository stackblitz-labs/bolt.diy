import { test, expect } from '@playwright/test';

test('hello website end-to-end via OpenRouter Space Bunny Alpha', async ({ page }) => {
  /*
   * Regression net for the staged AI SDK upgrade. Beyond the happy path this
   * also pins the things a stream-protocol rewrite can silently break:
   * - the request body actually carries `parts` (v4's sendExtraMessageFields)
   * - the token-usage annotation reaches the UI
   * - chat + artifacts survive a page reload (IndexedDB shape)
   */
  const chatRequestBodies: unknown[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/api/chat') && request.method() === 'POST') {
      chatRequestBodies.push(request.postDataJSON());
    }
  });

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

  // The model occasionally replies with prose only and never writes files, so
  // nudge it once before failing. Keeps the suite deterministic without hiding
  // a genuine regression.
  const generatedFile = page.getByText('index.html').first();
  const indexHtmlArtifact = page.getByText(/Create\s+index\.html/i).first();

  await expect
    .poll(async () => (await indexHtmlArtifact.isVisible().catch(() => false)) ? 'created' : 'pending', {
      timeout: 180_000,
      intervals: [5_000],
    })
    .toBe('created')
    .catch(async () => {
      await textarea.fill('Create the index.html and package.json files now.');
      await page.keyboard.press('Enter');
      await expect(indexHtmlArtifact).toBeVisible({ timeout: 180_000 });
    });

  // Wait for the build to finish and artifacts to appear
  await expect(page.getByText('Response Generated').first()).toBeVisible({ timeout: 240_000 });
  await expect(page.getByText(/Click to open Workbench/i).first()).toBeVisible({ timeout: 60_000 });

  // The chat request must carry structured message parts, not just a content string
  expect(chatRequestBodies.length).toBeGreaterThan(0);
  const firstRequest = chatRequestBodies[0] as { messages?: Array<{ parts?: Array<{ type: string }> }> };
  const firstMessage = firstRequest.messages?.[0];

  expect(firstMessage?.parts?.[0]?.type).toBe('text');

  // Token usage is reported back to the UI via a message annotation. There may be
  // more than one assistant turn when the model needed a nudge, so match any.
  await expect(page.getByText(/Tokens:\s*[\d,]+\s*\(prompt:\s*[\d,]+, completion:\s*[\d,]+\)/).first()).toBeVisible({
    timeout: 30_000,
  });

  // Workbench shows the generated files
  await expect(page.getByRole('button', { name: 'Code' }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('index.html').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('package.json').first()).toBeVisible({ timeout: 60_000 });

  // Diff view renders the changes for generated files
  await page.getByRole('button', { name: 'Diff' }).first().click();
  await expect(page.getByText(/package\.json/).first()).toBeVisible({ timeout: 60_000 });

  // Preview renders the site
  await page.getByRole('button', { name: 'Preview' }).first().click();
  const previewFrame = page.frameLocator('iframe').first();
  await expect(previewFrame.getByText(/Hello/i).first()).toBeVisible({ timeout: 300_000 });

  // Chat history and generated files survive a reload (IndexedDB persistence)
  const urlBeforeReload = page.url();

  await page.reload();
  await expect(page.getByText('index.html').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Diff' }).first()).toBeVisible({ timeout: 60_000 });
  expect(page.url()).toBe(urlBeforeReload);
});