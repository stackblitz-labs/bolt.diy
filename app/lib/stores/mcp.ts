import { create } from 'zustand';
import type { MCPConfig, MCPServerTools } from '~/lib/services/mcpService';

const MCP_SETTINGS_KEY = 'mcp_settings';
const isBrowser = typeof window !== 'undefined';

export type ConnectorId = 'github' | 'gitlab' | 'vercel' | 'netlify' | 'supabase' | 'browserUseCloud';

type MCPSettings = {
  mcpConfig: MCPConfig;
  maxLLMSteps: number;
  webSearchEnabled: boolean;
  connectorEnabled: {
    [connector in ConnectorId]: boolean;
  };
  toolEnabled: Record<string, boolean>;
};

const defaultSettings = {
  maxLLMSteps: 5,
  webSearchEnabled: true,
  connectorEnabled: {
    github: false,
    gitlab: false,
    vercel: false,
    netlify: false,
    supabase: false,
    browserUseCloud: false,
  },
  mcpConfig: {
    mcpServers: {},
  },
  toolEnabled: {},
} satisfies MCPSettings;

type Store = {
  adminToken: string;
  isInitialized: boolean;
  settings: MCPSettings;
  serverTools: MCPServerTools;
  error: string | null;
  isUpdatingConfig: boolean;
};

type Actions = {
  setAdminToken: (token: string) => void;
  initialize: () => Promise<void>;
  updateSettings: (settings: MCPSettings) => Promise<void>;
  setWebSearchEnabled: (enabled: boolean) => void;
  setConnectorEnabled: (connector: keyof MCPSettings['connectorEnabled'], enabled: boolean) => void;
  setToolEnabled: (toolName: string, enabled: boolean) => void;
  checkServersAvailabilities: () => Promise<void>;
};

export const useMCPStore = create<Store & Actions>((set, get) => ({
  adminToken: '',
  setAdminToken: (adminToken) => set({ adminToken }),
  isInitialized: false,
  settings: defaultSettings,
  serverTools: {},
  error: null,
  isUpdatingConfig: false,
  initialize: async () => {
    if (get().isInitialized) {
      return;
    }

    if (isBrowser) {
      const savedConfig = localStorage.getItem(MCP_SETTINGS_KEY);

      if (savedConfig) {
        try {
          const savedSettings = JSON.parse(savedConfig) as Partial<MCPSettings>;

          const settings = {
            ...defaultSettings,
            ...savedSettings,
            connectorEnabled: { ...defaultSettings.connectorEnabled, ...savedSettings.connectorEnabled },
            toolEnabled: { ...defaultSettings.toolEnabled, ...savedSettings.toolEnabled },
          };

          set(() => ({ settings }));

          if (get().adminToken.trim()) {
            const serverTools = await updateServerConfig(settings.mcpConfig, get().adminToken);
            set(() => ({ serverTools }));
          }
        } catch (error) {
          console.error('Error parsing saved mcp config:', error);
          set(() => ({
            error: `Error parsing saved mcp config: ${error instanceof Error ? error.message : String(error)}`,
          }));
        }
      } else {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(defaultSettings));
      }
    }

    set(() => ({ isInitialized: true }));
  },
  updateSettings: async (newSettings: MCPSettings) => {
    if (get().isUpdatingConfig) {
      return;
    }

    try {
      set(() => ({ isUpdatingConfig: true }));

      const serverTools = await updateServerConfig(newSettings.mcpConfig, get().adminToken);

      if (isBrowser) {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(newSettings));
      }

      set(() => ({ settings: newSettings, serverTools }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
  setWebSearchEnabled: (enabled: boolean) => {
    const settings = { ...get().settings, webSearchEnabled: enabled };

    if (isBrowser) {
      localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(settings));
    }

    set({ settings });
  },
  setConnectorEnabled: (connector, enabled) => {
    const settings = {
      ...get().settings,
      connectorEnabled: { ...get().settings.connectorEnabled, [connector]: enabled },
    };

    if (isBrowser) {
      localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(settings));
    }

    set({ settings });
  },
  setToolEnabled: (toolName, enabled) => {
    const settings = {
      ...get().settings,
      toolEnabled: { ...get().settings.toolEnabled, [toolName]: enabled },
    };

    if (isBrowser) {
      localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(settings));
    }

    set({ settings });
  },
  checkServersAvailabilities: async () => {
    const response = await requestMCP('/api/mcp-check', get().adminToken, {
      method: 'GET',
    });

    const serverTools = (await response.json()) as MCPServerTools;

    set(() => ({ serverTools }));
  },
}));

async function updateServerConfig(config: MCPConfig, token: string) {
  const response = await requestMCP('/api/mcp-update-config', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  const data = (await response.json()) as MCPServerTools;

  return data;
}

async function requestMCP(path: string, token: string, options: RequestInit) {
  if (!token.trim()) {
    throw new Error('Enter the MCP administration token before connecting servers.');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', 'Bearer ' + token.trim());

  const response = await fetch(path, { ...options, headers, cache: 'no-store' });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: unknown; message?: unknown };

    const message =
      typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : 'MCP request failed.';
    throw new Error(message);
  }

  return response;
}
