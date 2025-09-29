import type { Message } from '~/lib/persistence/message';

export interface ChatProps {
  initialMessages: Message[];
}

// Re-export types we need
export type { Message };

export interface UserMessage extends Message {
  role: 'user';
}
