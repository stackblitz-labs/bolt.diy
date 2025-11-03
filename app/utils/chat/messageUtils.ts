import type { Message } from '~/lib/persistence/message';

let gLastChatMessages: Message[] | undefined;

export function getLastChatMessages() {
  return gLastChatMessages;
}

export function setLastChatMessages(messages: Message[] | undefined) {
  gLastChatMessages = messages;
}
