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
    messages.push(msg);
  }
  return messages;
}

export default mergeResponseMessage;
