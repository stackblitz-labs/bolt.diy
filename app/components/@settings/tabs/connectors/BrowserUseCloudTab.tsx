import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/Button';
import { Switch } from '~/components/ui/Switch';
import { useMCPStore } from '~/lib/stores/mcp';
import { classNames } from '~/utils/classNames';

const SERVER_NAME = 'browser-use-cloud';
const SERVER_URL = 'https://api.browser-use.com/v3/mcp';
const API_KEY_HEADER = 'X-Browser-Use-API-Key';

export default function BrowserUseCloudTab() {
  const settings = useMCPStore((state) => state.settings);
  const setToolEnabled = useMCPStore((state) => state.setToolEnabled);
  const isInitialized = useMCPStore((state) => state.isInitialized);
  const serverTools = useMCPStore((state) => state.serverTools);
  const isUpdatingConfig = useMCPStore((state) => state.isUpdatingConfig);
  const initialize = useMCPStore((state) => state.initialize);
  const updateSettings = useMCPStore((state) => state.updateSettings);
  const checkServersAvailabilities = useMCPStore((state) => state.checkServersAvailabilities);

  const configuredServer = settings.mcpConfig.mcpServers[SERVER_NAME];

  const storedApiKey = useMemo(() => {
    if (!configuredServer || !('headers' in configuredServer)) {
      return '';
    }

    return configuredServer.headers?.[API_KEY_HEADER] ?? '';
  }, [configuredServer]);

  const [apiKey, setApiKey] = useState(storedApiKey);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      initialize().catch((error) => toast.error(`Could not load connector settings: ${String(error)}`));
    }
  }, [initialize, isInitialized]);

  useEffect(() => setApiKey(storedApiKey), [storedApiKey]);

  const serverStatus = serverTools[SERVER_NAME];
  const connected = serverStatus?.status === 'available';

  const connect = async () => {
    const key = apiKey.trim();

    if (!key) {
      toast.error('Enter a Browser Use API key first.');
      return;
    }

    if (!key.startsWith('bu_')) {
      toast.error('Browser Use API keys start with “bu_”.');
      return;
    }

    const mcpConfig = {
      ...settings.mcpConfig,
      mcpServers: {
        ...settings.mcpConfig.mcpServers,
        [SERVER_NAME]: {
          type: 'streamable-http' as const,
          url: SERVER_URL,
          headers: { [API_KEY_HEADER]: key },
        },
      },
    };

    try {
      await updateSettings({ ...settings, mcpConfig });
      toast.success('Browser Use Cloud connected.');
    } catch (error) {
      toast.error(`Could not connect to Browser Use Cloud: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const disconnect = async () => {
    const { [SERVER_NAME]: _removed, ...mcpServers } = settings.mcpConfig.mcpServers;

    try {
      await updateSettings({ ...settings, mcpConfig: { ...settings.mcpConfig, mcpServers } });
      setApiKey('');
      toast.success('Browser Use Cloud disconnected.');
    } catch (error) {
      toast.error(`Could not disconnect Browser Use Cloud: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const checkConnection = async () => {
    setIsChecking(true);

    try {
      await checkServersAvailabilities();

      const latestStatus = useMCPStore.getState().serverTools[SERVER_NAME];

      if (latestStatus?.status === 'available') {
        toast.success(`Connected. ${Object.keys(latestStatus.tools).length} Browser Use tools are ready.`);
      } else {
        toast.error(
          latestStatus?.status === 'unavailable' ? latestStatus.error : 'Browser Use Cloud is not configured.',
        );
      }
    } catch (error) {
      toast.error(`Could not check Browser Use Cloud: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bolt-elements-background-depth-3 text-bolt-elements-item-contentAccent">
          <div className="i-ph:globe-hemisphere-west w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Browser Use Cloud</h2>
          <p className="mt-1 text-sm text-bolt-elements-textSecondary">
            Give Bolt hosted browser tools for visiting websites, interacting with pages, and reporting results.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Connection</h3>
          <span
            className={classNames(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              connected
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : serverStatus?.status === 'unavailable'
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary',
            )}
          >
            {connected ? 'Connected' : serverStatus?.status === 'unavailable' ? 'Needs attention' : 'Not connected'}
          </span>
        </div>

        <div>
          <label htmlFor="browser-use-api-key" className="mb-2 block text-sm text-bolt-elements-textSecondary">
            Browser Use API key
          </label>
          <input
            id="browser-use-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="bu_…"
            className="w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
          <p className="mt-2 text-xs text-bolt-elements-textSecondary">
            Create a key with browser read and write permissions in{' '}
            <a
              href="https://cloud.browser-use.com/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-bolt-elements-link hover:underline"
            >
              Browser Use settings
            </a>
            . The key is saved in Bolt’s MCP settings in this browser.
          </p>
        </div>

        {serverStatus?.status === 'unavailable' && (
          <p role="alert" className="text-sm text-bolt-elements-icon-error">
            {serverStatus.error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={connect}
            disabled={!isInitialized || isUpdatingConfig || !apiKey.trim()}
            className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundActive"
          >
            {isUpdatingConfig ? 'Connecting…' : connected ? 'Save and reconnect' : 'Connect'}
          </Button>
          <Button
            type="button"
            onClick={checkConnection}
            disabled={!isInitialized || isChecking || !configuredServer}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isChecking && <div className="i-svg-spinners:90-ring-with-bg h-3 w-3 animate-spin" />}
            Check connection
          </Button>
          {configuredServer && (
            <Button
              type="button"
              onClick={disconnect}
              disabled={!isInitialized || isUpdatingConfig}
              variant="outline"
              className="hover:text-bolt-elements-icon-error"
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {connected && (
        <div className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Action permissions</h3>
            <p className="mt-1 text-xs text-bolt-elements-textSecondary">
              Choose which Browser Use actions Bolt can access. Enabled actions still ask before each run.
            </p>
          </div>
          <div className="space-y-2">
            {Object.entries(serverStatus.tools).map(([toolName, tool]) => {
              const enabled = settings.toolEnabled[toolName] ?? true;
              const description = typeof tool.description === 'string' ? tool.description : 'No description available';

              return (
                <div
                  key={toolName}
                  className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-bolt-elements-textPrimary">{toolName}</p>
                    <p className="text-xs text-bolt-elements-textSecondary">{description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    aria-label={`${enabled ? 'Disable' : 'Enable'} ${toolName}`}
                    onCheckedChange={(checked) => setToolEnabled(toolName, checked)}
                    className="shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
        <h3 className="mb-2 text-sm font-semibold text-bolt-elements-textPrimary">Using the connector</h3>
        <p className="text-sm text-bolt-elements-textSecondary">
          Once connected, Browser Use tools appear with your other MCP tools in chat. Ask Bolt to use Browser Use Cloud
          for a task; starting a hosted browser run may incur usage charges with Browser Use.
        </p>
      </div>
    </div>
  );
}
