import type { Message } from '~/lib/persistence/message';

function mergeResponseMessage(msg: Message, messages: Message[]): Message[] {
  if (!messages.length) {
    return [msg];
  }
  messages = [...messages];
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.id == msg.id) {
    messages.pop();
    messages.push({
      ...msg,
      attachments: (lastMessage.attachments ?? []).concat(msg.attachments ?? []),
      content: lastMessage.content + msg.content,
      hasInteracted: lastMessage.hasInteracted,
    });
  } else {
    // We shouldn't see the same message twice, log an error when this occurs.
    const existing = messages.find((m) => m.id == msg.id);
    if (existing) {
      console.error('mergeResponseMessage: duplicate message', existing, msg, messages);
      debugger;
      return messages;
    }
    messages.push(msg);
  }
  return messages;
}

export default mergeResponseMessage;
