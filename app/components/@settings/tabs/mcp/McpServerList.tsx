import type { MCPServer } from '~/lib/services/mcpService';
import McpStatusBadge from '~/components/@settings/tabs/mcp/McpStatusBadge';
import McpServerListItem from '~/components/@settings/tabs/mcp/McpServerListItem';

type McpServerListProps = {
  serverEntries: [string, MCPServer][];
  expandedServer: string | null;
  checkingServers: boolean;
  onlyShowAvailableServers?: boolean;
  toggleServerExpanded: (serverName: string) => void;
};

export default function McpServerList({
  serverEntries,
  expandedServer,
  checkingServers,
  onlyShowAvailableServers = false,
  toggleServerExpanded,
}: McpServerListProps) {
  if (serverEntries.length === 0) {
    return <p className="text-sm text-bolt-elements-textSecondary">No MCP servers configured</p>;
  }

  const filteredEntries = onlyShowAvailableServers
    ? serverEntries.filter(([, s]) => s.status === 'available')
    : serverEntries;

  return (
    <div className="space-y-2">
      {filteredEntries.map(([serverName, mcpServer]) => {
        const isAvailable = mcpServer.status === 'available';
        const isExpanded = expandedServer === serverName;
        const serverTools = isAvailable ? Object.entries(mcpServer.tools) : [];

        return (
          <div key={serverName} className="flex flex-col p-2 rounded-md bg-bolt-elements-background-depth-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  onClick={() => toggleServerExpanded(serverName)}
                  className="flex items-center gap-1.5 text-bolt-elements-textPrimary"
                  aria-expanded={isExpanded}
                >
                  <div
                    className={`i-ph:${isExpanded ? 'caret-down' : 'caret-right'} w-3 h-3 transition-transform duration-150`}
                  />
                  <span className="font-medium truncate text-left">{serverName}</span>
                </div>

                <div className="flex-1 min-w-0 truncate">
                  {mcpServer.config.type === 'sse' || mcpServer.config.type === 'streamable-http' ? (
                    <span className="text-xs text-bolt-elements-textSecondary truncate">{mcpServer.config.url}</span>
                  ) : (
                    <span className="text-xs text-bolt-elements-textSecondary truncate">
                      {mcpServer.config.command} {mcpServer.config.args?.join(' ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="ml-2 flex-shrink-0">
                {checkingServers ? (
                  <McpStatusBadge status="checking" />
                ) : (
                  <McpStatusBadge status={isAvailable ? 'available' : 'unavailable'} />
                )}
              </div>
            </div>

            {/* Error message */}
            {!isAvailable && mcpServer.error && (
              <div className="mt-1.5 ml-6 text-xs text-red-600 dark:text-red-400">Error: {mcpServer.error}</div>
            )}

            {/* Tool list */}
            {isExpanded && isAvailable && (
              <div className="mt-2">
                <div className="text-bolt-elements-textSecondary text-xs font-medium ml-1 mb-1.5">Available Tools:</div>
                {serverTools.length === 0 ? (
                  <div className="ml-4 text-xs text-bolt-elements-textSecondary">No tools available</div>
                ) : (
                  <div className="mt-1 space-y-2">
                    {serverTools.map(([toolName, toolSchema]) => (
                      <McpServerListItem
                        key={`${serverName}-${toolName}`}
                        toolName={toolName}
                        toolSchema={toolSchema}
                      />
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
}
