import React, { Suspense } from 'react';
import { cn } from '~/lib/utils';
import type { Message } from '~/lib/persistence/message';
import { MessageContents } from './MessageContents';
import { MessageActions } from './MessageActions';
import { ThoughtSection } from './ThoughtSection';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';

interface AssistantMessageProps {
  message: Message;
  messages: Message[];
  isFirst?: boolean;
  isLast?: boolean;
  isPending?: boolean;
  thinkingTime?: number;
  onCheckboxChange?: (contents: string, checked: boolean) => void;
  sendMessage?: (params: ChatMessageParams) => void;
}

export function AssistantMessage({
  message,
  messages,
  isFirst = false,
  isLast = false,
  isPending = false,
  thinkingTime,
  onCheckboxChange,
  sendMessage,
}: AssistantMessageProps) {
  // Determine if we should show thinking section (for messages with thinking time)
  const showThinking = thinkingTime && thinkingTime > 0;

  return (
    <div
      data-testid="assistant-message"
      className={cn('group relative w-[95%] mr-auto transition-all duration-200', {
        'mt-4': !isFirst,
      })}
    >
      {/* Response Card */}
      <div
        className={cn(
          'flex flex-col gap-1 rounded-none transition-all duration-200',
          // Pending last message has fade effect
          isPending && isLast ? 'bg-gradient-to-b from-background from-30% to-transparent' : '',
        )}
      >
        {/* Thinking Section (collapsible) */}
        {showThinking && (
          <ThoughtSection thinkingTime={thinkingTime}>
            {/* Could show thinking content here if available */}
          </ThoughtSection>
        )}

        {/* Message Content */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center w-full py-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            </div>
          }
        >
          <div className="flex-1">
            <MessageContents
              message={message}
              messages={messages}
              onCheckboxChange={onCheckboxChange}
              sendMessage={sendMessage}
            />
          </div>
        </Suspense>

        {/* Action Buttons - Appear on hover */}
        <div className="flex items-center justify-start opacity-0 group-hover:opacity-100 transition-opacity duration-200 pt-2">
          <MessageActions messageContent={message.content} showBranch={true} showRetry={true} />
        </div>
      </div>
    </div>
  );
}
