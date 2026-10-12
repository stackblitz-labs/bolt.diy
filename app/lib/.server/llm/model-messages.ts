import { convertToModelMessages, pruneMessages, type UIMessage } from 'ai';

/** Pruning uses model-message content; UI messages carry their content in parts. */
export async function prepareModelMessages(messages: UIMessage[]) {
  return pruneMessages({ messages: await convertToModelMessages(messages) });
}
