import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loader } from './api.github-template';

describe('GitHub template loader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the default branch archive when GitHub has no available release', async () => {
    const zip = new JSZip();
    zip.file('bolt-astro-basic-template-main/package.json', '{"scripts":{"dev":"astro dev"}}');

    const archive = await zip.generateAsync({ type: 'arraybuffer' });

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(archive));
    vi.stubGlobal('fetch', fetchMock);

    const response = await loader({
      request: new Request('http://localhost/api/github-template?repo=blueberry-llm/bolt-astro-basic-template'),
      context: { cloudflare: { ctx: { waitUntil: () => undefined } } },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        name: 'package.json',
        path: 'package.json',
        content: '{"scripts":{"dev":"astro dev"}}',
      },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://codeload.github.com/blueberry-llm/bolt-astro-basic-template/zip/refs/heads/main',
    );
  });
});
