import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { ServiceConnectionCard } from '~/components/@settings/shared/ServiceConnectionCard';
import { ServiceResourceList } from '~/components/@settings/shared/ServiceResourceList';
import { ServiceStatsPanel } from '~/components/@settings/shared/ServiceStatsPanel';
import { Button } from '~/components/ui/Button';
import { gitlabConnectionStore, gitlabConnection } from '~/lib/stores/gitlabConnection';

// GitLab logo SVG component
const GitLabLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"
    />
  </svg>
);

export default function GitLabTab() {
  const connection = useStore(gitlabConnection);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Local state for UI
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const [tokenInput, setTokenInput] = useState('');

  const [connectionTest, setConnectionTest] = useState<{
    status: 'success' | 'error' | 'testing';
    message: string;
    timestamp?: number;
  } | null>(null);

  // Service-specific connection logic
  const handleConnect = async (): Promise<void> => {
    if (!tokenInput.trim()) {
      toast.error('Please provide a valid GitLab token');
      return;
    }

    setIsConnecting(true);

    try {
      const result = await gitlabConnectionStore.connect(tokenInput);

      if (result.success) {
        toast.success(`Connected to GitLab`);
        setTokenInput(''); // Clear input after successful connection
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to GitLab';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    gitlabConnectionStore.disconnect();
    toast.success('Disconnected from GitLab');
  };

  const handleRefreshStats = async (): Promise<void> => {
    setIsLoadingStats(true);

    try {
      const result = await gitlabConnectionStore.fetchStats(true);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stats');
      }

      toast.success('GitLab stats refreshed');
    } catch {
      toast.error('Failed to refresh stats');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleTestConnection = async (): Promise<void> => {
    if (!connection.token) {
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
      const response = await fetch('https://gitlab.com/api/v4/user', {
        headers: {
          'PRIVATE-TOKEN': connection.token,
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
    // GitLab store auto-initializes
  }, []);

  // Prepare stats for display
  const stats = useMemo(() => {
    if (!connection.stats) {
      return [];
    }

    return [
      {
        label: 'Total Projects',
        value: connection.stats.projects?.length || 0,
        icon: 'i-ph:folder',
      },
      {
        label: 'Public Projects',
        value: connection.stats.publicProjects || 0,
        icon: 'i-ph:globe',
      },
      {
        label: 'Private Projects',
        value: connection.stats.privateProjects || 0,
        icon: 'i-ph:lock',
      },
    ];
  }, [connection.stats]);

  // Prepare projects for resource list
  const projectResources = useMemo(() => {
    if (!connection.stats?.projects) {
      return [];
    }

    return connection.stats.projects.map((project: any) => ({
      id: project.id.toString(),
      name: project.name,
      description: project.description || 'No description',
      status: project.archived ? 'archived' : project.visibility,
      statusVariant: (project.archived ? 'default' : project.visibility === 'public' ? 'success' : 'warning') as
        'default' | 'success' | 'warning',
      url: project.web_url,
      updatedAt: project.last_activity_at,
      metadata: project,
    }));
  }, [connection.stats?.projects]);

  // Define actions for projects
  const projectActions = useMemo(
    () => [
      {
        name: 'View Project',
        icon: 'i-ph:eye',
        permissionId: 'view_project',
        action: async (resource: (typeof projectResources)[0]) => {
          window.open(resource.url, '_blank');
        },
      },
      {
        name: 'View Issues',
        icon: 'i-ph:list-bullets',
        permissionId: 'view_issues',
        action: async (resource: (typeof projectResources)[0]) => {
          window.open(`${resource.url}/-/issues`, '_blank');
        },
      },
      {
        name: 'View Merge Requests',
        icon: 'i-ph:git-merge',
        permissionId: 'view_mrs',
        action: async (resource: (typeof projectResources)[0]) => {
          window.open(`${resource.url}/-/merge_requests`, '_blank');
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
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">GitLab Integration</h2>
        </div>
        <div className="flex items-center gap-2">
          <GitLabLogo />
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary">
        Connect your GitLab account to access projects and manage your repositories directly from bolt.diy
      </p>

      {/* Connection Card */}
      <ServiceConnectionCard
        serviceName="GitLab"
        serviceIcon={<GitLabLogo />}
        user={
          connection.user
            ? {
                name: connection.user.name,
                username: connection.user.username,
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
        tokenPlaceholder="Enter your GitLab Personal Access Token"
        description="Generate a token from your GitLab account settings"
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

      {/* Projects List */}
      {connection.user && projectResources.length > 0 && (
        <ServiceResourceList
          title="Projects"
          resources={projectResources}
          actions={projectActions}
          isExpanded={isProjectsExpanded}
          onToggle={() => setIsProjectsExpanded(!isProjectsExpanded)}
          emptyMessage="No projects found"
          permissionEnabled={() => true}
        />
      )}

      {/* Empty State */}
      {connection.user && (!connection.stats || projectResources.length === 0) && !isLoadingStats && (
        <div className="text-center py-12">
          <div className="i-ph:folder-open w-12 h-12 mx-auto mb-4 text-bolt-elements-textTertiary" />
          <p className="text-bolt-elements-textSecondary">No projects found in your GitLab account</p>
          <Button variant="secondary" onClick={handleRefreshStats} className="mt-4">
            Refresh Stats
          </Button>
        </div>
      )}
    </div>
  );
}
