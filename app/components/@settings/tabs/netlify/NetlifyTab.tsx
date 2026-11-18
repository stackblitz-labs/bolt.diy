import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { ServiceConnectionCard } from '~/components/@settings/shared/ServiceConnectionCard';
import { ServiceResourceList } from '~/components/@settings/shared/ServiceResourceList';
import { ServiceStatsPanel } from '~/components/@settings/shared/ServiceStatsPanel';
import { Button } from '~/components/ui/Button';
import {
  netlifyConnection,
  updateNetlifyConnection,
  initializeNetlifyConnection,
  isConnecting as netlifyConnecting,
  isFetchingStats,
  fetchNetlifyStatsViaAPI,
} from '~/lib/stores/netlify';
import type { NetlifySite, NetlifyUser } from '~/types/netlify';

// Netlify logo SVG component
const NetlifyLogo = () => (
  <svg viewBox="0 0 40 40" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M28.589 14.135l-.014-.006c-.008-.003-.016-.006-.023-.013a.11.11 0 0 1-.028-.093l.773-4.726 3.625 3.626-3.77 1.604a.083.083 0 0 1-.033.006h-.015c-.005-.003-.01-.007-.02-.017a1.716 1.716 0 0 0-.495-.381zm5.258-.288l3.876 3.876c.805.806 1.208 1.208 1.674 1.355a2 2 0 0 1 1.206 0c.466-.148.869-.55 1.674-1.356L8.73 28.73l2.349-3.643c.011-.018.022-.034.04-.047.025-.018.061-.01.091 0a2.434 2.434 0 0 0 1.638-.083c.027-.01.054-.017.075.002a.19.19 0 0 1 .028.032L21.95 38.05zM7.863 27.863L5.8 25.8l4.074-1.738a.084.084 0 0 1 .033-.007c.034 0 .054.034.072.065a2.91 2.91 0 0 0 .13.184l.013.016c.012.017.004.034-.008.05l-2.25 3.493zm-2.976-2.976l-2.61-2.61c-.444-.444-.766-.766-.99-1.043l7.936 1.646a.84.84 0 0 0 .03.005c.049.008.103.017.103.063 0 .05-.059.073-.109.092l-.023.01-4.337 1.837zM.831 19.892a2 2 0 0 1 .09-.495c.148-.466.55-.868 1.356-1.674l3.34-3.34a2175.525 2175.525 0 0 0 4.626 6.687c.027.036.057.076.026.106-.146.161-.292.337-.395.528a.16.16 0 0 1-.05.062c-.013.008-.027.005-.042.002H9.78L.831 19.892zm5.68-6.403l4.491-4.491c.422.185 1.958.834 3.332 1.414 1.04.44 1.988.84 2.286.97.03.012.057.024.07.054.008.018.004.041 0 .06a2.003 2.003 0 0 0 .523 1.828c.03.03 0 .073-.026.11l-.014.021-4.56 7.063c-.012.02-.023.037-.043.05-.024.015-.058.008-.086.001a2.274 2.274 0 0 0-.543-.074c-.164 0-.342.03-.522.063h-.001c-.02.003-.038.007-.054-.005a.21.21 0 0 1-.045-.051l-4.808-7.013zm5.398-5.398l5.814-5.814c.805-.805 1.208-1.208 1.674-1.355a2 2 0 0 1 1.206 0c.466.147.869.55 1.674 1.355l1.26 1.26-4.135 6.404a.155.155 0 0 1-.041.048c-.025.017-.06.01-.09 0a2.097 2.097 0 0 0-1.92.37c-.027.028-.067.012-.101-.003-.54-.235-4.74-2.01-5.341-2.265zm12.506-3.676l3.818 3.818-.92 5.698v.015a.135.135 0 0 1-.008.038c-.01.02-.03.024-.05.03a1.83 1.83 0 0 0-.548.273.154.154 0 0 0-.02.017c-.011.012-.022.023-.04.025a.114.114 0 0 1-.043-.007l-5.818-2.472-.011-.005c-.037-.015-.081-.033-.081-.071a2.198 2.198 0 0 0-.31-.915c-.028-.046-.059-.094-.035-.141l4.066-6.303zm-3.932 8.606l5.454 2.31c.03.014.063.027.076.058a.106.106 0 0 1 0 .057c-.016.08-.03.171-.03.263v.153c0 .038-.039.054-.075.069l-.011.004c-.864.369-12.13 5.173-12.147 5.173-.017 0-.035 0-.052-.017-.03-.03 0-.072.027-.11a.76.76 0 0 0 .014-.02l4.482-6.94.008-.012c.026-.042.056-.089.104-.089l.045.007c.102.014.192.027.283.027.68 0 1.31-.331 1.69-.897a.16.16 0 0 1 .034-.04c.027-.02.067-.01.098.004zm-6.246 9.185l12.28-5.237s.018 0 .035.017c.067.067.124.112.179.154l.027.017c.025.014.05.03.052.056 0 .01 0 .016-.002.025L25.756 23.7l-.004.026c-.007.05-.014.107-.061.107a1.729 1.729 0 0 0-1.373.847l-.005.008c-.014.023-.027.045-.05.057-.021.01-.048.006-.07.001l-9.793-2.02c-.01-.002-.152-.519-.163-.52z"
    />
  </svg>
);

export default function NetlifyTab() {
  const connection = useStore(netlifyConnection);
  const isConnecting = useStore(netlifyConnecting);
  const isLoadingStats = useStore(isFetchingStats);

  // Local state for UI
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);
  const [isSitesExpanded, setIsSitesExpanded] = useState(true);
  const [tokenInput, setTokenInput] = useState('');

  const [connectionTest, setConnectionTest] = useState<{
    status: 'success' | 'error' | 'testing';
    message: string;
    timestamp?: number;
  } | null>(null);

  // Service-specific connection logic
  const handleConnect = async (): Promise<void> => {
    if (!tokenInput.trim()) {
      toast.error('Please provide a valid Netlify token');
      return;
    }

    try {
      // Test connection
      const response = await fetch('https://api.netlify.com/api/v1/user', {
        headers: {
          Authorization: `Bearer ${tokenInput}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }

      const userData = (await response.json()) as NetlifyUser;

      // Update connection
      updateNetlifyConnection({
        user: userData,
        token: tokenInput,
      });

      // Fetch stats
      await fetchNetlifyStatsViaAPI(tokenInput);

      toast.success(`Connected to Netlify as ${userData.email}`);
      setTokenInput(''); // Clear input after successful connection
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Netlify';
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    updateNetlifyConnection({
      user: null,
      token: '',
      stats: undefined,
    });

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('netlify_connection');
    }

    toast.success('Disconnected from Netlify');
  };

  const handleRefreshStats = async (): Promise<void> => {
    if (!connection.token) {
      throw new Error('No connection available');
    }

    await fetchNetlifyStatsViaAPI(connection.token);
    toast.success('Netlify stats refreshed');
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
      const response = await fetch('https://api.netlify.com/api/v1/user', {
        headers: {
          Authorization: `Bearer ${connection.token}`,
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
    initializeNetlifyConnection();
  }, []);

  // Prepare stats for display
  const stats = useMemo(() => {
    if (!connection.stats) {
      return [];
    }

    return [
      {
        label: 'Total Sites',
        value: connection.stats.totalSites || 0,
        icon: 'i-ph:globe',
      },
      {
        label: 'Total Deploys',
        value: connection.stats.totalDeploys || 0,
        icon: 'i-ph:rocket-launch',
      },
      {
        label: 'Active Builds',
        value: connection.stats.totalBuilds || 0,
        icon: 'i-ph:hammer',
      },
    ];
  }, [connection.stats]);

  // Prepare sites for resource list
  const siteResources = useMemo(() => {
    if (!connection.stats?.sites) {
      return [];
    }

    return connection.stats.sites.map((site) => ({
      id: site.id,
      name: site.name,
      description: site.custom_domain || site.ssl_url || site.url,
      status: site.published_deploy?.state || site.state || 'unknown',
      statusVariant: (site.published_deploy?.state === 'ready' ? 'success' : 'default') as
        'default' | 'success' | 'warning' | 'danger',
      url: site.admin_url,
      updatedAt: site.updated_at,
      metadata: site,
    }));
  }, [connection.stats?.sites]);

  // Define actions for sites
  const siteActions = useMemo(
    () => [
      {
        name: 'View Site',
        icon: 'i-ph:eye',
        permissionId: 'view_site',
        action: async (resource: (typeof siteResources)[0]) => {
          window.open(resource.url, '_blank');
        },
      },
      {
        name: 'View Live Site',
        icon: 'i-ph:globe',
        permissionId: 'view_live_site',
        action: async (resource: (typeof siteResources)[0]) => {
          const site = resource.metadata as NetlifySite;
          window.open(site.ssl_url || site.url, '_blank');
        },
      },
      {
        name: 'Trigger Deploy',
        icon: 'i-ph:rocket-launch',
        permissionId: 'trigger_deploy',
        action: async (resource: (typeof siteResources)[0]) => {
          if (!connection.token) {
            throw new Error('Not connected to Netlify');
          }

          const response = await fetch(`https://api.netlify.com/api/v1/sites/${resource.id}/builds`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${connection.token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to trigger deploy');
          }

          toast.success(`Deploy triggered for ${resource.name}`);
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
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Netlify Integration</h2>
        </div>
        <div className="flex items-center gap-2">
          <NetlifyLogo />
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary">
        Connect your Netlify account to deploy and manage your sites directly from bolt.diy
      </p>

      {/* Connection Card */}
      <ServiceConnectionCard
        serviceName="Netlify"
        serviceIcon={<NetlifyLogo />}
        user={
          connection.user
            ? {
                name: connection.user.full_name,
                email: connection.user.email,
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
        tokenPlaceholder="Enter your Netlify Personal Access Token"
        description="Generate a token from your Netlify account settings"
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

      {/* Sites List */}
      {connection.user && siteResources.length > 0 && (
        <ServiceResourceList
          title="Sites"
          resources={siteResources}
          actions={siteActions}
          isExpanded={isSitesExpanded}
          onToggle={() => setIsSitesExpanded(!isSitesExpanded)}
          emptyMessage="No sites found"
          permissionEnabled={() => true}
        />
      )}

      {/* Empty State */}
      {connection.user && (!connection.stats || siteResources.length === 0) && !isLoadingStats && (
        <div className="text-center py-12">
          <div className="i-ph:globe w-12 h-12 mx-auto mb-4 text-bolt-elements-textTertiary" />
          <p className="text-bolt-elements-textSecondary">No sites found in your Netlify account</p>
          <Button variant="secondary" onClick={handleRefreshStats} className="mt-4">
            Refresh Stats
          </Button>
        </div>
      )}
    </div>
  );
}
