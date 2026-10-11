import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTemplates, selectStarterTemplate } from './selectStarterTemplate';

describe('getTemplates', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('instructs the model to implement the original request after importing a template', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify([
            { name: 'package.json', path: 'package.json', content: '{"scripts":{"dev":"vite"}}' },
            { name: 'prompt', path: '.bolt/prompt', content: 'Keep the starter structure.' },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const result = await getTemplates('Vite React', 'Kanban board');

    expect(result?.userMessage).toContain('Do not respond with a plan');
    expect(result?.userMessage).toContain('ask whether to proceed');
    expect(result?.userMessage).toContain('install dependencies, and start the app with');
    expect(result?.userMessage).toContain('Keep the starter structure.');
    expect(result?.assistantMessage).toContain(
      '<boltAction type="shell">npm install --no-audit --no-fund</boltAction>',
    );
    expect(result?.assistantMessage).toContain('<boltAction type="start">npm run dev</boltAction>');
  });
});

describe('selectStarterTemplate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['Make a React kanban board', 'Vite React'],
    ['Make a hello world blog using Astro', 'Basic Astro'],
  ])('selects the explicitly requested framework for %s without a model call', async (message, template) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await selectStarterTemplate({
      message,
      model: 'free-model',
      provider: { name: 'OpenRouter', staticModels: [] },
    });

    expect(result.template).toBe(template);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
