import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { action, loader } from '~/routes/api.git-proxy.$';

describe('Git proxy destinations', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(
      new Response('git refs', {
        headers: {
          'Content-Type': 'application/x-git-upload-pack-advertisement',
          'Cache-Control': 'public, max-age=86400',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function invoke(path: string, method = 'GET', headers: HeadersInit = {}) {
    const request = new Request(
      'http://localhost:5173/api/git-proxy/' + path + (method === 'POST' ? '' : '?service=git-upload-pack'),
      {
        method,
        headers,
        ...(method === 'POST' ? { body: 'git packet' } : {}),
      },
    );

    return (method === 'GET' ? loader : action)({ request, params: { '*': path }, context: {} } as never);
  }

  it.each(['github.com', 'gitlab.com', 'bitbucket.org'])('allows Git refs from %s', async (host) => {
    const response = await invoke(host + '/owner/repo.git/info/refs');

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('git refs');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(['example.com', '127.0.0.1', '[::1]', 'github.com.evil.test', 'user@github.com', 'github.com:8443'])(
    'rejects untrusted destination %s without fetching it',
    async (host) => {
      const response = await invoke(host + '/owner/repo.git/info/refs');

      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects website pages on an allowed host', async () => {
    expect((await invoke('github.com/owner/repo')).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects cross-origin callers', async () => {
    const response = await invoke('github.com/owner/repo.git/info/refs', 'GET', { Origin: 'https://evil.test' });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards Git credentials only to an allowed Git endpoint', async () => {
    await invoke('github.com/owner/repo.git/git-upload-pack', 'POST', {
      Authorization: 'Basic private-token',
      'Content-Type': 'application/x-git-upload-pack-request',
      'X-HTTP-Method-Override': 'DELETE',
      Cookie: 'private-cookie',
    });

    const options = fetchMock.mock.calls[0][1]!;
    const headers = new Headers(options.headers);

    expect(headers.get('Authorization')).toBe('Basic private-token');
    expect(headers.has('Cookie')).toBe(false);
    expect(headers.has('X-HTTP-Method-Override')).toBe(false);
    expect(options.redirect).toBe('manual');
  });

  it.each([
    'https://127.0.0.1/internal/info/refs?service=git-upload-pack',
    'http://github.com/new/repo.git/info/refs?service=git-upload-pack',
    'https://gitlab.com/new/repo.git/info/refs?service=git-upload-pack',
  ])('rejects a redirect to %s before forwarding credentials', async (location) => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: location } }));

    const response = await invoke('github.com/owner/repo.git/info/refs', 'GET', { Authorization: 'Basic secret' });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows a Git repository rename on the same allowed host', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 301,
        headers: { Location: '/new/repo.git/info/refs?service=git-upload-pack' },
      }),
    );

    const response = await invoke('github.com/old/repo.git/info/refs');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      'https://github.com/new/repo.git/info/refs?service=git-upload-pack',
    );
  });

  it('rejects unsupported methods', async () => {
    expect((await invoke('github.com/owner/repo.git/info/refs', 'DELETE')).status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('limits redirect loops', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: '/owner/repo.git/info/refs?service=git-upload-pack' },
        }),
    );

    expect((await invoke('github.com/owner/repo.git/info/refs')).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('allows same-origin preflight without making an outbound request', async () => {
    const response = await invoke('github.com/owner/repo.git/info/refs', 'OPTIONS', {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
