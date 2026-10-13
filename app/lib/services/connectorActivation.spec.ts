import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  githubConnect: vi.fn(),
  gitlabConnect: vi.fn(),
  vercelUpdate: vi.fn(),
  netlifyUpdate: vi.fn(),
  supabaseUpdate: vi.fn(),
  updateSettings: vi.fn(),
  mcp: {
    settings: { mcpConfig: { mcpServers: {} } },
    serverTools: {} as Record<string, { status: string }>,
  },
}));

vi.mock('~/lib/stores/githubConnection', () => ({
  githubConnectionStore: { get: () => ({ token: '', tokenType: 'classic' }), connect: mocks.githubConnect },
}));
vi.mock('~/lib/stores/gitlabConnection', () => ({
  gitlabConnection: { get: () => ({ token: '', gitlabUrl: 'https://gitlab.com' }) },
  gitlabConnectionStore: { connect: mocks.gitlabConnect },
}));
vi.mock('~/lib/stores/vercel', () => ({
  vercelConnection: { get: () => ({ token: '' }) },
  updateVercelConnection: mocks.vercelUpdate,
}));
vi.mock('~/lib/stores/netlify', () => ({
  netlifyConnection: { get: () => ({ token: '' }) },
  updateNetlifyConnection: mocks.netlifyUpdate,
}));
vi.mock('~/lib/stores/supabase', () => ({
  supabaseConnection: { get: () => ({ token: '' }) },
  updateSupabaseConnection: mocks.supabaseUpdate,
}));
vi.mock('~/lib/stores/mcp', () => ({
  useMCPStore: { getState: () => ({ ...mocks.mcp, updateSettings: mocks.updateSettings }) },
}));

import { activateConnector } from './connectorActivation';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Invalid token' }, { status: 401 })));
  mocks.mcp.settings = { mcpConfig: { mcpServers: {} } };
  mocks.mcp.serverTools = {};
});
afterEach(() => vi.unstubAllGlobals());

describe('connector activation', () => {
  it('rejects missing credentials for every connector', async () => {
    for (const connector of ['github', 'gitlab', 'vercel', 'netlify', 'supabase', 'browserUseCloud'] as const) {
      await expect(activateConnector(connector)).rejects.toThrow();
    }
  });

  it('rejects GitLab validation failures even when its store resolves instead of throwing', async () => {
    mocks.gitlabConnect.mockResolvedValueOnce({ success: false, error: 'Invalid GitLab token' });
    await expect(activateConnector('gitlab', 'invalid-test-token')).rejects.toThrow('Invalid GitLab token');
  });

  it('rejects GitHub authentication failures', async () => {
    mocks.githubConnect.mockRejectedValueOnce(new Error('Invalid GitHub token'));
    await expect(activateConnector('github', 'invalid-test-token')).rejects.toThrow('Invalid GitHub token');
  });

  it('does not persist invalid deployment or database credentials', async () => {
    for (const connector of ['vercel', 'netlify', 'supabase'] as const) {
      await expect(activateConnector(connector, 'invalid-test-token')).rejects.toThrow();
    }
    expect(mocks.vercelUpdate).not.toHaveBeenCalled();
    expect(mocks.netlifyUpdate).not.toHaveBeenCalled();
    expect(mocks.supabaseUpdate).not.toHaveBeenCalled();
  });

  it('persists deployment and database credentials only after successful validation', async () => {
    vi.mocked(fetch).mockImplementation(async () => Response.json({ user: { id: 'validated-user' }, stats: {} }));

    for (const connector of ['vercel', 'netlify', 'supabase'] as const) {
      await activateConnector(connector, 'validated-test-token');
    }

    for (const update of [mocks.vercelUpdate, mocks.netlifyUpdate, mocks.supabaseUpdate]) {
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ token: 'validated-test-token' }));
    }
  });

  it('rolls back Browser Use configuration when validation fails', async () => {
    await expect(activateConnector('browserUseCloud', 'bu_invalid-test-token')).rejects.toThrow('still off');
    expect(mocks.updateSettings).toHaveBeenCalledTimes(2);
    expect(mocks.updateSettings).toHaveBeenLastCalledWith({ mcpConfig: { mcpServers: {} } });
  });
});
