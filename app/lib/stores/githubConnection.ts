import { atom, computed } from 'nanostores';
import { removeSecureCookie, setSecureCookie } from '~/lib/api/secure-cookies';
import { gitHubApiService } from '~/lib/services/githubApiService';
import { logStore } from '~/lib/stores/logs';
import type { GitHubConnectionState } from '~/types/GitHub';
import { calculateStatsSummary } from '~/utils/githubStats';

// Auto-connect using environment variable
const envToken = import.meta.env?.VITE_GITHUB_ACCESS_TOKEN;
const envTokenType = import.meta.env?.VITE_GITHUB_TOKEN_TYPE;

const githubConnectionAtom = atom<GitHubConnectionState>({
  user: null,
  token: envToken || '',
  metadata: {
    tokenType:
      envTokenType === 'classic' || envTokenType === 'fine-grained'
        ? (envTokenType as 'classic' | 'fine-grained')
        : 'classic',
  },
});

// Initialize connection from localStorage on startup
function initializeConnection() {
  try {
    const savedConnection = localStorage.getItem('github_connection');

    if (savedConnection) {
      const parsed = JSON.parse(savedConnection);

      // Migrate old format: move tokenType to metadata
      if (parsed.tokenType && !parsed.metadata) {
        parsed.metadata = {
          tokenType: parsed.tokenType,
        };
        delete parsed.tokenType;
      }

      // Ensure metadata.tokenType is set
      if (!parsed.metadata?.tokenType) {
        parsed.metadata = {
          ...parsed.metadata,
          tokenType: 'classic',
        };
      }

      // Only set if we have a valid user
      if (parsed.user) {
        githubConnectionAtom.set(parsed);
      }
    }
  } catch (error) {
    console.error('Error initializing GitHub connection:', error);
    localStorage.removeItem('github_connection');
  }
}

// Initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  initializeConnection();
}

// Computed store for checking if connected
export const isGitHubConnected = computed(githubConnectionAtom, (connection) => !!connection.user);

// Computed store for GitHub stats summary
export const githubStatsSummary = computed(githubConnectionAtom, (connection) => {
  if (!connection.stats) {
    return null;
  }

  return calculateStatsSummary(connection.stats);
});

// Connection status atoms
export const isGitHubConnecting = atom(false);
export const isGitHubLoadingStats = atom(false);

// GitHub connection store methods
export const githubConnectionStore = {
  // Get current connection
  get: () => githubConnectionAtom.get(),

  // Connect to GitHub
  async connect(token: string, tokenType: 'classic' | 'fine-grained' = 'classic'): Promise<void> {
    if (isGitHubConnecting.get()) {
      throw new Error('Connection already in progress');
    }

    isGitHubConnecting.set(true);

    try {
      // Fetch user data
      const { user, rateLimit } = await gitHubApiService.fetchUser(token, tokenType);

      // Create connection object
      const connection: GitHubConnectionState = {
        user,
        token,
        metadata: {
          tokenType,
          rateLimit,
        },
      };

      // Set cookies for client-side access
      setSecureCookie('githubUsername', user.login);
      setSecureCookie('githubToken', token);
      setSecureCookie('git:github.com', JSON.stringify({ username: token, password: 'x-oauth-basic' }));

      // Store connection details in localStorage
      localStorage.setItem('github_connection', JSON.stringify(connection));

      // Update atom
      githubConnectionAtom.set(connection);

      logStore.logInfo('Connected to GitHub', {
        type: 'system',
        message: `Connected to GitHub as ${user.login}`,
      });

      // Fetch stats in background
      this.fetchStats().catch((error) => {
        console.error('Failed to fetch initial GitHub stats:', error);
      });
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);
      logStore.logError(`GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        type: 'system',
        message: 'GitHub authentication failed',
      });
      throw error;
    } finally {
      isGitHubConnecting.set(false);
    }
  },

  // Disconnect from GitHub
  disconnect(): void {
    // Clear atoms
    githubConnectionAtom.set({
      user: null,
      token: '',
      metadata: {
        tokenType: 'classic',
      },
    });

    // Clear localStorage
    localStorage.removeItem('github_connection');

    // Clear cookies
    removeSecureCookie('githubUsername');
    removeSecureCookie('githubToken');
    removeSecureCookie('git:github.com');

    // Clear API service cache
    gitHubApiService.clearCache();

    logStore.logInfo('Disconnected from GitHub', {
      type: 'system',
      message: 'Disconnected from GitHub',
    });
  },

  // Fetch GitHub stats
  async fetchStats(): Promise<void> {
    const connection = githubConnectionAtom.get();

    if (!connection.user || !connection.token) {
      throw new Error('Not connected to GitHub');
    }

    if (isGitHubLoadingStats.get()) {
      return; // Already loading
    }

    isGitHubLoadingStats.set(true);

    try {
      const stats = await gitHubApiService.fetchStats(connection.token, connection.metadata?.tokenType || 'classic');

      // Update connection with stats
      const updatedConnection: GitHubConnectionState = {
        ...connection,
        stats,
      };

      // Update localStorage
      localStorage.setItem('github_connection', JSON.stringify(updatedConnection));

      // Update atom
      githubConnectionAtom.set(updatedConnection);

      logStore.logInfo('GitHub stats refreshed', {
        type: 'system',
        message: 'Successfully refreshed GitHub statistics',
      });
    } catch (error) {
      console.error('Failed to fetch GitHub stats:', error);

      // If the error is due to expired token, disconnect
      if (error instanceof Error && error.message.includes('401')) {
        logStore.logError('GitHub token has expired', {
          type: 'system',
          message: 'GitHub token has expired. Please reconnect your account.',
        });
        this.disconnect();
      }

      throw error;
    } finally {
      isGitHubLoadingStats.set(false);
    }
  },

  // Update token type
  updateTokenType(tokenType: 'classic' | 'fine-grained'): void {
    const connection = githubConnectionAtom.get();

    const updatedConnection: GitHubConnectionState = {
      ...connection,
      metadata: {
        ...connection.metadata,
        tokenType,
      },
    };

    githubConnectionAtom.set(updatedConnection);
    localStorage.setItem('github_connection', JSON.stringify(updatedConnection));
  },

  // Clear stats cache
  clearCache(): void {
    const connection = githubConnectionAtom.get();

    if (connection.token) {
      gitHubApiService.clearUserCache(connection.token);
    }
  },

  // Subscribe to connection changes
  subscribe: githubConnectionAtom.subscribe.bind(githubConnectionAtom),
};

// Export the atom for direct access
export { githubConnectionAtom };
