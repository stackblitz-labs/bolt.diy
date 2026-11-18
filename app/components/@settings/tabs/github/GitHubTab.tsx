import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { ServiceConnectionCard } from '~/components/@settings/shared/ServiceConnectionCard';
import { ServiceResourceList } from '~/components/@settings/shared/ServiceResourceList';
import { ServiceStatsPanel } from '~/components/@settings/shared/ServiceStatsPanel';
import { Button } from '~/components/ui/Button';
import {
  githubConnection,
  updateGitHubConnection,
  initializeGitHubConnection,
  isConnecting as githubConnecting,
  isFetchingStats,
  fetchGitHubStatsViaAPI,
} from '~/lib/stores/github';
import type { GitHubRepoInfo } from '~/types/GitHub';

// GitHub logo SVG component
const GithubLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
    />
  </svg>
);

export default function GitHubTab() {
  const connection = useStore(githubConnection);
  const isConnecting = useStore(githubConnecting);
  const isLoadingStats = useStore(isFetchingStats);

  // Local state for UI
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);
  const [isReposExpanded, setIsReposExpanded] = useState(true);
  const [tokenInput, setTokenInput] = useState('');

  const [connectionTest, setConnectionTest] = useState<{
    status: 'success' | 'error' | 'testing';
    message: string;
    timestamp?: number;
  } | null>(null);

  // Service-specific connection logic
  const handleConnect = async (): Promise<void> => {
    if (!tokenInput.trim()) {
      toast.error('Please provide a valid GitHub token');
      return;
    }

    try {
      // Test connection
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${tokenInput}`,
          'User-Agent': 'Bolt.diy',
        },
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }

      const userData = (await response.json()) as any;

      // Update connection
      updateGitHubConnection({
        user: userData,
        token: tokenInput,
        metadata: {
          tokenType: 'classic',
        },
      });

      // Fetch stats
      await fetchGitHubStatsViaAPI();

      toast.success(`Connected to GitHub as ${userData.login}`);
      setTokenInput(''); // Clear input after successful connection
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to GitHub';
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    updateGitHubConnection({
      user: null,
      token: '',
      metadata: {
        tokenType: 'classic',
      },
      stats: undefined,
    });

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('github_connection');
    }

    toast.success('Disconnected from GitHub');
  };

  const handleRefreshStats = async (): Promise<void> => {
    await fetchGitHubStatsViaAPI();
    toast.success('GitHub stats refreshed');
  };

  const handleTestConnection = async (): Promise<void> => {
    if (!connection.token && !connection.user) {
      setConnectionTest({
        status: 'error',
        message: 'No token available',
        timestamp: Date.now(),
      });
      return;
    }

    setConnectionTest({
      status: 'testing',
      message: 'Testing connection...',
    });

    try {
      // Test via API endpoint if no token (server-side)
      if (!connection.token) {
        const response = await fetch('/api/github-user');

        if (response.ok) {
          setConnectionTest({
            status: 'success',
            message: 'Connection successful',
            timestamp: Date.now(),
          });
        } else {
          setConnectionTest({
            status: 'error',
            message: `Connection failed: ${response.status}`,
            timestamp: Date.now(),
          });
        }
      } else {
        // Test directly
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${connection.token}`,
            'User-Agent': 'Bolt.diy',
          },
        });

        if (response.ok) {
          setConnectionTest({
            status: 'success',
            message: 'Connection successful',
            timestamp: Date.now(),
          });
        } else {
          setConnectionTest({
            status: 'error',
            message: `Connection failed: ${response.status}`,
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      setConnectionTest({
        status: 'error',
        message: 'Connection test failed',
        timestamp: Date.now(),
      });
    }
  };

  // Initialize on mount
  useEffect(() => {
    initializeGitHubConnection();
  }, []);

  // Prepare stats for display
  const stats = useMemo(() => {
    if (!connection.stats) {
      return [];
    }

    return [
      {
        label: 'Public Repos',
        value: connection.stats.publicRepos || 0,
        icon: 'i-ph:git-branch',
      },
      {
        label: 'Private Repos',
        value: connection.stats.privateRepos || 0,
        icon: 'i-ph:lock',
      },
      {
        label: 'Total Stars',
        value: connection.stats.totalStars || 0,
        icon: 'i-ph:star',
      },
      {
        label: 'Total Forks',
        value: connection.stats.totalForks || 0,
        icon: 'i-ph:git-fork',
      },
    ];
  }, [connection.stats]);

  // Prepare repositories for resource list
  const repoResources = useMemo(() => {
    if (!connection.stats?.repos) {
      return [];
    }

    return connection.stats.repos.map((repo: GitHubRepoInfo) => ({
      id: repo.id.toString(),
      name: repo.name,
      description: repo.description || 'No description',
      status: repo.archived ? 'archived' : repo.private ? 'private' : 'public',
      statusVariant: (repo.archived ? 'default' : repo.private ? 'warning' : 'success') as
        'default' | 'success' | 'warning',
      url: repo.html_url,
      updatedAt: repo.updated_at,
      metadata: repo,
    }));
  }, [connection.stats?.repos]);

  // Define actions for repositories
  const repoActions = useMemo(
    () => [
      {
        name: 'View Repository',
        icon: 'i-ph:eye',
        permissionId: 'view_repo',
        action: async (resource: (typeof repoResources)[0]) => {
          window.open(resource.url, '_blank');
        },
      },
      {
        name: 'View Issues',
        icon: 'i-ph:list-bullets',
        permissionId: 'view_issues',
        action: async (resource: (typeof repoResources)[0]) => {
          window.open(`${resource.url}/issues`, '_blank');
        },
      },
      {
        name: 'View Pull Requests',
        icon: 'i-ph:git-pull-request',
        permissionId: 'view_prs',
        action: async (resource: (typeof repoResources)[0]) => {
          window.open(`${resource.url}/pulls`, '_blank');
        },
      },
    ],
    [],
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">GitHub Integration</h2>
        </div>
        <div className="flex items-center gap-2">
          <GithubLogo />
          {connection.metadata?.rateLimit && (
            <div className="flex items-center gap-2 px-3 py-1 bg-bolt-elements-background-depth-1 rounded-lg text-xs">
              <div className="i-ph:cloud w-4 h-4 text-bolt-elements-textSecondary" />
              <span className="text-bolt-elements-textSecondary">
                API: {connection.metadata.rateLimit.remaining}/{connection.metadata.rateLimit.limit}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary">
        Connect your GitHub account to access repositories and manage your projects directly from bolt.diy
      </p>

      {/* Connection Card */}
      <ServiceConnectionCard
        serviceName="GitHub"
        serviceIcon={<GithubLogo />}
        user={
          connection.user
            ? {
                name: connection.user.name,
                username: connection.user.login,
                avatar: connection.user.avatar_url,
              }
            : undefined
        }
        isConnected={!!connection.user}
        isConnecting={isConnecting}
        tokenValue={tokenInput}
        onTokenChange={setTokenInput}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onTestConnection={handleTestConnection}
        connectionTest={connectionTest}
        tokenPlaceholder="Enter your GitHub Personal Access Token"
        description="Generate a token from your GitHub account settings"
      />

      {/* Stats Panel */}
      {connection.user && connection.stats && (
        <ServiceStatsPanel
          title="Statistics"
          stats={stats}
          lastUpdated={connection.stats.lastUpdated}
          isExpanded={isStatsExpanded}
          onToggle={() => setIsStatsExpanded(!isStatsExpanded)}
          isLoading={isLoadingStats}
        />
      )}

      {/* Repositories List */}
      {connection.user && repoResources.length > 0 && (
        <ServiceResourceList
          title="Repositories"
          resources={repoResources}
          actions={repoActions}
          isExpanded={isReposExpanded}
          onToggle={() => setIsReposExpanded(!isReposExpanded)}
          emptyMessage="No repositories found"
          permissionEnabled={() => true}
        />
      )}

      {/* Empty State */}
      {connection.user && (!connection.stats || repoResources.length === 0) && !isLoadingStats && (
        <div className="text-center py-12">
          <div className="i-ph:git-branch w-12 h-12 mx-auto mb-4 text-bolt-elements-textTertiary" />
          <p className="text-bolt-elements-textSecondary">No repositories found in your GitHub account</p>
          <Button variant="secondary" onClick={handleRefreshStats} className="mt-4">
            Refresh Stats
          </Button>
        </div>
      )}
    </div>
  );
}
