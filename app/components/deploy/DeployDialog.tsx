import React, { useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Dialog, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { useStore } from '@nanostores/react';
import { netlifyConnection, updateNetlifyConnection } from '~/lib/stores/netlify';
import { vercelConnection } from '~/lib/stores/vercel';
import { useNetlifyDeploy } from './NetlifyDeploy.client';
import { useVercelDeploy } from './VercelDeploy.client';
import { useGitHubDeploy } from './GitHubDeploy.client';
import { GitHubDeploymentDialog } from './GitHubDeploymentDialog';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';

interface DeployDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeployProvider {
  id: 'netlify' | 'vercel' | 'github' | 'cloudflare';
  name: string;
  iconClass: string;
  iconColor?: string;
  connected: boolean;
  comingSoon?: boolean;
  description: string;
  features: string[];
}

const NetlifyConnectForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!token.trim()) {
      toast.error('Please enter your Netlify API token');
      return;
    }

    setIsConnecting(true);

    try {
      // Validate token with Netlify API
      const response = await fetch('https://api.netlify.com/api/v1/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token or authentication failed');
      }

      const userData = (await response.json()) as any;

      // Update the connection store
      updateNetlifyConnection({
        user: userData,
        token,
      });

      toast.success(`Connected to Netlify as ${userData.email || userData.name || 'User'}`);
      onSuccess();
    } catch (error) {
      console.error('Netlify connection error:', error);
      toast.error('Failed to connect to Netlify. Please check your token.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-bolt-elements-borderColor scrollbar-track-transparent">
      <div>
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">Connect to Netlify</h3>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          To deploy your project to Netlify, you need to connect your account using a Personal Access Token.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-1">Personal Access Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your Netlify API token"
            className={classNames(
              'w-full px-3 py-2 rounded-lg text-sm',
              'bg-bolt-elements-background-depth-1',
              'border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
              'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent',
              'disabled:opacity-50',
            )}
            disabled={isConnecting}
          />
        </div>

        <div className="flex items-center justify-between">
          <a
            href="https://app.netlify.com/user/applications#personal-access-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-500 hover:text-accent-600 inline-flex items-center gap-1"
          >
            Get your token from Netlify
            <span className="i-ph:arrow-square-out text-xs" />
          </a>
        </div>

        <div className="bg-bolt-elements-background-depth-2 rounded-lg p-3 space-y-2">
          <p className="text-xs text-bolt-elements-textSecondary font-medium">How to get your token:</p>
          <ol className="text-xs text-bolt-elements-textSecondary space-y-1 list-decimal list-inside">
            <li>Go to your Netlify account settings</li>
            <li>Navigate to "Applications" → "Personal access tokens"</li>
            <li>Click "New access token"</li>
            <li>Give it a descriptive name (e.g., "bolt.diy deployment")</li>
            <li>Copy the token and paste it here</li>
          </ol>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConnect}
            disabled={isConnecting || !token.trim()}
            className={classNames(
              'flex-1 px-4 py-2 rounded-lg font-medium transition-all',
              'bg-accent-500 text-white',
              'hover:bg-accent-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2',
            )}
          >
            {isConnecting ? (
              <>
                <span className="i-svg-spinners:3-dots-scale" />
                Connecting...
              </>
            ) : (
              <>
                <span className="i-ph:plug-charging" />
                Connect Account
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const DeployDialog: React.FC<DeployDialogProps> = ({ isOpen, onClose }) => {
  const netlifyConn = useStore(netlifyConnection);
  const vercelConn = useStore(vercelConnection);
  const [selectedProvider, setSelectedProvider] = useState<'netlify' | 'vercel' | 'github' | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [githubFiles, setGithubFiles] = useState<Record<string, string> | null>(null);
  const [githubProjectName, setGithubProjectName] = useState('');
  const { handleNetlifyDeploy } = useNetlifyDeploy();
  const { handleVercelDeploy } = useVercelDeploy();
  const { handleGitHubDeploy } = useGitHubDeploy();

  const providers: DeployProvider[] = [
    {
      id: 'netlify',
      name: 'Netlify',
      iconClass: 'i-simple-icons:netlify',
      iconColor: 'text-[#00C7B7]',
      connected: !!netlifyConn.user,
      description: 'Deploy your site with automatic SSL, global CDN, and continuous deployment',
      features: [
        'Automatic SSL certificates',
        'Global CDN',
        'Instant rollbacks',
        'Deploy previews',
        'Form handling',
        'Serverless functions',
      ],
    },
    {
      id: 'vercel',
      name: 'Vercel',
      iconClass: 'i-simple-icons:vercel',
      connected: !!vercelConn.user,
      description: 'Deploy with the platform built for frontend developers',
      features: [
        'Zero-config deployments',
        'Edge Functions',
        'Analytics',
        'Web Vitals monitoring',
        'Preview deployments',
        'Automatic HTTPS',
      ],
    },
    {
      id: 'github',
      name: 'GitHub',
      iconClass: 'i-simple-icons:github',
      connected: true, // GitHub doesn't require separate auth
      description: 'Deploy to GitHub Pages or create a repository',
      features: [
        'Free hosting with GitHub Pages',
        'Version control integration',
        'Collaborative development',
        'Actions & Workflows',
        'Issue tracking',
        'Pull requests',
      ],
    },
    {
      id: 'cloudflare',
      name: 'Cloudflare Pages',
      iconClass: 'i-simple-icons:cloudflare',
      iconColor: 'text-[#F38020]',
      connected: false,
      comingSoon: true,
      description: "Deploy on Cloudflare's global network",
      features: [
        'Unlimited bandwidth',
        'DDoS protection',
        'Web Analytics',
        'Edge Workers',
        'Custom domains',
        'Automatic builds',
      ],
    },
  ];

  const handleDeploy = async (provider: 'netlify' | 'vercel' | 'github') => {
    setIsDeploying(true);

    try {
      let success = false;

      if (provider === 'netlify') {
        success = await handleNetlifyDeploy();
      } else if (provider === 'vercel') {
        success = await handleVercelDeploy();
      } else if (provider === 'github') {
        const result = await handleGitHubDeploy();

        if (result && typeof result === 'object' && result.success && result.files) {
          setGithubFiles(result.files);
          setGithubProjectName(result.projectName);
          setShowGitHubDialog(true);
          onClose();

          return;
        }

        success = result && typeof result === 'object' ? result.success : false;
      }

      if (success) {
        toast.success(
          `Successfully deployed to ${provider === 'netlify' ? 'Netlify' : provider === 'vercel' ? 'Vercel' : 'GitHub'}`,
        );
        onClose();
      }
    } catch (error) {
      console.error('Deployment error:', error);
      toast.error(
        `Failed to deploy to ${provider === 'netlify' ? 'Netlify' : provider === 'vercel' ? 'Vercel' : 'GitHub'}`,
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const renderProviderContent = () => {
    if (!selectedProvider) {
      return (
        <div className="grid gap-4">
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() =>
                !provider.comingSoon && setSelectedProvider(provider.id as 'netlify' | 'vercel' | 'github')
              }
              disabled={provider.comingSoon}
              className={classNames(
                'p-4 rounded-lg border-2 transition-all text-left',
                'hover:border-accent-500 hover:bg-bolt-elements-background-depth-2',
                provider.comingSoon
                  ? 'border-bolt-elements-borderColor opacity-50 cursor-not-allowed'
                  : 'border-bolt-elements-borderColor cursor-pointer',
              )}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-bolt-elements-background-depth-1 flex items-center justify-center flex-shrink-0">
                  <span
                    className={classNames(
                      provider.iconClass,
                      provider.iconColor || 'text-bolt-elements-textPrimary',
                      'text-2xl',
                    )}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-bolt-elements-textPrimary">{provider.name}</h3>
                    {provider.connected && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">Connected</span>
                    )}
                    {provider.comingSoon && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-bolt-elements-textSecondary mb-2">{provider.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {provider.features.slice(0, 3).map((feature, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-1 rounded bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary"
                      >
                        {feature}
                      </span>
                    ))}
                    {provider.features.length > 3 && (
                      <span className="text-xs px-2 py-1 text-bolt-elements-textTertiary">
                        +{provider.features.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      );
    }

    const provider = providers.find((p) => p.id === selectedProvider);

    if (!provider) {
      return null;
    }

    // If provider is not connected, show connection form
    if (!provider.connected) {
      if (selectedProvider === 'netlify') {
        return (
          <NetlifyConnectForm
            onSuccess={() => {
              handleDeploy('netlify');
            }}
          />
        );
      }

      // Add Vercel connection form here if needed
      return <div>Vercel connection form coming soon...</div>;
    }

    // If connected, show deployment confirmation
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-bolt-elements-background-depth-2 rounded-lg">
          <span
            className={classNames(
              provider.iconClass,
              provider.iconColor || 'text-bolt-elements-textPrimary',
              'text-3xl',
            )}
          />
          <div className="flex-1">
            <h3 className="font-semibold text-bolt-elements-textPrimary">{provider.name}</h3>
            <p className="text-sm text-bolt-elements-textSecondary">Ready to deploy to your {provider.name} account</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">Connected</span>
        </div>

        <div className="bg-bolt-elements-background-depth-2 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Deployment Features:</h4>
          <ul className="space-y-2">
            {provider.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-bolt-elements-textSecondary">
                <span className="i-ph:check-circle text-green-500 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setSelectedProvider(null)}
            className="px-4 py-2 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2"
          >
            Back
          </button>
          <button
            onClick={() => handleDeploy(selectedProvider as 'netlify' | 'vercel' | 'github')}
            disabled={isDeploying}
            className={classNames(
              'flex-1 px-4 py-2 rounded-lg font-medium transition-all',
              'bg-accent-500 text-white',
              'hover:bg-accent-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2',
            )}
          >
            {isDeploying ? (
              <>
                <span className="i-svg-spinners:3-dots-scale" />
                Deploying...
              </>
            ) : (
              <>
                <span className="i-ph:rocket-launch" />
                Deploy Now
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <RadixDialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog className="max-w-2xl max-h-[90vh] flex flex-col">
          <div className="p-6 flex flex-col max-h-[90vh]">
            <div className="flex-shrink-0">
              <DialogTitle className="text-xl font-bold mb-1">Deploy Your Project</DialogTitle>
              <DialogDescription className="mb-6">
                Choose a deployment platform to publish your project to the web
              </DialogDescription>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2 scrollbar-thin scrollbar-thumb-bolt-elements-borderColor scrollbar-track-transparent hover:scrollbar-thumb-bolt-elements-textTertiary">
              {renderProviderContent()}
            </div>

            {!selectedProvider && (
              <div className="flex-shrink-0 mt-6 pt-6 border-t border-bolt-elements-borderColor">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </Dialog>
      </RadixDialog.Root>

      {/* GitHub Deployment Dialog */}
      {showGitHubDialog && githubFiles && (
        <GitHubDeploymentDialog
          isOpen={showGitHubDialog}
          onClose={() => setShowGitHubDialog(false)}
          projectName={githubProjectName}
          files={githubFiles}
        />
      )}
    </>
  );
};
