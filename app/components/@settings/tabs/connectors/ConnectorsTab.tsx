import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import BrowserUseCloudTab from '~/components/@settings/tabs/connectors/BrowserUseCloudTab';
import GitHubTab from '~/components/@settings/tabs/github/GitHubTab';
import GitLabTab from '~/components/@settings/tabs/gitlab/GitLabTab';
import NetlifyTab from '~/components/@settings/tabs/netlify/NetlifyTab';
import SupabaseTab from '~/components/@settings/tabs/supabase/SupabaseTab';
import VercelTab from '~/components/@settings/tabs/vercel/VercelTab';
import { Dialog, DialogDescription, DialogRoot, DialogTitle, DialogButton } from '~/components/ui/Dialog';
import { Switch } from '~/components/ui/Switch';
import { activateConnector, type ConnectorActivationId } from '~/lib/services/connectorActivation';
import { useMCPStore, type ConnectorId } from '~/lib/stores/mcp';
import { classNames } from '~/utils/classNames';

type ConnectorType = 'github' | 'gitlab' | 'vercel' | 'netlify' | 'supabase' | 'browser-use-cloud';

interface Connector {
  id: ConnectorType;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'source-control' | 'deployment' | 'database' | 'browser-automation';
}

// GitHub icon
const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
    />
  </svg>
);

// GitLab icon
const GitLabIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"
    />
  </svg>
);

// Vercel icon
const VercelIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="currentColor" d="m12 2 10 18H2z" />
  </svg>
);

// Netlify icon
const NetlifyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M16.934 8.519a1.044 1.044 0 0 1 .303-.23l2.349-1.045a.983.983 0 0 1 .905 0c.264.12.49.328.651.599l.518 1.065c.17.35.17.761 0 1.11l-.518 1.065a1.119 1.119 0 0 1-.651.599l-2.35 1.045a1.013 1.013 0 0 1-.904 0l-2.35-1.045a1.119 1.119 0 0 1-.651-.599L13.718 9.02a1.2 1.2 0 0 1 0-1.11l.518-1.065a1.119 1.119 0 0 1 .651-.599l2.35-1.045a.983.983 0 0 1 .697-.061zm-6.051 5.751a1.044 1.044 0 0 1 .303-.23l2.349-1.045a.983.983 0 0 1 .905 0c.264.12.49.328.651.599l.518 1.065c.17.35.17.761 0 1.11l-.518 1.065a1.119 1.119 0 0 1-.651.599l-2.35 1.045a1.013 1.013 0 0 1-.904 0l-2.35-1.045a1.119 1.119 0 0 1-.651-.599l-.518-1.065a1.2 1.2 0 0 1 0-1.11l.518-1.065a1.119 1.119 0 0 1 .651-.599l2.35-1.045a.983.983 0 0 1 .697-.061z"
    />
  </svg>
);

// Supabase icon
const SupabaseIcon = () => (
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

const CONNECTORS: Connector[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect your GitHub account for repository management and version control',
    icon: <GitHubIcon />,
    category: 'source-control',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Integrate with GitLab for code hosting and CI/CD pipelines',
    icon: <GitLabIcon />,
    category: 'source-control',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy and manage your projects on Vercel platform',
    icon: <VercelIcon />,
    category: 'deployment',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Deploy and manage your sites on Netlify',
    icon: <NetlifyIcon />,
    category: 'deployment',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Connect to Supabase for database, auth, and storage',
    icon: <SupabaseIcon />,
    category: 'database',
  },
  {
    id: 'browser-use-cloud',
    name: 'Browser Use Cloud',
    description: 'Run hosted browser tasks and inspect websites from your chat',
    icon: <div className="i-ph:globe-hemisphere-west w-5 h-5" />,
    category: 'browser-automation',
  },
];

const CATEGORY_LABELS = {
  'source-control': 'Source Control',
  deployment: 'Deployment',
  database: 'Database & Backend',
  'browser-automation': 'Browser Automation',
};

export default function ConnectorsTab() {
  const [selectedConnector, setSelectedConnector] = useState<ConnectorType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [credentialConnector, setCredentialConnector] = useState<Connector | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [credentialError, setCredentialError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const connectorEnabled = useMCPStore((state) => state.settings.connectorEnabled);
  const isInitialized = useMCPStore((state) => state.isInitialized);
  const initialize = useMCPStore((state) => state.initialize);
  const setConnectorEnabled = useMCPStore((state) => state.setConnectorEnabled);

  useEffect(() => {
    if (!isInitialized) {
      void initialize();
    }
  }, [initialize, isInitialized]);

  const getActivationId = (connector: Connector): ConnectorActivationId =>
    connector.id === 'browser-use-cloud' ? 'browserUseCloud' : connector.id;

  const getSettingsId = (connector: Connector): ConnectorId =>
    connector.id === 'browser-use-cloud' ? 'browserUseCloud' : connector.id;

  const handleConnectorToggle = async (connector: Connector, enabled: boolean) => {
    const settingsId = getSettingsId(connector);

    if (!enabled) {
      setConnectorEnabled(settingsId, false);
      toast.info(`${connector.name} is off.`);

      return;
    }

    setIsActivating(true);

    try {
      await activateConnector(getActivationId(connector));
      setConnectorEnabled(settingsId, true);
      toast.success(`${connector.name} is on. You can configure it here or open its configure page.`);
    } catch (error) {
      setCredentialConnector(connector);
      setApiKey('');
      setCredentialError(error instanceof Error ? error.message : 'Enter a valid API key to enable this connector.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleCredentialSubmit = async () => {
    if (!credentialConnector) {
      return;
    }

    setIsActivating(true);
    setCredentialError('');

    try {
      await activateConnector(getActivationId(credentialConnector), apiKey);
      setConnectorEnabled(getSettingsId(credentialConnector), true);
      toast.success(`${credentialConnector.name} is on. You can now configure it on its connector page.`);
      setCredentialConnector(null);
      setApiKey('');
    } catch (error) {
      setCredentialError(
        error instanceof Error ? error.message : 'That API key could not be validated. The connector remains off.',
      );
    } finally {
      setIsActivating(false);
    }
  };

  const closeCredentialDialog = () => {
    if (!isActivating) {
      if (credentialConnector) {
        toast.info(`${credentialConnector.name} remains off until a valid API key is entered.`);
      }

      setCredentialConnector(null);
      setApiKey('');
      setCredentialError('');
    }
  };

  // Group connectors by category
  const connectorsByCategory = CONNECTORS.reduce(
    (acc, connector) => {
      if (!acc[connector.category]) {
        acc[connector.category] = [];
      }

      acc[connector.category].push(connector);

      return acc;
    },
    {} as Record<string, Connector[]>,
  );

  const handleBack = () => {
    setSelectedConnector(null);
  };

  const renderConnectorContent = () => {
    switch (selectedConnector) {
      case 'github':
        return <GitHubTab />;
      case 'gitlab':
        return <GitLabTab />;
      case 'vercel':
        return <VercelTab />;
      case 'netlify':
        return <NetlifyTab />;
      case 'supabase':
        return <SupabaseTab />;
      case 'browser-use-cloud':
        return <BrowserUseCloudTab />;
      default:
        return null;
    }
  };

  if (selectedConnector) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="flex appearance-none items-center gap-2 border-0 bg-transparent text-sm text-bolt-elements-textSecondary transition-colors hover:text-bolt-elements-textPrimary"
        >
          <div className="i-ph:arrow-left w-4 h-4" />
          Back to Connectors
        </button>
        {renderConnectorContent()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="i-ph:plug w-6 h-6 text-bolt-elements-item-contentAccent" />
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Connectors</h2>
        </div>
        <p className="text-sm text-bolt-elements-textSecondary">
          Connect and manage your development tools and services in one place
        </p>
      </motion.div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={classNames(
            'appearance-none rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
            selectedCategory === null
              ? 'border-bolt-elements-borderColorActive bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
              : 'border-bolt-elements-borderColor bg-transparent text-bolt-elements-textSecondary hover:border-bolt-elements-borderColorActive hover:text-bolt-elements-textPrimary',
          )}
        >
          All
        </button>
        {Object.keys(connectorsByCategory).map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={classNames(
              'appearance-none rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              selectedCategory === category
                ? 'border-bolt-elements-borderColorActive bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                : 'border-bolt-elements-borderColor bg-transparent text-bolt-elements-textSecondary hover:border-bolt-elements-borderColorActive hover:text-bolt-elements-textPrimary',
            )}
          >
            {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
          </button>
        ))}
      </div>

      {/* Connectors Grid */}
      <div className="space-y-8">
        {Object.entries(connectorsByCategory).map(([category, connectors]) => {
          // Filter by selected category if one is selected
          if (selectedCategory && category !== selectedCategory) {
            return null;
          }

          return (
            <div key={category} className="space-y-4">
              {!selectedCategory && (
                <h3 className="text-sm font-medium text-bolt-elements-textPrimary">
                  {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                </h3>
              )}
              <div className="space-y-3">
                {connectors.map((connector, index) => (
                  <motion.div
                    key={connector.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group flex w-full items-center gap-4 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-5 py-4 text-left text-bolt-elements-textPrimary transition-colors hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-3"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary">
                      {connector.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">{connector.name}</h4>
                        <span className="rounded-full bg-bolt-elements-background-depth-3 px-2 py-0.5 text-[11px] text-bolt-elements-textSecondary">
                          {CATEGORY_LABELS[connector.category]}
                        </span>
                      </div>
                      <p className="text-sm text-bolt-elements-textSecondary">{connector.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-bolt-elements-textSecondary">
                          {connectorEnabled[getSettingsId(connector)] ? 'On' : 'Off'}
                        </span>
                        <Switch
                          checked={connectorEnabled[getSettingsId(connector)]}
                          disabled={!isInitialized || isActivating}
                          aria-label={`${connectorEnabled[getSettingsId(connector)] ? 'Turn off' : 'Turn on'} ${connector.name}`}
                          onCheckedChange={(enabled) => void handleConnectorToggle(connector, enabled)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedConnector(connector.id)}
                        className="flex items-center gap-2 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 px-3 py-1.5 text-sm font-medium text-bolt-elements-textSecondary transition-colors hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-1 hover:text-bolt-elements-textPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
                      >
                        Configure <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <DialogRoot open={!!credentialConnector} onOpenChange={(open) => !open && closeCredentialDialog()}>
        {credentialConnector && (
          <Dialog className="max-w-[min(520px,calc(100vw-2rem))] p-6" showCloseButton onClose={closeCredentialDialog}>
            <DialogTitle>Enable {credentialConnector.name}</DialogTitle>
            <DialogDescription>
              Enter a valid API key to turn this connector on. If validation fails, it stays off. After it is enabled,
              use the Configure page for its remaining settings.
            </DialogDescription>
            <label className="mt-5 block text-sm font-medium" htmlFor="connector-api-key">
              {credentialConnector.name} API key
            </label>
            <input
              id="connector-api-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Paste your API key"
              className="mt-2 w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-borderColorActive"
            />
            {credentialError && (
              <p role="alert" className="mt-2 text-sm text-bolt-elements-icon-error">
                {credentialError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <DialogButton type="secondary" onClick={closeCredentialDialog} disabled={isActivating}>
                Cancel
              </DialogButton>
              <DialogButton type="primary" onClick={() => void handleCredentialSubmit()} disabled={isActivating}>
                {isActivating ? 'Checking…' : 'Validate and turn on'}
              </DialogButton>
            </div>
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}
