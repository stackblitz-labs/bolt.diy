import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { ServiceConnectionCard } from '~/components/@settings/shared/ServiceConnectionCard';
import { ServiceResourceList } from '~/components/@settings/shared/ServiceResourceList';
import { ServiceStatsPanel } from '~/components/@settings/shared/ServiceStatsPanel';
import { Badge } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import {
  supabaseConnection,
  updateSupabaseConnection,
  initializeSupabaseConnection,
  isConnecting as supabaseConnecting,
  isFetchingStats,
  fetchSupabaseStats,
  fetchProjectApiKeys,
  type SupabaseProject,
} from '~/lib/stores/supabase';

// Supabase logo SVG component
const SupabaseLogo = () => (
  <svg viewBox="0 0 109 113" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
    />
    <path
      fillOpacity="0.2"
      fill="currentColor"
      d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
    />
    <path
      fill="currentColor"
      d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z"
    />
  </svg>
);

export default function SupabaseTab() {
  const connection = useStore(supabaseConnection);
  const isConnecting = useStore(supabaseConnecting);
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
      toast.error('Please provide a valid Supabase token');
      return;
    }

    try {
      // Fetch user and stats via API
      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenInput }),
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status}`);
      }

      const data = (await response.json()) as any;

      // Update connection
      updateSupabaseConnection({
        user: data.user,
        token: tokenInput,
        stats: data.stats,
      });

      toast.success(`Connected to Supabase as ${data.user.email}`);
      setTokenInput(''); // Clear input after successful connection
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Supabase';
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    updateSupabaseConnection({
      user: null,
      token: '',
      stats: undefined,
      selectedProjectId: '',
      project: undefined,
      credentials: undefined,
    });

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase_connection');
      localStorage.removeItem('supabaseCredentials');
    }

    toast.success('Disconnected from Supabase');
  };

  const handleRefreshStats = async (): Promise<void> => {
    if (!connection.token) {
      throw new Error('No connection available');
    }

    await fetchSupabaseStats(connection.token);
    toast.success('Supabase stats refreshed');
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
      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: connection.token }),
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

  const handleProjectSelect = async (projectId: string) => {
    if (!connection.token) {
      toast.error('Not connected to Supabase');
      return;
    }

    try {
      // Fetch API keys for the project
      const result = await fetchProjectApiKeys(projectId, connection.token);

      if (result) {
        updateSupabaseConnection({
          selectedProjectId: projectId,
          credentials: {
            anonKey: result.anonKey,
            supabaseUrl: result.supabaseUrl,
          },
        });
        toast.success('Project credentials fetched successfully');
      }
    } catch {
      toast.error('Failed to fetch project credentials');
    }
  };

  // Initialize on mount
  useEffect(() => {
    initializeSupabaseConnection();
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
        icon: 'i-ph:database',
      },
      {
        label: 'Selected Project',
        value: connection.selectedProjectId ? '1' : '0',
        icon: 'i-ph:check-circle',
      },
    ];
  }, [connection.stats, connection.selectedProjectId]);

  // Prepare projects for resource list
  const projectResources = useMemo(() => {
    if (!connection.stats?.projects) {
      return [];
    }

    return connection.stats.projects.map((project: SupabaseProject) => ({
      id: project.id,
      name: project.name,
      description: `Region: ${project.region} • Status: ${project.status}`,
      status: project.status,
      statusVariant: (project.status === 'active' ? 'success' : 'default') as 'default' | 'success',
      updatedAt: project.created_at,
      metadata: project,
    }));
  }, [connection.stats?.projects]);

  // Define actions for projects
  const projectActions = useMemo(
    () => [
      {
        name: 'Select Project',
        icon: 'i-ph:check-circle',
        permissionId: 'select_project',
        action: async (resource: (typeof projectResources)[0]) => {
          await handleProjectSelect(resource.id);
        },
      },
      {
        name: 'View Dashboard',
        icon: 'i-ph:eye',
        permissionId: 'view_dashboard',
        action: async (resource: (typeof projectResources)[0]) => {
          window.open(`https://supabase.com/dashboard/project/${resource.id}`, '_blank');
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
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Supabase Integration</h2>
        </div>
        <div className="flex items-center gap-2">
          <SupabaseLogo />
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary">
        Connect your Supabase account to manage your projects and databases directly from bolt.diy
      </p>

      {/* Connection Card */}
      <ServiceConnectionCard
        serviceName="Supabase"
        serviceIcon={<SupabaseLogo />}
        user={
          connection.user
            ? {
                email: connection.user.email,
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
        tokenPlaceholder="Enter your Supabase Access Token"
        description="Generate a token from your Supabase account settings"
      />

      {/* Selected Project Credentials */}
      {connection.user && connection.credentials && connection.selectedProjectId && (
        <div className="border border-bolt-elements-borderColor rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-bolt-elements-textPrimary">Project Credentials</h3>
            <Badge variant="success">Connected</Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <label className="text-bolt-elements-textSecondary">Project ID:</label>
              <p className="text-bolt-elements-textPrimary font-mono">{connection.selectedProjectId}</p>
            </div>
            {connection.credentials.supabaseUrl && (
              <div>
                <label className="text-bolt-elements-textSecondary">Supabase URL:</label>
                <p className="text-bolt-elements-textPrimary font-mono text-xs break-all">
                  {connection.credentials.supabaseUrl}
                </p>
              </div>
            )}
            {connection.credentials.anonKey && (
              <div>
                <label className="text-bolt-elements-textSecondary">Anon Key:</label>
                <p className="text-bolt-elements-textPrimary font-mono text-xs break-all">
                  {connection.credentials.anonKey.substring(0, 20)}...
                </p>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateSupabaseConnection({
                selectedProjectId: '',
                credentials: undefined,
              });
              toast.success('Project deselected');
            }}
          >
            Deselect Project
          </Button>
        </div>
      )}

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
          <div className="i-ph:database w-12 h-12 mx-auto mb-4 text-bolt-elements-textTertiary" />
          <p className="text-bolt-elements-textSecondary">No projects found in your Supabase account</p>
          <Button variant="secondary" onClick={handleRefreshStats} className="mt-4">
            Refresh Stats
          </Button>
        </div>
      )}
    </div>
  );
}
