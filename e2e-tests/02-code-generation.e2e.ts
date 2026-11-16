import { test, expect, textStream } from './helpers/fixtures';

test.describe('Code Generation', () => {
  test('renders streamed code in a formatted code block', async ({ readyPage: page }) => {
    const code = 'function add(a, b) {\n  return a + b;\n}';
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
        body: textStream(`Here is the function:\n\n\`\`\`javascript\n${code}\n\`\`\``),
      }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Agent' }).click();
    await page.getByText('Discuss', { exact: false }).click();
    const input = page.locator('textarea').first();
    await input.fill('Write an addition function');
    await input.press('Enter');

    const codeBlock = page.locator('pre code');
    await expect(codeBlock).toContainText('return a + b;');
    await expect(codeBlock).toContainText('function add(a, b)');
  });
});
