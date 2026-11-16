import { test, expect, textStream } from './helpers/fixtures';

test('sends a structured chat message and displays the streamed assistant reply', async ({ readyPage: page }) => {
  let requestBody: any;
  await page.route('**/api/chat', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: textStream('E2E assistant response'),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Agent' }).click();
  await page.getByText('Discuss', { exact: false }).click();
  const input = page.locator('textarea').first();
  await input.fill('Say hello from the test');
  await input.press('Enter');
  await expect(page.getByText('E2E assistant response', { exact: true })).toBeVisible({ timeout: 30000 });
  expect(
    requestBody.messages.some(
      (message: any) =>
        message.role === 'user' &&
        message.parts?.some((part: any) => part.type === 'text' && part.text.includes('Say hello from the test')),
    ),
  ).toBe(true);
});
