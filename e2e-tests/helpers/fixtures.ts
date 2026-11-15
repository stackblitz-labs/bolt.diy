import { test as base, expect, type Page } from '@playwright/test';

const model = {
  name: 'openrouter/free',
  label: 'Free Models Router',
  provider: 'OpenRouter',
  maxTokenAllowed: 200000,
  isFree: true,
};
const provider = { name: 'OpenRouter', staticModels: [model] };

export const test = base.extend<{ readyPage: Page }>({
  readyPage: async ({ page, context }, use) => {
    await context.addInitScript(() => localStorage.setItem('bolt_onboarding_completed', 'true'));
    await context.addCookies([
      {
        name: 'apiKeys',
        value: encodeURIComponent(JSON.stringify({ OpenRouter: 'test-only-key' })),
        url: 'http://localhost:5173',
      },
    ]);
    await page.route('**/api/models**', (route) =>
      route.fulfill({ json: { modelList: [model], providers: [provider], defaultProvider: provider } }),
    );
    await use(page);
  },
});
export { expect };

export function textStream(text: string) {
  const chunks = [
    { type: 'start', messageId: 'test-assistant' },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop' },
  ];
  return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n';
}
