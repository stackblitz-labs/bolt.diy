import { createUIMessageStream, generateId, type UIMessage } from 'ai';

/** Continue approved tool calls in the same assistant message and SDK stream state. */
export function createChatUIMessageStream(messages: UIMessage[], options: Parameters<typeof createUIMessageStream>[0]) {
  const lastMessage = messages[messages.length - 1];
  const messageId = lastMessage?.role === 'assistant' ? lastMessage.id : generateId();

  return createUIMessageStream({
    ...options,
    originalMessages: messages,
    execute: ({ writer }) => {
      writer.write({ type: 'start', messageId });
      return options.execute({ writer });
    },
  });
}
