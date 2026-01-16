import type { Message } from 'ai';
import { useCallback } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useLocation } from '@remix-run/react';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { forkChat } from '~/lib/persistence/db';
import { toast } from 'react-toastify';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import type { ProviderInfo } from '~/types/model';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStickToBottomContext } from '~/lib/hooks/StickToBottom';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  append?: (message: Message) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  addToolResult: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [] } = props;
    const location = useLocation();
    const { scrollRef } = useStickToBottomContext();

    const handleRewind = useCallback(
      (messageId: string) => {
        const searchParams = new URLSearchParams(location.search);
        searchParams.set('rewindTo', messageId);
        window.location.search = searchParams.toString();
      },
      [location.search],
    );

    const handleFork = useCallback(async (messageId: string) => {
      try {
        if (!db || !chatId.get()) {
          toast.error('Chat persistence is not available');
          return;
        }

        const urlId = await forkChat(db, chatId.get()!, messageId);
        window.location.href = `/chat/${urlId}`;
      } catch (error) {
        toast.error('Failed to fork chat: ' + (error as Error).message);
      }
    }, []);

    // Add 1 for the loader if streaming
    const count = messages.length + (isStreaming ? 1 : 0);

    const virtualizer = useVirtualizer({
      count,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => 100, // Estimate row height
      overscan: 15, // Increase overscan for smoother scrolling
    });

    return (
      <div id={id} className={props.className} ref={ref}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const index = virtualItem.index;

            // Render loader if it's the last item and we are streaming
            if (index === messages.length && isStreaming) {
              return (
                <div
                  key="loader"
                  ref={virtualizer.measureElement}
                  data-index={index}
                  className="w-full"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="text-center w-full text-bolt-elements-item-contentAccent i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
                </div>
              );
            }

            const message = messages[index];

            if (!message) {
              return null;
            }

            const { role, content, id: messageId, annotations, parts } = message;
            const isUserMessage = role === 'user';
            const isFirst = index === 0;
            const isHidden = annotations?.includes('hidden');

            if (isHidden) {
              /*
               * We must render the element for the virtualizer to measure it,
               * but we can make it empty/hidden.
               */
              return <div key={virtualItem.key} ref={virtualizer.measureElement} data-index={index} />;
            }

            return (
              <div
                key={virtualItem.key}
                data-index={index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={classNames('flex gap-4 py-3 w-full rounded-lg', {
                    'mt-4': !isFirst,
                  })}
                >
                  <div className="grid grid-col-1 w-full">
                    {isUserMessage ? (
                      <UserMessage content={content} parts={parts} />
                    ) : (
                      <AssistantMessage
                        content={content}
                        annotations={message.annotations}
                        messageId={messageId}
                        onRewind={handleRewind}
                        onFork={handleFork}
                        append={props.append}
                        chatMode={props.chatMode}
                        setChatMode={props.setChatMode}
                        model={props.model}
                        provider={props.provider}
                        parts={parts}
                        addToolResult={props.addToolResult}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
