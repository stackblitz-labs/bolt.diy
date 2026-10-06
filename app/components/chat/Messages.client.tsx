import type { UIMessage } from 'ai';
import { Fragment } from 'react';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'react-toastify';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { forkChat } from '~/lib/persistence/db';
import { getMessageText, hasMessageFlag } from '~/lib/persistence/messageMigration';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import type { ProviderInfo } from '~/types/model';
import { classNames } from '~/utils/classNames';

/*
 * v5 removed UIMessage.content, but Chat.client still needs to hand the parsed
 * artifact/action stream to the renderer. useMessageParser turns the raw model
 * text (which contains <boltArtifact>/<boltAction> tags) into the display text,
 * so it travels on this side channel instead of overwriting `content`.
 */
export type DisplayMessage = UIMessage & { parsedContent?: string };

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: DisplayMessage[];
  append?: (message: UIMessage) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  addToolResult: (options: { tool: string; toolCallId: string; output: unknown }) => void;
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [] } = props;
    const location = useLocation();

    const handleRewind = (messageId: string) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('rewindTo', messageId);
      window.location.search = searchParams.toString();
    };

    const handleFork = async (messageId: string) => {
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
    };

    return (
      <div id={id} className={props.className} ref={ref}>
        {messages.length > 0
          ? messages.map((message, index) => {
              const { role, id: messageId, parts, parsedContent } = message;
              const isUserMessage = role === 'user';
              const isFirst = index === 0;
              const isHidden = hasMessageFlag(message, 'hidden');

              if (isHidden) {
                return <Fragment key={index} />;
              }

              /*
               * Assistant bubbles render useMessageParser's output, which has
               * already stripped boltArtifact/boltAction tags. Falling back to
               * the raw parts would leak that markup into the UI.
               */
              return (
                <div
                  key={index}
                  className={classNames('flex gap-4 py-3 w-full rounded-lg', {
                    'mt-4': !isFirst,
                  })}
                >
                  <div className="grid grid-cols-1 w-full">
                    {isUserMessage ? (
                      <UserMessage content={getMessageText(message)} parts={parts} />
                    ) : (
                      <AssistantMessage
                        content={parsedContent ?? getMessageText(message)}
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
              );
            })
          : null}
        {isStreaming && (
          <div className="text-center w-full  text-bolt-elements-item-contentAccent i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
        )}
      </div>
    );
  },
);
