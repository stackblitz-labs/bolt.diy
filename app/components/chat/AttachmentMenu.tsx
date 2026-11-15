import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import type { ConnectorId } from '~/lib/stores/mcp';
import { classNames } from '~/utils/classNames';

type ConnectorMenuItem = {
  id: ConnectorId;
  name: string;
  icon: ReactNode;
  enabled: boolean;
};

interface AttachmentMenuProps {
  onAttachFile: () => void;
  connectors: ConnectorMenuItem[];
  onConnectorEnabledChange: (connector: ConnectorId, enabled: boolean) => void;
  onEnhancePrompt: () => void;
  onOpenDesignDialog: () => void;
  onOpenMcpTools: () => void;
  mcpToolsInitialized: boolean;
  webSearchEnabled: boolean;
  onWebSearchEnabledChange: (enabled: boolean) => void;
  enhancingPrompt?: boolean;
  isEnhanceDisabled?: boolean;
}

export function AttachmentMenu({
  onAttachFile,
  connectors,
  onConnectorEnabledChange,
  onEnhancePrompt,
  onOpenDesignDialog,
  onOpenMcpTools,
  mcpToolsInitialized,
  webSearchEnabled,
  onWebSearchEnabledChange,
  enhancingPrompt = false,
  isEnhanceDisabled = false,
}: AttachmentMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title="Add attachment or connector"
          className={classNames(
            'flex items-center text-bolt-elements-item-contentDefault bg-transparent',
            'hover:text-bolt-elements-item-contentActive rounded-md p-1',
            'hover:bg-bolt-elements-item-backgroundActive',
            'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus focus:ring-offset-1',
            'transition-all',
          )}
        >
          <div className="i-ph:plus text-xl"></div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={classNames(
            'min-w-[200px] rounded-lg p-1',
            'bg-bolt-elements-background-depth-2',
            'border border-bolt-elements-borderColor',
            'shadow-lg',
            'animate-in fade-in-80 zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2',
            'data-[side=top]:slide-in-from-bottom-2',
            'z-[1000]',
          )}
          sideOffset={5}
          align="start"
        >
          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
              'text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-3',
              'data-[highlighted]:bg-bolt-elements-background-depth-3',
              'outline-none transition-colors',
            )}
            onSelect={onAttachFile}
          >
            <div className="i-ph:paperclip text-lg"></div>
            <span>Attach File</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
              'text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-3',
              'data-[highlighted]:bg-bolt-elements-background-depth-3',
              'outline-none transition-colors',
            )}
            onSelect={onOpenDesignDialog}
          >
            <div className="i-ph:palette text-lg"></div>
            <span>Design Palette</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
              'text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-3',
              'data-[highlighted]:bg-bolt-elements-background-depth-3',
              'outline-none transition-colors',
              isEnhanceDisabled && 'opacity-50 cursor-not-allowed',
            )}
            onSelect={onEnhancePrompt}
            disabled={isEnhanceDisabled}
          >
            {enhancingPrompt ? (
              <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-lg animate-spin"></div>
            ) : (
              <div className="i-bolt:stars text-lg"></div>
            )}
            <span>Enhance Prompt</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
              'text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-background-depth-3',
              'data-[highlighted]:bg-bolt-elements-background-depth-3',
              'outline-none transition-colors',
              !mcpToolsInitialized && 'opacity-50 cursor-not-allowed',
            )}
            onSelect={onOpenMcpTools}
            disabled={!mcpToolsInitialized}
          >
            <div className="i-bolt:mcp text-lg"></div>
            <span>MCP Tools Available</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-bolt-elements-borderColor my-1" />

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger
              className={classNames(
                'flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
                'text-bolt-elements-textPrimary',
                'hover:bg-bolt-elements-background-depth-3',
                'outline-none transition-colors',
              )}
            >
              <div className="flex items-center gap-2">
                <div className="i-ph:plug text-lg"></div>
                <span>Connectors</span>
              </div>
              <div className="i-ph:caret-right text-sm"></div>
            </DropdownMenu.SubTrigger>

            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className={classNames(
                  'min-w-[180px] rounded-lg p-1',
                  'bg-bolt-elements-background-depth-2',
                  'border border-bolt-elements-borderColor',
                  'shadow-lg',
                  'animate-in fade-in-80 zoom-in-95',
                  'data-[side=right]:slide-in-from-left-2',
                  'data-[side=left]:slide-in-from-right-2',
                  'z-[1000]',
                )}
                sideOffset={8}
              >
                <DropdownMenu.Item
                  onSelect={() => onWebSearchEnabledChange(!webSearchEnabled)}
                  className={classNames(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
                    'justify-between',
                    'text-bolt-elements-textPrimary',
                    'hover:bg-bolt-elements-background-depth-3',
                    'outline-none transition-colors',
                  )}
                >
                  <div className="i-ph:magnifying-glass text-lg" />
                  <span>Web Search</span>
                  <span
                    aria-label={webSearchEnabled ? 'Enabled' : 'Disabled'}
                    className={classNames(
                      'ml-auto h-2 w-2 rounded-full',
                      webSearchEnabled ? 'bg-green-500' : 'bg-red-500',
                    )}
                  />
                </DropdownMenu.Item>

                {connectors.map((connector) => (
                  <DropdownMenu.Item
                    key={connector.id}
                    className={classNames(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
                      'justify-between',
                      'text-bolt-elements-textPrimary',
                      'hover:bg-bolt-elements-background-depth-3',
                      'outline-none transition-colors',
                    )}
                    onSelect={() => onConnectorEnabledChange(connector.id, !connector.enabled)}
                  >
                    {connector.icon}
                    <span>{connector.name}</span>
                    <span
                      aria-label={connector.enabled ? 'Enabled' : 'Disabled'}
                      className={classNames(
                        'ml-auto h-2 w-2 rounded-full',
                        connector.enabled ? 'bg-green-500' : 'bg-red-500',
                      )}
                    />
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
