import type { Message } from 'ai';
import { Fragment } from 'react';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useLocation } from '@remix-run/react';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { forkChat } from '~/lib/persistence/db';
import { toast } from 'react-toastify';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import type { ProviderInfo } from '~/types/model';
import { LoadOlderMessagesButton } from './LoadOlderMessagesButton';

function ChatPanelHeader() {
  return (
    <div className="flex items-center justify-between mb-4 pb-2">
      <h4 className="text-xs font-bold text-bolt-elements-textTertiary tracking-widest uppercase">Design Assistant</h4>
      <button
        className="p-1 bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-item-contentAccent transition-colors"
        title="Chat History"
      >
        <div className="i-ph:clock-counter-clockwise text-lg" />
      </button>
    </div>
  );
}

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
  hasOlderMessages?: boolean;
  loadingOlder?: boolean;
  loadingOlderError?: string | null;
  onLoadOlderMessages?: () => void;
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const {
      id,
      isStreaming = false,
      messages = [],
      hasOlderMessages,
      loadingOlder,
      loadingOlderError,
      onLoadOlderMessages,
    } = props;
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
        <ChatPanelHeader />
        {hasOlderMessages && (
          <LoadOlderMessagesButton
            onLoadOlder={onLoadOlderMessages}
            loading={loadingOlder}
            error={loadingOlderError || undefined}
            disabled={isStreaming}
          />
        )}
        <div className="space-y-6">
          {messages.length > 0
            ? messages.map((message, index) => {
                const { role, content, id: messageId, annotations, parts, createdAt } = message;
                const isUserMessage = role === 'user';
                const isHidden = annotations?.includes('hidden');
                const timestamp = createdAt ? new Date(createdAt) : undefined;

                if (isHidden) {
                  return <Fragment key={index} />;
                }

                return (
                  <div key={index} className="w-full">
                    {isUserMessage ? (
                      <UserMessage content={content} parts={parts} timestamp={timestamp} />
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
                        timestamp={timestamp}
                      />
                    )}
                  </div>
                );
              })
            : null}
        </div>
        {isStreaming && (
          <div className="text-center w-full text-bolt-elements-item-contentAccent i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
        )}
      </div>
    );
  },
);
