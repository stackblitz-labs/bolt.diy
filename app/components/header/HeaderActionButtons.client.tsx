import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import WithTooltip from '~/components/ui/Tooltip';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const showChat = useStore(chatStore.showChat);

  const isSmallViewport = useViewport(800);

  const canHideChat = showWorkbench || !showChat;

  return (
    <TooltipProvider>
      <div className="flex">
        {!isSmallViewport && (
          <div className="flex bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl overflow-hidden transition-all duration-200 hover:border-bolt-elements-focus/30">
            <Button
              active={showChat}
              disabled={!canHideChat || isSmallViewport}
              onClick={() => {
                if (canHideChat) {
                  chatStore.showChat.set(!showChat);
                }
              }}
            >
              <WithTooltip tooltip="Open Chat">
                <div className="i-bolt:chat text-xl" />
              </WithTooltip>
            </Button>
            <div className="w-[1px] bg-bolt-elements-borderColor/50" />
            <Button
              active={showWorkbench}
              onClick={() => {
                if (showWorkbench && !showChat) {
                  chatStore.showChat.set(true);
                }

                workbenchStore.showWorkbench.set(!showWorkbench);
              }}
            >
              <WithTooltip tooltip="Open Preview">
                <div className="i-ph:desktop-bold text-xl" />
              </WithTooltip>
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
}

function Button({ active = false, disabled = false, children, onClick }: ButtonProps) {
  return (
    <button
      className={classNames('flex items-center px-4 py-2 relative group transition-all duration-200', {
        'bg-transparent hover:bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:scale-105':
          !active && !disabled,
        'bg-blue-500/10 text-blue-500 shadow-inner': active && !disabled,
        'bg-transparent text-bolt-elements-textTertiary cursor-not-allowed opacity-50': disabled,
      })}
      onClick={onClick}
      disabled={disabled}
    >
      <div
        className={classNames('transition-all duration-200', {
          'transform group-hover:scale-110': !disabled,
        })}
      >
        {children}
      </div>
      {active && !disabled && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-green-500/5 rounded" />
      )}
    </button>
  );
}
