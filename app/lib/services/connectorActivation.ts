import { githubConnectionStore } from '~/lib/stores/githubConnection';
import { gitlabConnection, gitlabConnectionStore } from '~/lib/stores/gitlabConnection';
import { useMCPStore } from '~/lib/stores/mcp';
import { netlifyConnection, updateNetlifyConnection } from '~/lib/stores/netlify';
import { supabaseConnection, updateSupabaseConnection } from '~/lib/stores/supabase';
import { updateVercelConnection, vercelConnection } from '~/lib/stores/vercel';
import type { NetlifyUser } from '~/types/netlify';
import type { SupabaseStats, SupabaseUser } from '~/types/supabase';
import type { VercelUser, VercelUserResponse } from '~/types/vercel';

export type ConnectorActivationId = 'github' | 'gitlab' | 'vercel' | 'netlify' | 'supabase' | 'browserUseCloud';

// Browser Use Cloud MCP server configuration
const BROWSER_USE_SERVER = 'browser-use-cloud';
const BROWSER_USE_URL = 'https://api.browser-use.com/v3/mcp';
const BROWSER_USE_KEY_HEADER = 'X-Browser-Use-API-Key';
const BROWSER_USE_KEY_PREFIX = 'bu_';

interface SupabaseConnectionResponse {
  error?: string;
  user?: SupabaseUser;
  stats?: SupabaseStats;
}

async function ensureServerCredential(endpoint: string) {
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`No valid API key is configured. Add a key to enable this connector.`);
  }
}

export async function activateConnector(connector: ConnectorActivationId, enteredApiKey = '') {
  const apiKey = enteredApiKey.trim();

  switch (connector) {
    case 'github': {
      const connection = githubConnectionStore.get();
      const token = apiKey || connection.token;

      if (token) {
        await githubConnectionStore.connect(token, connection.tokenType);
      } else {
        await ensureServerCredential('/api/github-user');
      }

      return;
    }

    case 'gitlab': {
      const connection = gitlabConnection.get();
      const token = apiKey || connection.token;

      if (!token) {
        throw new Error('Enter a GitLab personal access token to enable this connector.');
      }

      const result = await gitlabConnectionStore.connect(token, connection.gitlabUrl || 'https://gitlab.com');

      if (!result.success) {
        throw new Error(result.error || 'GitLab rejected this token. Check it and try again.');
      }

      return;
    }

    case 'vercel': {
      const token = apiKey || vercelConnection.get().token;

      if (!token) {
        await ensureServerCredential('/api/vercel-user');

        return;
      }

      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Vercel rejected this token (${response.status}). Check it and try again.`);
      }

      const data = (await response.json()) as VercelUserResponse;

      // Normalize the response - Vercel API can return user nested or at root level
      const user: VercelUser = data.user
        ? data.user
        : {
            id: data.id!,
            username: data.username!,
            email: data.email!,
            name: data.name!,
            avatar: data.avatar,
          };

      updateVercelConnection({ user, token });

      return;
    }

    case 'netlify': {
      const token = apiKey || netlifyConnection.get().token;

      if (!token) {
        await ensureServerCredential('/api/netlify-user');

        return;
      }

      const response = await fetch('https://api.netlify.com/api/v1/user', {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Bolt.diy' },
      });

      if (!response.ok) {
        throw new Error(`Netlify rejected this token (${response.status}). Check it and try again.`);
      }

      const user = (await response.json()) as NetlifyUser;
      updateNetlifyConnection({ user, token });

      return;
    }

    case 'supabase': {
      const token = apiKey || supabaseConnection.get().token || import.meta.env?.VITE_SUPABASE_ACCESS_TOKEN;

      if (!token) {
        await ensureServerCredential('/api/supabase-user');

        return;
      }

      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = (await response.json()) as SupabaseConnectionResponse;

      if (!response.ok) {
        throw new Error(data.error || 'Supabase rejected this token. Check it and try again.');
      }

      updateSupabaseConnection({ user: data.user, stats: data.stats, token });

      return;
    }

    case 'browserUseCloud': {
      const store = useMCPStore.getState();
      const currentServer = store.settings.mcpConfig.mcpServers[BROWSER_USE_SERVER];

      const storedKey =
        currentServer && 'headers' in currentServer ? currentServer.headers?.[BROWSER_USE_KEY_HEADER] : '';

      const key = apiKey || storedKey || '';

      if (!key) {
        throw new Error('Enter a Browser Use API key to enable this connector.');
      }

      if (!key.startsWith(BROWSER_USE_KEY_PREFIX)) {
        throw new Error(`Browser Use API keys start with "${BROWSER_USE_KEY_PREFIX}".`);
      }

      const updatedSettings = {
        ...store.settings,
        mcpConfig: {
          ...store.settings.mcpConfig,
          mcpServers: {
            ...store.settings.mcpConfig.mcpServers,
            [BROWSER_USE_SERVER]: {
              type: 'streamable-http' as const,
              url: BROWSER_USE_URL,
              headers: { [BROWSER_USE_KEY_HEADER]: key },
            },
          },
        },
      };

      await store.updateSettings(updatedSettings);

      if (useMCPStore.getState().serverTools[BROWSER_USE_SERVER]?.status !== 'available') {
        await store.updateSettings(store.settings);
        throw new Error('Browser Use could not validate this API key. The connector is still off.');
      }

      return;
    }
  }
}
