import { createStaticHandler } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { action } from './api.deedpage-deploy';
import routes from '~/routes';

const route = routes.find(({ file }) => file === 'routes/api.deedpage-deploy.ts');

if (!route?.path) {
  throw new Error('The deed.page deploy API must be registered in the route manifest');
}

const { queryRoute } = createStaticHandler([{ path: route.path, action }]);
const upstream = vi.fn<typeof fetch>();

function deploy(body: unknown) {
  return queryRoute(
    new Request('http://localhost/api/deedpage-deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  ) as Promise<Response>;
}

beforeEach(() => {
  vi.stubGlobal('fetch', upstream);
  upstream.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deed.page deploy API route', () => {
  it('publishes a new site and returns the minted token once', async () => {
    upstream.mockResolvedValueOnce(
      Response.json({
        ok: true,
        url: 'https://bolt-1-abc.deed.page/',
        slug: 'bolt-1-abc',
        version: 'v1',
        token: 'deed_tok_new',
      }),
    );

    const response = await deploy({ slug: 'bolt-1-abc', files: { 'index.html': '<h1>hi</h1>' } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://bolt-1-abc.deed.page/',
      slug: 'bolt-1-abc',
      version: 'v1',
      token: 'deed_tok_new',
    });

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('https://deed.page/v1/sites?ref=partner_bolt-diy');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(String(init?.body))).toEqual({ slug: 'bolt-1-abc', files: { 'index.html': '<h1>hi</h1>' } });
  });

  it('sends the saved token to update an existing site', async () => {
    upstream.mockResolvedValueOnce(
      Response.json({ ok: true, url: 'https://bolt-1-abc.deed.page/', slug: 'bolt-1-abc', version: 'v2' }),
    );

    const response = await deploy({ slug: 'bolt-1-abc', files: { 'index.html': 'v2' }, token: 'deed_tok_saved' });
    const data = (await response.json()) as { version: string; token?: string };

    expect(data.version).toBe('v2');
    expect(data.token).toBeUndefined();
    expect((upstream.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer deed_tok_saved');
  });

  it('passes deed.page errors through with their status', async () => {
    upstream.mockResolvedValueOnce(
      Response.json({ ok: false, code: 'slug_taken', message: 'That slug belongs to another owner.' }, { status: 409 }),
    );

    const response = await deploy({ slug: 'taken', files: { 'index.html': 'x' } });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'That slug belongs to another owner.', code: 'slug_taken' });
  });

  it('rejects bad input without calling deed.page', async () => {
    expect((await deploy({ slug: 'Bad Slug', files: { 'index.html': 'x' } })).status).toBe(400);
    expect((await deploy({ slug: 'ok-slug', files: {} })).status).toBe(400);
    expect((await deploy({ slug: 'ok-slug', files: { 'index.html': 'x'.repeat(4_100_000) } })).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('reports network failures as 502', async () => {
    upstream.mockRejectedValueOnce(new TypeError('fetch failed'));

    const response = await deploy({ slug: 'ok-slug', files: { 'index.html': 'x' } });

    expect(response.status).toBe(502);
  });
});
