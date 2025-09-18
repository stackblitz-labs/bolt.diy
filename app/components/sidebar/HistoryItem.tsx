import { useParams } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import * as Dialog from '@radix-ui/react-dialog';
import { type AppLibraryEntry } from '~/lib/persistence/apps';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditAppTitle } from '~/lib/hooks/useEditAppTitle';
import { forwardRef, type ForwardedRef } from 'react';
import { TooltipProvider } from '@radix-ui/react-tooltip';

interface HistoryItemProps {
  item: AppLibraryEntry;
  onDelete?: (event: React.UIEvent) => void;
  onDuplicate?: (id: string) => void;
}

export function HistoryItem({ item, onDelete, onDuplicate }: HistoryItemProps) {
  const { id: urlId } = useParams();
  const isActiveChat = urlId === item.id;

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentTitle, toggleEditMode } =
    useEditAppTitle({
      initialTitle: item.title,
      customAppId: item.id,
    });

  const renderDescriptionForm = (
    <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
      <input
        type="text"
        className="flex-1 bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary rounded-xl px-3 py-2 border border-bolt-elements-borderColor focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
        autoFocus
        value={currentTitle}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <button
        type="submit"
        className="i-ph:check text-lg text-bolt-elements-textSecondary hover:text-green-500 transition-all duration-200 hover:scale-110 p-1 rounded-lg hover:bg-green-500/10"
        onMouseDown={handleSubmit}
      />
    </form>
  );

  return (
    <div
      className={classNames(
        'group rounded-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 overflow-hidden flex justify-between items-center px-3 py-2.5 transition-all duration-200 hover:shadow-sm border border-transparent hover:border-bolt-elements-borderColor/30',
        {
          '[&&]:text-bolt-elements-textPrimary bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor/50 shadow-sm':
            isActiveChat,
        },
      )}
    >
      {editing ? (
        renderDescriptionForm
      ) : (
        <a href={`/app/${item.id}`} className="flex w-full relative truncate block">
          <span className="font-medium">{item.title}</span>
          <div
            className={classNames(
              'absolute right-0 z-1 top-0 bottom-0 bg-gradient-to-l from-bolt-elements-background-depth-2 group-hover:from-bolt-elements-background-depth-3 box-content pl-4 to-transparent w-12 flex justify-end group-hover:w-28 group-hover:from-99%',
              { 'from-bolt-elements-background-depth-3 w-12': isActiveChat },
            )}
          >
            <div className="flex items-center gap-1 text-bolt-elements-textSecondary opacity-0 group-hover:opacity-100 transition-all duration-200">
              {onDuplicate && (
                <ChatActionButton
                  toolTipContent="Duplicate chat"
                  icon="i-ph:copy"
                  onClick={() => onDuplicate?.(item.id)}
                />
              )}
              <ChatActionButton
                toolTipContent="Rename chat"
                icon="i-ph:pencil-fill"
                onClick={(event) => {
                  event.preventDefault();
                  toggleEditMode();
                }}
              />
              <Dialog.Trigger asChild>
                <ChatActionButton
                  toolTipContent="Delete app"
                  icon="i-ph:trash"
                  className="[&&]:hover:text-red-500 [&&]:hover:bg-red-500/10"
                  onClick={(event) => {
                    event.preventDefault();
                    onDelete?.(event);
                  }}
                />
              </Dialog.Trigger>
            </div>
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
      icon,
      className,
      onClick,
    }: {
      toolTipContent: string;
      icon: string;
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
            className={`p-1.5 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-all duration-200 hover:scale-110 ${icon} ${className ? className : ''}`}
            onClick={onClick}
          />
        </WithTooltip>
      </TooltipProvider>
    );
  },
);
