/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { Markdown } from '~/components/chat/Markdown';
import { AttachmentDisplay } from './AttachmentDisplay';
import type { Message } from '~/lib/persistence/message';

interface MessageContentsProps {
  message: Message;
  onCheckboxChange?: (contents: string, checked: boolean) => void;
}

export function MessageContents({ message, onCheckboxChange }: MessageContentsProps) {
  return (
    <div data-testid="message-content" className="overflow-hidden">
      <div className="prose prose-sm max-w-none text-bolt-elements-textPrimary">
        <Markdown html onCheckboxChange={onCheckboxChange}>
          {message.content}
        </Markdown>
      </div>
      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {message.attachments.map((attachment, index) => (
            <AttachmentDisplay key={`${attachment.attachmentId}-${index}`} attachment={attachment} />
          ))}
        </div>
      )}
    </div>
  );
}
