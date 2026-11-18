import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { ServiceConnectionCard } from '~/components/@settings/shared/ServiceConnectionCard';
import { ServiceResourceList } from '~/components/@settings/shared/ServiceResourceList';
import { ServiceStatsPanel } from '~/components/@settings/shared/ServiceStatsPanel';
import { Button } from '~/components/ui/Button';
import {
  vercelConnection,
  updateVercelConnection,
  initializeVercelConnection,
  isConnecting as vercelConnecting,
  isFetchingStats,
  fetchVercelStatsViaAPI,
} from '~/lib/stores/vercel';
import type { VercelUser, VercelProject } from '~/types/vercel';

// Vercel logo SVG component
const VercelLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="currentColor" d="m12 2 10 18H2z" />
  </svg>
);

export default function VercelTab() {
  const connection = useStore(vercelConnection);
  const isConnecting = useStore(vercelConnecting);
  const isLoadingStats = useStore(isFetchingStats);

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
      toast.error('Please provide a valid Vercel token');
      return;
    }

    try {
      // Test connection
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          Authorization: `Bearer ${tokenInput}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }

      const userData = (await response.json()) as any;

      // Normalize user data structure (Vercel API can return nested or flat user)
      const normalizedUser: VercelUser = userData.user || {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        name: userData.name,
        avatar: userData.avatar,
      };

      // Update connection
      updateVercelConnection({
        user: normalizedUser,
        token: tokenInput,
      });

      // Fetch stats
      await fetchVercelStatsViaAPI(tokenInput);

      toast.success(`Connected to Vercel as ${normalizedUser.username || normalizedUser.email}`);
      setTokenInput(''); // Clear input after successful connection
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Vercel';
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    updateVercelConnection({
      user: null,
      token: '',
      stats: undefined,
    });

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vercel_connection');
    }

    toast.success('Disconnected from Vercel');
  };

  const handleRefreshStats = async (): Promise<void> => {
    if (!connection.token) {
      throw new Error('No connection available');
    }

    await fetchVercelStatsViaAPI(connection.token);
    toast.success('Vercel stats refreshed');
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
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          Authorization: `Bearer ${connection.token}`,
          'Content-Type': 'application/json',
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
    initializeVercelConnection();
  }, []);

  // Prepare stats for display
  const stats = useMemo(() => {
    if (!connection.stats) {
      return [];
    }

    return [
      {
        label: 'Total Projects',
        value: connection.stats.totalProjects || 0,
        icon: 'i-ph:folder',
      },
      {
        label: 'Active Deployments',
        value:
          connection.stats.projects?.filter((p: VercelProject) => (p.latestDeployments?.length || 0) > 0).length || 0,
        icon: 'i-ph:rocket-launch',
      },
    ];
  }, [connection.stats]);

  // Prepare projects for resource list
  const projectResources = useMemo(() => {
    if (!connection.stats?.projects) {
      return [];
    }

    return connection.stats.projects.map((project: VercelProject) => {
      const latestDeploy = project.latestDeployments?.[0];
      return {
        id: project.id,
        name: project.name,
        description: project.framework || 'Vercel Project',
        status: latestDeploy?.state || 'unknown',
        statusVariant: (latestDeploy?.state === 'READY'
          ? 'success'
          : latestDeploy?.state === 'ERROR'
            ? 'danger'
            : 'default') as 'default' | 'success' | 'danger',
        url: latestDeploy?.url ? `https://${latestDeploy.url}` : undefined,
        updatedAt: project.createdAt ? new Date(project.createdAt).toISOString() : undefined,
        metadata: project,
      };
    });
  }, [connection.stats?.projects]);

  // Define actions for projects
  const projectActions = useMemo(
    () => [
      {
        name: 'View Project',
        icon: 'i-ph:eye',
        permissionId: 'view_project',
        action: async (resource: (typeof projectResources)[0]) => {
          window.open(`https://vercel.com/dashboard/${resource.name}`, '_blank');
        },
      },
      {
        name: 'View Live Site',
        icon: 'i-ph:globe',
        permissionId: 'view_live_site',
        action: async (resource: (typeof projectResources)[0]) => {
          if (resource.url) {
            window.open(resource.url, '_blank');
          } else {
            toast.error('No live site URL available');
          }
        },
      },
      {
        name: 'Trigger Deployment',
        icon: 'i-ph:rocket-launch',
        permissionId: 'trigger_deploy',
        action: async (resource: (typeof projectResources)[0]) => {
          if (!connection.token) {
            throw new Error('Not connected to Vercel');
          }

          const response = await fetch('https://api.vercel.com/v13/deployments', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${connection.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: resource.name,
              target: 'production',
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to trigger deployment');
          }

          toast.success(`Deployment triggered for ${resource.name}`);
          await handleRefreshStats();
        },
      },
    ],
    [connection.token],
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
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Vercel Integration</h2>
        </div>
        <div className="flex items-center gap-2">
          <VercelLogo />
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary">
        Connect your Vercel account to deploy and manage your projects directly from bolt.diy
      </p>

      {/* Connection Card */}
      <ServiceConnectionCard
        serviceName="Vercel"
        serviceIcon={<VercelLogo />}
        user={
          connection.user
            ? {
                name: connection.user.name,
                email: connection.user.email,
                username: connection.user.username,
                avatar: connection.user.avatar,
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
        tokenPlaceholder="Enter your Vercel Access Token"
        description="Generate a token from your Vercel account settings"
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
          <p className="text-bolt-elements-textSecondary">No projects found in your Vercel account</p>
          <Button variant="secondary" onClick={handleRefreshStats} className="mt-4">
            Refresh Stats
          </Button>
        </div>
      )}
    </div>
  );
}
