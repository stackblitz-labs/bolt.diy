export function shouldPreserveChatMessagesOnRefresh(options: {
  chatChanged: boolean;
  currentMessageCount: number;
  storedMessageCount: number;
  hasAppliedInitialMessages: boolean;
}): boolean {
  return (
    options.hasAppliedInitialMessages &&
    !options.chatChanged &&
    options.currentMessageCount > 0 &&
    options.storedMessageCount > 0
  );
}
