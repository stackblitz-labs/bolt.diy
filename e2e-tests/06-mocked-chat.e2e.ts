import { test, expect, textStream } from './helpers/fixtures';

test('sends a structured chat message and displays the streamed assistant reply', async ({ readyPage: page }) => {
  await page.addInitScript(() => {
    if (window === window.top) {
      localStorage.setItem('autoSelectTemplate', 'false');
    }
  });
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

test('shows the saved transcript when opening and reloading a chat with a project snapshot', async ({
  readyPage: page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Agent' })).toBeVisible();

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('boltHistory', 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['chats', 'snapshots'], 'readwrite');
          transaction.objectStore('chats').put({
            id: '1',
            urlId: 'saved-project',
            description: 'Saved project',
            timestamp: new Date().toISOString(),
            messages: [
              { id: 'saved-prompt', role: 'user', content: 'Original saved prompt' },
              {
                id: 'saved-reply',
                role: 'assistant',
                content:
                  'Original saved reply\n<boltArtifact id="old-project" title="Old project">' +
                  '<boltAction type="file" filePath="obsolete.txt">old file</boltAction></boltArtifact>',
              },
              { id: 'later-prompt', role: 'user', parts: [{ type: 'text', text: 'Follow-up saved prompt' }] },
            ],
          });
          transaction.objectStore('snapshots').put({
            chatId: '1',
            snapshot: {
              chatIndex: 'saved-reply',
              files: { '/home/project/saved.txt': { type: 'file', content: 'snapshot file', isBinary: false } },
            },
          });
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );

  await page.mouse.move(1, 120);
  await page.getByRole('link', { name: 'Saved project' }).click();
  await expect(page).toHaveURL(/\/chat\/saved-project$/);

  for (const text of ['Original saved prompt', 'Original saved reply', 'Follow-up saved prompt', 'saved.txt']) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText('obsolete.txt', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Original saved prompt', { exact: true })).toBeVisible();
  await expect(page.getByText('Original saved reply', { exact: true })).toBeVisible();
  await expect(page.getByText('Follow-up saved prompt', { exact: true })).toBeVisible();
  await expect(page.getByText('saved.txt', { exact: true }).first()).toBeVisible();

  await page.route('**/api/chat', (route) =>
    route.fulfill({
      headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: textStream('Native agent response'),
    }),
  );
  await page.getByRole('button', { name: 'Agent', exact: true }).click();
  await page.getByRole('menuitem', { name: /Agent Plans/ }).click();
  const composer = page.locator('textarea').first();
  await composer.fill('Explain this project');

  const outgoingRequest = page.waitForRequest((request) => request.url().endsWith('/api/chat'));
  await composer.press('Enter');
  const requestBody = (await outgoingRequest).postDataJSON();
  expect(requestBody).toMatchObject({ chatMode: 'build', agentMode: true });
  expect(requestBody.files).toEqual({});
  await expect(page.getByText('Native agent response', { exact: true })).toBeVisible();
});
