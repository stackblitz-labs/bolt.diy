import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MCPService } from '~/lib/services/mcpService';
import { loader } from '~/routes/api.mcp-check';
import { action } from '~/routes/api.mcp-update-config';

describe('MCP administration authorization', () => {
  const token = 'test-only-admin-token-0123456789abcdef';
  const context = { cloudflare: { env: { MCP_ADMIN_TOKEN: token } } };
  const updateConfig = vi.fn().mockResolvedValue({});
  const checkServersAvailabilities = vi.fn().mockResolvedValue({});

  let getInstance: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('MCP_ADMIN_TOKEN', '');
    updateConfig.mockClear();
    checkServersAvailabilities.mockClear();
    getInstance = vi.spyOn(MCPService, 'getInstance').mockReturnValue({
      updateConfig,
      checkServersAvailabilities,
    } as unknown as MCPService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  function update(
    body = '{"mcpServers":{}}',
    authorization?: string,
    extraHeaders: HeadersInit = {},
    routeContext: unknown = context,
  ) {
    const headers = new Headers(extraHeaders);
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

    if (authorization) {
      headers.set('Authorization', authorization);
    }

    return action({
      request: new Request('https://bolt.test/api/mcp-update-config', { method: 'POST', headers, body }),
      context: routeContext,
      params: {},
    } as never);
  }

  it.each([undefined, 'Bearer wrong-token', 'Basic credentials'])(
    'rejects %s before reading config or creating clients',
    async (authorization) => {
      const response = await update('{"mcpServers":{"probe":{"command":"node"}}}', authorization);

      expect(response.status).toBe(401);
      expect(getInstance).not.toHaveBeenCalled();
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    },
  );

  it.each(['', 'too-short'])(
    'fails closed when the operator token is unconfigured or weak',
    async (configuredToken) => {
      const response = await update(
        undefined,
        'Bearer ' + token,
        {},
        {
          cloudflare: { env: { MCP_ADMIN_TOKEN: configuredToken } },
        },
      );

      expect(response.status).toBe(503);
      expect(getInstance).not.toHaveBeenCalled();
    },
  );

  it('uses the server process token when no Cloudflare binding is present', async () => {
    vi.stubEnv('MCP_ADMIN_TOKEN', token);
    expect((await update(undefined, 'Bearer ' + token, {}, {})).status).toBe(200);
  });

  it('rejects a cross-origin browser request even with a valid token', async () => {
    expect((await update(undefined, 'Bearer ' + token, { Origin: 'https://evil.test' })).status).toBe(403);
    expect(getInstance).not.toHaveBeenCalled();
  });

  it('allows an authenticated same-origin update with validated configuration', async () => {
    const config = { mcpServers: { probe: { type: 'stdio', command: 'node', args: ['server.mjs'] } } };
    const response = await update(JSON.stringify(config), 'Bearer ' + token, { Origin: 'https://bolt.test' });

    expect(response.status).toBe(200);
    expect(updateConfig).toHaveBeenCalledWith(config);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(['null', '{}', '{"mcpServers":{"probe":{"command":""}}}', '{'])(
    'rejects malformed config %s before changing existing clients',
    async (body) => {
      expect((await update(body, 'Bearer ' + token)).status).toBe(400);
      expect(getInstance).not.toHaveBeenCalled();
    },
  );

  it('bounds authenticated request bodies', async () => {
    expect((await update(JSON.stringify({ padding: 'x'.repeat(64 * 1024) }), 'Bearer ' + token)).status).toBe(413);
    expect(getInstance).not.toHaveBeenCalled();
  });

  it('requires JSON content type', async () => {
    expect((await update(undefined, 'Bearer ' + token, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect(getInstance).not.toHaveBeenCalled();
  });

  it('protects availability checks, which can reconnect configured servers', async () => {
    const response = await loader({
      request: new Request('https://bolt.test/api/mcp-check'),
      context,
      params: {},
    } as never);

    expect(response.status).toBe(401);
    expect(getInstance).not.toHaveBeenCalled();
  });

  it('allows availability checks with a valid token', async () => {
    const response = await loader({
      request: new Request('https://bolt.test/api/mcp-check', { headers: { Authorization: 'Bearer ' + token } }),
      context,
      params: {},
    } as never);

    expect(response.status).toBe(200);
    expect(checkServersAvailabilities).toHaveBeenCalledOnce();
  });
});
