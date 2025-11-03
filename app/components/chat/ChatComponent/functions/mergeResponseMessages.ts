import type { Message } from '~/lib/persistence/message';

function mergeResponseMessage(msg: Message, messages: Message[]): Message[] {
  if (!messages.length) {
    return [msg];
  }
  messages = [...messages];

  const existingIndex = messages.findIndex((m) => m.id == msg.id);
  if (existingIndex == -1) {
    messages.push(msg);
  } else {
    const existing = messages[existingIndex];
    messages[existingIndex] = {
      ...existing,
      attachments: (existing.attachments ?? []).concat(msg.attachments ?? []),
      content: existing.content + msg.content,
      hasInteracted: existing.hasInteracted,
    };
  }
  return messages;
}

export default mergeResponseMessage;
