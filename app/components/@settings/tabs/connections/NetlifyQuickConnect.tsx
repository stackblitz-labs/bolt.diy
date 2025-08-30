import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { updateNetlifyConnection } from '~/lib/stores/netlify';
import { classNames } from '~/utils/classNames';

interface NetlifyQuickConnectProps {
  onSuccess?: () => void;
  showInstructions?: boolean;
}

export const NetlifyQuickConnect: React.FC<NetlifyQuickConnectProps> = ({ onSuccess, showInstructions = true }) => {
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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

      // Fetch initial site statistics
      const sitesResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let sites: any[] = [];

      if (sitesResponse.ok) {
        sites = (await sitesResponse.json()) as any[];
      }

      // Update the connection store
      updateNetlifyConnection({
        user: userData,
        token,
        stats: {
          sites,
          totalSites: sites.length,
          deploys: [],
          builds: [],
          lastDeployTime: '',
        },
      });

      toast.success(`Connected to Netlify as ${userData.email || userData.name || 'User'}`);
      setToken(''); // Clear the token field

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Netlify connection error:', error);
      toast.error('Failed to connect to Netlify. Please check your token.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-bolt-elements-textPrimary">Personal Access Token</label>
            {showInstructions && (
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="text-xs text-accent-500 hover:text-accent-600 flex items-center gap-1"
              >
                <span className={classNames('i-ph:question-circle', showHelp ? 'text-accent-600' : '')} />
                How to get token
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && token.trim() && !isConnecting) {
                  handleConnect();
                }
              }}
              placeholder="Enter your Netlify API token"
              className={classNames(
                'w-full px-3 py-2 pr-10 rounded-lg text-sm',
                'bg-bolt-elements-background-depth-1',
                'border border-bolt-elements-borderColor',
                'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent',
                'disabled:opacity-50',
              )}
              disabled={isConnecting}
            />
            {token && (
              <button
                onClick={() => setToken('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary"
              >
                <span className="i-ph:x text-lg" />
              </button>
            )}
          </div>
        </div>

        {showHelp && showInstructions && (
          <div className="bg-bolt-elements-background-depth-2 rounded-lg p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-2">
            <div className="flex items-start gap-2">
              <span className="i-ph:info text-accent-500 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-bolt-elements-textPrimary">
                  Getting your Netlify Personal Access Token:
                </p>
                <ol className="space-y-2 text-bolt-elements-textSecondary">
                  <li className="flex items-start gap-2">
                    <span className="text-accent-500 font-medium">1.</span>
                    <span>
                      Go to{' '}
                      <a
                        href="https://app.netlify.com/user/applications#personal-access-tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-500 hover:text-accent-600 underline inline-flex items-center gap-1"
                      >
                        Netlify Account Settings
                        <span className="i-ph:arrow-square-out text-xs" />
                      </a>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-500 font-medium">2.</span>
                    <span>Navigate to "Applications" → "Personal access tokens"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-500 font-medium">3.</span>
                    <span>Click "New access token"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-500 font-medium">4.</span>
                    <span>Give it a descriptive name (e.g., "bolt.diy deployment")</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-500 font-medium">5.</span>
                    <span>Copy the token and paste it above</span>
                  </li>
                </ol>
                <div className="pt-2 border-t border-bolt-elements-borderColor">
                  <p className="text-xs text-bolt-elements-textTertiary">
                    <strong>Note:</strong> Keep your token safe! It provides full access to your Netlify account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <a
            href="https://app.netlify.com/user/applications#personal-access-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-all text-sm font-medium flex items-center gap-2"
          >
            <span className="i-ph:arrow-square-out" />
            Get Token
          </a>
          <button
            onClick={handleConnect}
            disabled={isConnecting || !token.trim()}
            className={classNames(
              'flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm',
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
                Connect to Netlify
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-3 bg-accent-500/10 border border-accent-500/20 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="i-ph:lightning text-accent-500 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-bolt-elements-textPrimary">Quick Tip</p>
            <p className="text-xs text-bolt-elements-textSecondary">
              Once connected, you can deploy any project with a single click directly from the editor!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
