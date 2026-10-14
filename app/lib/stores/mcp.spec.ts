import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMCPStore } from './mcp';

describe('MCP administration client', () => {
  const initialSettings = useMCPStore.getState().settings;
  const token = 'test-only-admin-token-0123456789abcdef';
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    useMCPStore.setState({
      adminToken: '',
      isInitialized: false,
      settings: initialSettings,
      serverTools: {},
      error: null,
      isUpdatingConfig: false,
    });
    fetchMock.mockReset().mockImplementation(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads saved settings without reconnecting servers before a token is entered', async () => {
    const settings = { ...initialSettings, mcpConfig: { mcpServers: { probe: { type: 'stdio', command: 'node' } } } };
    localStorage.setItem('mcp_settings', JSON.stringify(settings));

    await useMCPStore.getState().initialize();

    expect(useMCPStore.getState().settings).toEqual(settings);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the token as a bearer credential and keeps it out of saved settings', async () => {
    useMCPStore.getState().setAdminToken(token);
    await useMCPStore.getState().updateSettings(initialSettings);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/mcp-update-config');
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer ' + token);
    expect(options?.cache).toBe('no-store');
    expect(localStorage.getItem('mcp_settings')).not.toContain(token);
  });

  it('authenticates availability checks', async () => {
    useMCPStore.getState().setAdminToken(token);
    await useMCPStore.getState().checkServersAvailabilities();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/mcp-check');
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer ' + token);
  });

  it('rejects saving without a token before making a request', async () => {
    await expect(useMCPStore.getState().updateSettings(initialSettings)).rejects.toThrow('administration token');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useMCPStore.getState().isUpdatingConfig).toBe(false);
  });

  it('surfaces authentication failures from the server', async () => {
    useMCPStore.getState().setAdminToken('incorrect');
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: 'A valid MCP administration token is required.' }, { status: 401 }),
    );

    await expect(useMCPStore.getState().updateSettings(initialSettings)).rejects.toThrow(
      'valid MCP administration token',
    );
    expect(localStorage.getItem('mcp_settings')).toBeNull();
  });
});
