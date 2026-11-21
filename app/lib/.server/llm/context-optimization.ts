/** Native agents read files through tools; summaries would add calls and replace their exact tool history. */
export function shouldOptimizeRequestContext({
  enabled,
  agentLoopEnabled,
  isInitialTemplateRequest,
  hasFiles,
}: {
  enabled: boolean | undefined;
  agentLoopEnabled: boolean;
  isInitialTemplateRequest: boolean;
  hasFiles: boolean;
}): boolean {
  return Boolean(enabled && hasFiles && !agentLoopEnabled && !isInitialTemplateRequest);
}

export function getRecentChatStart(messages: ReadonlyArray<{ role: string }>) {
  const recentStart = Math.max(0, messages.length - 3);
  const lastUser = messages.findLastIndex((message) => message.role === 'user');

  // Keep the active user request together with its tool calls and results.
  return lastUser === -1 ? recentStart : Math.min(recentStart, lastUser);
}
