import { createStaticHandler, RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { action, loader } from './api.supabase';
import routes from '~/routes';

const route = routes.find(({ file }) => file === 'routes/api.supabase.ts');

if (!route?.path) {
  throw new Error('The Supabase API must be registered in the route manifest');
}

const { queryRoute } = createStaticHandler([{ path: route.path, loader, action }]);
const upstream = vi.fn<typeof fetch>();

function requestSupabase(init?: RequestInit, workerToken?: string) {
  const request = new Request('http://localhost/api/supabase', init);

  const requestContext = Object.assign(new RouterContextProvider(), {
    clientAddress: '127.0.0.1',
    cloudflare: { env: { VITE_SUPABASE_ACCESS_TOKEN: workerToken } },
  });

  return queryRoute(request, { requestContext });
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_ACCESS_TOKEN', '');
  vi.stubGlobal('fetch', upstream);
  upstream.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Supabase API route', () => {
  it('validates a server credential and returns status without project data', async () => {
    upstream.mockResolvedValueOnce(Response.json([{ id: 'private-project' }]));

    const response = await requestSupabase(undefined, 'worker-token');

    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toBe('');
    expect(upstream).toHaveBeenCalledExactlyOnceWith(
      'https://api.supabase.com/v1/projects',
      expect.objectContaining({ headers: { Authorization: 'Bearer worker-token' } }),
    );
  });

  it('honors cookie, worker, then process credential precedence', async () => {
    vi.stubEnv('VITE_SUPABASE_ACCESS_TOKEN', 'process-token');

    const cookie = encodeURIComponent(JSON.stringify({ VITE_SUPABASE_ACCESS_TOKEN: 'cookie-token' }));
    upstream.mockImplementation(async () => Response.json([]));

    await requestSupabase({ headers: { Cookie: `apiKeys=${cookie}` } }, 'worker-token');
    await requestSupabase(undefined, 'worker-token');
    await requestSupabase();

    expect(upstream.mock.calls.map(([, options]) => new Headers(options?.headers).get('Authorization'))).toEqual([
      'Bearer cookie-token',
      'Bearer worker-token',
      'Bearer process-token',
    ]);
  });

  it('rejects missing and rejected credentials', async () => {
    const missing = await requestSupabase();

    expect(missing.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();

    upstream.mockResolvedValueOnce(new Response('Private upstream response', { status: 403 }));

    const rejected = await requestSupabase(undefined, 'invalid-worker-token');

    expect(rejected.status).toBe(401);
    await expect(rejected.json()).resolves.toEqual({ error: 'Invalid Supabase token' });
  });

  it('keeps upstream error details out of the response', async () => {
    upstream.mockRejectedValueOnce(new Error('Upstream transport error with private details'));

    const response = await requestSupabase(undefined, 'worker-token');

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Unable to validate the Supabase token' });
  });

  it('keeps the existing explicit-token POST contract', async () => {
    const project = { id: 'project', created_at: '2026-11-18T00:00:00Z' };
    upstream.mockResolvedValueOnce(Response.json([project]));

    const response = await requestSupabase({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'explicit-token' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: { email: 'Connected', role: 'Admin' },
      stats: { projects: [project], totalProjects: 1 },
    });
    expect(upstream).toHaveBeenCalledExactlyOnceWith(
      'https://api.supabase.com/v1/projects',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer explicit-token' }) }),
    );
  });
});
