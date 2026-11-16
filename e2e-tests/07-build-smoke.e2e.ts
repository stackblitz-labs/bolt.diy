import { test as base, expect } from '@playwright/test';
import { textStream } from './helpers/fixtures';

const model = {
  name: 'model-test',
  label: 'model-test',
  provider: 'replay-test',
  maxTokenAllowed: 200000,
};

const provider = { name: 'replay-test', staticModels: [model] };

const landingPageArtifact = `Here is your landing page.

<boltArtifact id="smoke-test-landing-page" title="Simple Landing Page" type="bundled">
<boltAction type="file" filePath="index.html">
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Northstar Studio</title>
    <style>
      :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #172033; background: #f7f8fc; }
      body { margin: 0; }
      main { max-width: 960px; margin: 0 auto; padding: 72px 24px; }
      nav { display: flex; justify-content: space-between; align-items: center; }
      .hero { padding: 100px 0 80px; }
      .hero h1 { max-width: 680px; font-size: clamp(3rem, 8vw, 5rem); line-height: 1; letter-spacing: -0.06em; }
      .hero p { max-width: 560px; color: #5d687c; font-size: 1.2rem; line-height: 1.7; }
      a { color: inherit; }
      .cta { display: inline-block; margin-top: 20px; padding: 14px 20px; border-radius: 999px; color: white; background: #5b53e8; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <nav><strong>Northstar Studio</strong><a href="#contact">Get in touch</a></nav>
      <section class="hero">
        <p>DESIGN THAT MOVES YOU FORWARD</p>
        <h1>Make your next big idea impossible to ignore.</h1>
        <p>We help thoughtful teams turn bold ideas into clear, useful digital experiences.</p>
        <a class="cta" href="#contact">Start a project</a>
      </section>
      <section id="contact"><h2>Ready when you are.</h2></section>
    </main>
  </body>
</html>
</boltAction>
</boltArtifact>

Your landing page is ready to preview.`;

const test = base.extend({
  page: async ({ page, context }, use) => {
    await context.addInitScript(() => localStorage.clear());
    await context.addCookies([
      {
        name: 'apiKeys',
        value: encodeURIComponent(JSON.stringify({ 'replay-test': 'smokeTest' })),
        url: process.env.E2E_BASE_URL || 'http://localhost:5173',
      },
    ]);

    await page.route('**/api/models**', (route) =>
      route.fulfill({ json: { modelList: [model], providers: [provider], defaultProvider: provider } }),
    );
    await use(page);
  },
});

test('build smoke test skips onboarding and renders a mocked landing page', async ({ page }) => {
  let requestBody: any;
  await page.route('**/api/chat', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: textStream(landingPageArtifact),
    });
  });

  await page.goto('/?smokeTest=true');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('textarea[placeholder*="help"]').first()).toBeVisible();
  await expect(page.getByRole('combobox').first()).toContainText('replay-test');
  await expect(page.getByRole('combobox').nth(1)).toContainText('model-test');

  const composer = page.locator('textarea[placeholder*="help"]').first();
  await composer.fill('Build a simple landing page');
  await composer.press('Enter');

  await expect(page.getByText('Your landing page is ready to preview.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'index.html' })).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('Make your next big idea impossible to ignore.');
  expect(requestBody.chatMode).toBe('build');
  expect(requestBody.apiKeys['replay-test']).toBe('smokeTest');
  expect(
    requestBody.messages.some(
      (message: any) =>
        message.role === 'user' &&
        message.parts?.some(
          (part: any) =>
            part.type === 'text' &&
            part.text.includes('[Model: model-test]') &&
            part.text.includes('[Provider: replay-test]') &&
            part.text.includes('Build a simple landing page'),
        ),
    ),
  ).toBe(true);
});
