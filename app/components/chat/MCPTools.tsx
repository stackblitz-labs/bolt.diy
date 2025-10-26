import { useEffect, useMemo, useState } from 'react';
import { classNames } from '~/utils/classNames';
import { Dialog, DialogRoot, DialogClose, DialogTitle, DialogButton } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';
import { useMCPStore } from '~/lib/stores/mcp';
import McpServerList from '~/components/@settings/tabs/mcp/McpServerList';

export function McpTools() {
  const isInitialized = useMCPStore((state) => state.isInitialized);
  const serverTools = useMCPStore((state) => state.serverTools);
  const initialize = useMCPStore((state) => state.initialize);
  const checkServersAvailabilities = useMCPStore((state) => state.checkServersAvailabilities);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingServers, setIsCheckingServers] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized]);

  const checkServerAvailability = async () => {
    setIsCheckingServers(true);
    setError(null);

    try {
      await checkServersAvailabilities();
    } catch (e) {
      setError(`Failed to check server availability: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsCheckingServers(false);
    }
  };

  const toggleServerExpanded = (serverName: string) => {
    setExpandedServer(expandedServer === serverName ? null : serverName);
  };

  const handleDialogOpen = (open: boolean) => {
    setIsDialogOpen(open);
  };

  const serverEntries = useMemo(() => Object.entries(serverTools), [serverTools]);

  return (
    <div className="relative">
      <div className="flex">
        <IconButton
          onClick={() => setIsDialogOpen(!isDialogOpen)}
          title="MCP Tools Available"
          disabled={!isInitialized}
          className="transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!isInitialized ? (
            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
          ) : (
            <div className="i-bolt:mcp text-xl"></div>
          )}
        </IconButton>
      </div>

      <DialogRoot open={isDialogOpen} onOpenChange={handleDialogOpen}>
        {isDialogOpen && (
          <Dialog className="max-w-4xl w-full p-6">
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
              <DialogTitle>
                <div className="i-bolt:mcp text-xl"></div>
                MCP tools
              </DialogTitle>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-end items-center mb-2">
                    <button
                      onClick={checkServerAvailability}
                      disabled={isCheckingServers || serverEntries.length === 0}
                      className={classNames(
                        'px-3 py-1.5 rounded-lg text-sm',
                        'bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4',
                        'text-bolt-elements-textPrimary',
                        'transition-all duration-200',
                        'flex items-center gap-2',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {isCheckingServers ? (
                        <div className="i-svg-spinners:90-ring-with-bg w-3 h-3 text-bolt-elements-loader-progress animate-spin" />
                      ) : (
                        <div className="i-ph:arrow-counter-clockwise w-3 h-3" />
                      )}
                      Check availability
                    </button>
                  </div>
                  {serverEntries.length > 0 ? (
                    <McpServerList
                      checkingServers={isCheckingServers}
                      expandedServer={expandedServer}
                      serverEntries={serverEntries}
                      onlyShowAvailableServers={true}
                      toggleServerExpanded={toggleServerExpanded}
                    />
                  ) : (
                    <div className="py-4 text-center text-bolt-elements-textSecondary">
                      <p>No MCP servers configured</p>
                      <p className="text-xs mt-1">Configure servers in Settings → MCP Servers</p>
                    </div>
                  )}
                </div>

                <div>{error && <p className="mt-2 text-sm text-bolt-elements-icon-error">{error}</p>}</div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <div className="flex gap-2">
                  <DialogClose asChild>
                    <DialogButton type="secondary">Close</DialogButton>
                  </DialogClose>
                </div>
              </div>
            </div>
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}
