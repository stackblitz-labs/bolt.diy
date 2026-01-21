import { useParams } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import * as Dialog from '@radix-ui/react-dialog';
import { type AppLibraryEntry } from '~/lib/persistence/apps';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditAppTitle } from '~/lib/hooks/useEditAppTitle';
import { forwardRef, type ForwardedRef } from 'react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Check, Copy, PenLine, Trash2 } from '~/components/ui/Icon';
import { subscriptionStore } from '~/lib/stores/subscriptionStatus';
import { useStore } from '@nanostores/react';

interface HistoryItemProps {
  item: AppLibraryEntry;
  onDelete?: (event: React.UIEvent) => void;
  onDuplicate?: (id: string) => void;
}

export function HistoryItem({ item, onDelete, onDuplicate }: HistoryItemProps) {
  const { id: urlId } = useParams();
  const isActiveChat = urlId === item.id;
  const stripeSubscription = useStore(subscriptionStore.subscription);

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentTitle, toggleEditMode } =
    useEditAppTitle({
      initialTitle: item.title,
      customAppId: item.id,
    });

  const renderDescriptionForm = (
    <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 min-w-0">
      <input
        type="text"
        className="flex-1 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary rounded-md py-2 text-sm border border-bolt-elements-borderColor focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
        autoFocus
        value={currentTitle}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <button
        type="submit"
        className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors p-1.5 rounded-md hover:bg-bolt-elements-background-depth-1 flex-shrink-0"
        onMouseDown={handleSubmit}
      >
        <Check size={16} />
      </button>
    </form>
  );

  return (
    <div
      className={classNames(
        'group rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 hover:border hover:border-bolt-elements-borderColor flex items-center px-3 py-2 transition-colors border border-transparent',
        {
          'text-bolt-elements-textPrimary bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor':
            isActiveChat,
        },
      )}
    >
      {editing ? (
        renderDescriptionForm
      ) : (
        <a href={`/app/${item.id}`} className="flex items-center gap-2 w-full min-w-0">
          <span className="font-medium text-sm truncate flex-1 min-w-0">{item.title}</span>
          <div className="flex items-center gap-1 text-bolt-elements-textSecondary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {onDuplicate && (
              <ChatActionButton toolTipContent="Duplicate chat" icon={Copy} onClick={() => onDuplicate?.(item.id)} />
            )}
            <ChatActionButton
              toolTipContent="Rename chat"
              icon={PenLine}
              onClick={(event) => {
                event.preventDefault();
                toggleEditMode();
              }}
            />
            {stripeSubscription && stripeSubscription.tier === 'builder' && (
              <Dialog.Trigger asChild>
                <ChatActionButton
                  toolTipContent="Delete app"
                  icon={Trash2}
                  className="[&&]:hover:text-red-500"
                  onClick={(event) => {
                    event.preventDefault();
                    onDelete?.(event);
                  }}
                />
              </Dialog.Trigger>
            )}
          </div>
        </a>
      )}
    </div>
  );
}

const ChatActionButton = forwardRef(
  (
    {
      toolTipContent,
      //eslint-disable-next-line @typescript-eslint/naming-convention
      icon: IconComponent,
      className,
      onClick,
    }: {
      toolTipContent: string;
      icon: React.ComponentType<any>;
      className?: string;
      onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
      btnTitle?: string;
    },
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    return (
      <TooltipProvider>
        <WithTooltip tooltip={toolTipContent}>
          <button
            ref={ref}
            type="button"
            className={`p-1.5 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors ${className ? className : ''}`}
            onClick={onClick}
          >
            <IconComponent size={16} />
          </button>
        </WithTooltip>
      </TooltipProvider>
    );
  },
);
