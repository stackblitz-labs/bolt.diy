import type { Message } from 'ai';
import { Fragment, useEffect, useRef, useMemo, useCallback } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useLocation } from '@remix-run/react';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { forkChat } from '~/lib/persistence/db';
import { toast } from 'react-toastify';
import WithTooltip from '~/components/ui/Tooltip';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [] } = props;
    const location = useLocation();
    const profile = useStore(profileStore);
    const lastMessageRef = useRef<HTMLDivElement>(null);
    const previousMessagesLengthRef = useRef(messages.length);
    const lastMessageContentRef = useRef('');

    // Create memoized/debounced versions of messages to reduce rendering overhead
    const optimizedMessages = useMemo(() => {
      // For all but the last message, we don't need to re-render frequently
      const nonStreamingMessages = messages.slice(0, -1);

      // Only the last message is potentially streaming and needs frequent updates
      const lastMessage = messages[messages.length - 1];

      return lastMessage ? [...nonStreamingMessages, lastMessage] : messages;
    }, [messages]);

    // Keep track of messages length changes to detect new messages
    useEffect(() => {
      const currentLength = messages.length;

      // If we have a new message
      if (currentLength > previousMessagesLengthRef.current) {
        lastMessageContentRef.current = '';
        previousMessagesLengthRef.current = currentLength;
      }

      // If we have a last message and it's from the assistant
      if (currentLength > 0 && messages[currentLength - 1].role === 'assistant') {
        const latestContent = messages[currentLength - 1].content;

        // Only update if content changed by more than 100 characters or message ended
        if (
          !isStreaming ||
          latestContent.length - lastMessageContentRef.current.length > 100 ||
          latestContent !== lastMessageContentRef.current
        ) {
          lastMessageContentRef.current = latestContent;
        }
      }
    }, [messages, isStreaming]);

    // Auto-scroll to bottom of new content during streaming
    useEffect(() => {
      if ((isStreaming || messages.length !== previousMessagesLengthRef.current) && lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, [isStreaming, optimizedMessages]);

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

    // Memoize message rendering for better performance
    const renderMessages = useCallback(() => {
      return optimizedMessages.map((message, index) => {
        const { role, content, id: messageId, annotations } = message;
        const isUserMessage = role === 'user';
        const isFirst = index === 0;
        const isLast = index === optimizedMessages.length - 1;
        const isHidden = annotations?.includes('hidden');

        if (isHidden) {
          return <Fragment key={index} />;
        }

        return (
          <div
            key={index}
            ref={isLast ? lastMessageRef : undefined}
            className={classNames('flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)]', {
              'bg-bolt-elements-messages-background': isUserMessage || !isStreaming || (isStreaming && !isLast),
              'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent': isStreaming && isLast,
              'mt-4': !isFirst,
            })}
          >
            {isUserMessage && (
              <div className="flex items-center justify-center w-[40px] h-[40px] overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 rounded-full shrink-0 self-start">
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile?.username || 'User'}
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="sync"
                  />
                ) : (
                  <div className="i-ph:user-fill text-2xl" />
                )}
              </div>
            )}
            <div className="grid grid-col-1 w-full">
              {isUserMessage ? (
                <UserMessage content={content} />
              ) : (
                <AssistantMessage content={content} annotations={message.annotations} />
              )}
            </div>
            {!isUserMessage && (
              <div className="flex gap-2 flex-col lg:flex-row">
                {messageId && (
                  <WithTooltip tooltip="Revert to this message">
                    <button
                      onClick={() => handleRewind(messageId)}
                      key="i-ph:arrow-u-up-left"
                      className={classNames(
                        'i-ph:arrow-u-up-left',
                        'text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors',
                      )}
                    />
                  </WithTooltip>
                )}

                <WithTooltip tooltip="Fork chat from this message">
                  <button
                    onClick={() => handleFork(messageId)}
                    key="i-ph:git-fork"
                    className={classNames(
                      'i-ph:git-fork',
                      'text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors',
                    )}
                  />
                </WithTooltip>
              </div>
            )}
          </div>
        );
      });
    }, [optimizedMessages, isStreaming, profile, handleRewind, handleFork]);

    return (
      <div id={id} className={props.className} ref={ref}>
        {optimizedMessages.length > 0 ? renderMessages() : null}
        {isStreaming && (
          <div className="text-center w-full text-bolt-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
        )}
      </div>
    );
  },
);
