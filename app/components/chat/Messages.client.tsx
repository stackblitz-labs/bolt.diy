import type { UIMessage } from 'ai';
import { forwardRef, Fragment, memo, useCallback, useMemo, type ForwardedRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'react-toastify';
import { AssistantMessage } from './AssistantMessage';
import { isModelThinking, ThinkingIndicator } from './Thinking';
import { UserMessage } from './UserMessage';
import { forkChat } from '~/lib/persistence/db';
import { getMessageText, hasMessageFlag } from '~/lib/persistence/messageMigration';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { EnhancedStreamingMessageParser } from '~/lib/runtime/enhanced-message-parser';
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
  archivedMessages?: UIMessage[];
  append?: (message: UIMessage) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  addToolResult: (options: { tool: string; toolCallId: string; output: unknown }) => void;
}

const ignoreArchivedToolResult = () => undefined;

const MessagesWithRef = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [], archivedMessages } = props;
    const location = useLocation();
    const navigate = useNavigate();

    const archivedTranscript = useMemo<DisplayMessage[]>(() => {
      if (!archivedMessages?.length) {
        return [];
      }

      // The snapshot already includes these actions. Parse their text without running workbench callbacks.
      const parser = new EnhancedStreamingMessageParser({ artifactElement: () => '' });

      return archivedMessages.map((message) =>
        message.role === 'assistant'
          ? { ...message, parsedContent: parser.parse(message.id, getMessageText(message), true) }
          : message,
      );
    }, [archivedMessages]);

    const transcript = [...archivedTranscript, ...messages];

    const handleRewind = useCallback(
      (messageId: string) => {
        const searchParams = new URLSearchParams(location.search);
        searchParams.set('rewindTo', messageId);
        window.location.search = searchParams.toString();
      },
      [location.search],
    );

    const handleFork = useCallback(
      async (messageId: string) => {
        try {
          if (!db || !chatId.get()) {
            toast.error('Chat persistence is not available');
            return;
          }

          const urlId = await forkChat(db, chatId.get()!, messageId);
          navigate(`/chat/${urlId}`);
        } catch (error) {
          toast.error('Failed to fork chat: ' + (error as Error).message);
        }
      },
      [navigate],
    );

    return (
      <div id={id} className={props.className} ref={ref}>
        {transcript.length > 0
          ? transcript.map((message, index) => {
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
                        isStreaming={isStreaming && index === transcript.length - 1}
                        onRewind={handleRewind}
                        onFork={handleFork}
                        append={props.append}
                        chatMode={props.chatMode}
                        setChatMode={props.setChatMode}
                        model={props.model}
                        provider={props.provider}
                        parts={parts}
                        addToolResult={
                          index < archivedTranscript.length ? ignoreArchivedToolResult : props.addToolResult
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })
          : null}
        {isModelThinking(messages, isStreaming) && <ThinkingIndicator />}
      </div>
    );
  },
);

export const Messages = memo(MessagesWithRef);
