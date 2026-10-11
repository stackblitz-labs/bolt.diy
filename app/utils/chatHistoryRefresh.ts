export function shouldPreserveChatMessagesOnRefresh(options: {
  chatChanged: boolean;
  currentMessageCount: number;
  storedMessageCount: number;
}): boolean {
  return !options.chatChanged && options.currentMessageCount > 0 && options.storedMessageCount > 0;
}
