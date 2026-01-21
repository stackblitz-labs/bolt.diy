import { Suspense, useState } from 'react';
import { cn } from '~/lib/utils';
import { Copy, Check } from 'lucide-react';
import type { Message } from '~/lib/persistence/message';
import { MessageContents } from './MessageContents';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';

interface UserMessageProps {
  message: Message;
  messages: Message[];
  isFirst?: boolean;
  onCheckboxChange?: (contents: string, checked: boolean) => void;
  sendMessage?: (params: ChatMessageParams) => void;
}

export function UserMessage({ message, messages, isFirst = false, onCheckboxChange, sendMessage }: UserMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  return (
    <div
      data-testid="user-message"
      className={cn('group relative w-[95%] ml-auto transition-all duration-200', {
        'mt-4': !isFirst,
      })}
    >
      {/* Message Card */}
      <div className="flex flex-col gap-2 transition-all duration-200">
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
          <div className="flex-1 px-4 rounded-md bg-card border border-border">
            <MessageContents
              message={message}
              messages={messages}
              onCheckboxChange={onCheckboxChange}
              sendMessage={sendMessage}
            />
          </div>
        </Suspense>

        {/* Action Buttons - Appear on hover */}
        <div className="flex items-center justify-end gap-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center w-6 h-6 rounded-md bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200"
            title="Copy message"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {/* <button
            className="flex items-center justify-center w-6 h-6 rounded-md bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200"
            title="Edit message"
          >
            <Pencil size={12} />
          </button> */}
        </div>
      </div>
    </div>
  );
}
