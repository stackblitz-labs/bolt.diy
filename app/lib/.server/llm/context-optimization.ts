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
