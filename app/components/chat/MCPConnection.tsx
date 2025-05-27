import { useEffect, useState } from 'react';
import { classNames } from '~/utils/classNames';
import { Dialog, DialogRoot, DialogClose, DialogTitle, DialogButton } from '~/components/ui/Dialog';
import { useMCPConfig, type MCPConfig } from '~/lib/hooks/useMCPConfig';
import { IconButton } from '~/components/ui/IconButton';

// Example MCP configuration that users can load
const EXAMPLE_MCP_CONFIG: MCPConfig = {
  mcpServers: {
    everything: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
    },
    git: {
      command: 'uvx',
      args: ['mcp-server-git'],
    },
    'remote-sse': {
      type: 'sse',
      url: 'http://localhost:8000/sse',
    },
  },
};

type ServerStatus = Record<string, boolean>;
type ServerErrors = Record<string, string>;
type ServerTools = Record<string, any>;

export function McpConnection() {
  const { config, updateConfig, lastUpdate, isLoading } = useMCPConfig();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [configText, setConfigText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>({});
  const [serverErrors, setServerErrors] = useState<ServerErrors>({});
  const [serverTools, setServerTools] = useState<ServerTools>({});
  const [checkingServers, setCheckingServers] = useState(false);
  const [configTextParsed, setConfigTextParsed] = useState<MCPConfig | null>(null);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Initialize config text from config
  useEffect(() => {
    if (config) {
      setConfigText(JSON.stringify(config, null, 2));
      setConfigTextParsed(config);
    } else {
      setConfigText(JSON.stringify({ mcpServers: {} }, null, 2));
      setConfigTextParsed({ mcpServers: {} });
    }
  }, [config, lastUpdate]);

  // Check server availability on initial load
  useEffect(() => {
    if (isInitialLoad && configTextParsed?.mcpServers && Object.keys(configTextParsed.mcpServers).length > 0) {
      checkServerAvailability();
      setIsInitialLoad(false);
    }
  }, [configTextParsed, isInitialLoad]);

  // Reset initial load flag when config is updated externally
  useEffect(() => {
    setIsInitialLoad(true);
  }, [lastUpdate]);

  // Parse the textarea content when it changes
  useEffect(() => {
    try {
      const parsed = JSON.parse(configText) as MCPConfig;
      setConfigTextParsed(parsed);

      if (error?.includes('JSON')) {
        setError(null);
      }
    } catch (e) {
      setConfigTextParsed(null);
      setError(`Invalid JSON format: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [configText, error]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(configText) as MCPConfig;
      updateConfig(parsed);
      setError(null);
      setIsDialogOpen(false);
    } catch {
      setError('Invalid JSON format');
    }
  };

  const handleLoadExample = () => {
    setConfigText(JSON.stringify(EXAMPLE_MCP_CONFIG, null, 2));
    setError(null);
  };

  const checkServerAvailability = async () => {
    try {
      const parsed = JSON.parse(configText) as MCPConfig;

      if (!parsed?.mcpServers) {
        setError('No servers configured or invalid configuration');
        return;
      }

      setCheckingServers(true);
      setError(null);
      setServerErrors({});
      setServerTools({});

      try {
        const response = await fetch('/api/mcp-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mcpServers: parsed.mcpServers }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (typeof data === 'object' && data !== null && 'serverStatus' in data && 'serverErrors' in data) {
          setServerStatus(data.serverStatus as ServerStatus);
          setServerErrors((data.serverErrors as ServerErrors) || ({} as ServerErrors));

          if ('serverTools' in data) {
            setServerTools((data.serverTools as ServerTools) || ({} as ServerTools));
          }
        } else {
          throw new Error('Invalid response format from server');
        }
      } catch (e) {
        setError(`Failed to check server availability: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setCheckingServers(false);
      }
    } catch (e) {
      setError(`Invalid JSON format: ${e instanceof Error ? e.message : String(e)}`);
      setCheckingServers(false);
    }
  };

  const toggleServerExpanded = (serverName: string) => {
    setExpandedServer(expandedServer === serverName ? null : serverName);
  };

  const handleDialogOpen = (open: boolean) => {
    setIsDialogOpen(open);

    if (
      open &&
      configTextParsed?.mcpServers &&
      Object.keys(configTextParsed.mcpServers).length > 0 &&
      Object.keys(serverStatus).length === 0
    ) {
      checkServerAvailability();
    }
  };

  const formatToolSchema = (toolName: string, toolSchema: any) => {
    if (!toolSchema) {
      return null;
    }

    try {
      const parameters = toolSchema.parameters?.properties || {};

      return (
        <div className="mt-2 ml-4 p-2 rounded-md bg-bolt-elements-background-depth-2 text-xs font-mono">
          <div className="font-medium mb-1">{toolName}</div>
          <div className="text-bolt-elements-textSecondary">{toolSchema.description || 'No description available'}</div>

          {Object.keys(parameters).length > 0 && (
            <div className="mt-2">
              <div className="font-medium mb-1">Parameters:</div>
              <div className="ml-2 space-y-1">
                {Object.entries(parameters).map(([paramName, paramDetails]: [string, any]) => (
                  <div key={paramName}>
                    <span className="text-bolt-elements-textAccent">{paramName}</span>
                    {paramDetails.required && <span className="text-red-500 ml-1">*</span>}
                    <span className="text-bolt-elements-textSecondary ml-2">
                      {paramDetails.type || 'any'}
                      {paramDetails.description ? ` - ${paramDetails.description}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    } catch (e) {
      return (
        <div className="mt-2 ml-4 p-2 rounded-md bg-red-100 dark:bg-red-900 text-xs">
          Error parsing tool schema: {e instanceof Error ? e.message : String(e)}
        </div>
      );
    }
  };

  const StatusBadge = ({ status }: { status: 'checking' | 'available' | 'unavailable' }) => {
    const badgeStyles = {
      checking: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      available: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      unavailable: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    const text = {
      checking: 'Checking...',
      available: 'Available',
      unavailable: 'Unavailable',
    };

    const icon =
      status === 'checking' ? (
        <div className="i-svg-spinners:90-ring-with-bg w-3 h-3 text-bolt-elements-loader-progress animate-spin" />
      ) : null;

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${badgeStyles[status]}`}>
        {icon}
        {text[status]}
      </span>
    );
  };

  const renderServerList = () => {
    if (!configTextParsed?.mcpServers) {
      return <p className="text-sm text-bolt-elements-textSecondary">Invalid configuration or no servers defined</p>;
    }

    const serverEntries = Object.entries(configTextParsed.mcpServers);

    if (serverEntries.length === 0) {
      return <p className="text-sm text-bolt-elements-textSecondary">No MCP servers configured</p>;
    }

    return (
      <div className="space-y-2">
        {serverEntries.map(([serverName, serverConfig]) => {
          const isAvailable = serverStatus[serverName];
          const statusKnown = serverName in serverStatus;
          const errorMessage = serverErrors[serverName];
          const serverToolsData = serverTools[serverName];
          const isExpanded = expandedServer === serverName;

          return (
            <div key={serverName} className="flex flex-col py-1 px-2 rounded-md bg-bolt-elements-background-depth-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    onClick={() => toggleServerExpanded(serverName)}
                    className="flex items-center gap-1 text-bolt-elements-textPrimary"
                  >
                    <div className={`i-ph:${isExpanded ? 'caret-down' : 'caret-right'} w-3 h-3`} />
                    <span className="font-medium">{serverName}</span>
                  </div>
                  {serverConfig.type === 'sse' ? (
                    <span className="text-xs text-bolt-elements-textSecondary">SSE: {serverConfig.url}</span>
                  ) : (
                    <span className="text-xs text-bolt-elements-textSecondary">
                      {serverConfig.command} {serverConfig.args?.join(' ')}
                    </span>
                  )}
                </div>

                {checkingServers ? (
                  <StatusBadge status="checking" />
                ) : (
                  statusKnown && <StatusBadge status={isAvailable ? 'available' : 'unavailable'} />
                )}
              </div>

              {/* Display error message if server is unavailable */}
              {statusKnown && !isAvailable && errorMessage && (
                <div className="mt-1 ml-4 text-xs text-red-600 dark:text-red-400">Error: {errorMessage}</div>
              )}

              {/* Display tool schemas if server is expanded */}
              {isExpanded && statusKnown && isAvailable && serverToolsData && (
                <div className="mt-2">
                  <div className="text-xs font-medium ml-2 mb-1">Available Tools:</div>
                  {Object.keys(serverToolsData).length === 0 ? (
                    <div className="ml-4 text-xs text-bolt-elements-textSecondary">No tools available</div>
                  ) : (
                    <div className="mt-1 space-y-2">
                      {Object.entries(serverToolsData).map(([toolName, toolSchema]) => (
                        <div key={toolName}>{formatToolSchema(toolName, toolSchema)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="flex">
        <IconButton onClick={() => setIsDialogOpen(!isDialogOpen)} title="Configure MCP" className="transition-all">
          {isLoading ? (
            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin" />
          ) : (
            <img className="w-4 h-4" height="20" width="20" src="/icons/mcp.svg" alt="MCP" />
          )}
        </IconButton>
      </div>

      <DialogRoot open={isDialogOpen} onOpenChange={handleDialogOpen}>
        {isDialogOpen && (
          <Dialog className="max-w-4xl w-full p-6">
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
              <DialogTitle>
                <img className="w-5 h-5" height="24" width="24" src="/icons/mcp.svg" alt="MCP" />
                MCP Configuration
              </DialogTitle>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-bolt-elements-textSecondary">Configured MCP Servers</label>
                    <button
                      onClick={checkServerAvailability}
                      disabled={
                        checkingServers ||
                        !configTextParsed ||
                        Object.keys(configTextParsed?.mcpServers || {}).length === 0
                      }
                      className={classNames(
                        'px-3 py-1 rounded-md text-xs flex items-center gap-1',
                        'border border-bolt-elements-borderColor',
                        'hover:bg-bolt-elements-background-depth-1',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {checkingServers ? (
                        <div className="i-svg-spinners:90-ring-with-bg w-3 h-3 text-bolt-elements-loader-progress animate-spin" />
                      ) : (
                        <div className="i-ph:arrow-counter-clockwise w-3 h-3" />
                      )}
                      Check availability
                    </button>
                  </div>
                  {renderServerList()}
                </div>

                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary mb-2">Configuration JSON</label>
                  <textarea
                    value={configText}
                    onChange={(e) => setConfigText(e.target.value)}
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm font-mono h-72',
                      'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                      'border',
                      error ? 'border-bolt-elements-icon-error' : 'border-[#E5E5E5] dark:border-[#333333]',
                      'text-bolt-elements-textPrimary',
                      'focus:outline-none focus:ring-1 focus:ring-bolt-elements-focus',
                    )}
                  />

                  {error && <p className="mt-2 text-sm text-bolt-elements-icon-error">{error}</p>}

                  <div className="mt-2 text-sm text-bolt-elements-textSecondary">
                    The MCP configuration format is identical to the one used in Claude Desktop.
                    <a
                      href="https://modelcontextprotocol.io/examples"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-bolt-elements-link hover:underline inline-flex items-center gap-1"
                    >
                      View example servers
                      <div className="i-ph:arrow-square-out w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-2 mt-6">
                <button
                  onClick={handleLoadExample}
                  className="px-4 py-2 rounded-lg text-sm border border-bolt-elements-borderColor
                    bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary
                    hover:bg-bolt-elements-background-depth-3"
                >
                  Load Example
                </button>

                <div className="flex gap-2">
                  <DialogClose asChild>
                    <DialogButton type="secondary">Cancel</DialogButton>
                  </DialogClose>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg text-sm flex items-center gap-2
                      bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent
                      hover:bg-bolt-elements-item-backgroundActive"
                  >
                    <div className="i-ph:floppy-disk w-4 h-4" />
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}
