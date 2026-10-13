import {
  getMessageFlags,
  getMessageParts,
  getMessageText,
  getToolName,
  getToolOutput,
  getToolState,
  type AnyMessage,
} from '~/lib/persistence/messageMigration';

export const STARTER_BUILD_FLAG = 'starter-build';
export const MAX_STARTER_BUILD_STEPS = 12;

const LEGACY_STARTER_MARKER = 'Now that the Template is imported please continue with my original request';

/** Track the starter handoff from tool evidence, across browser tool-result requests. */
export function getStarterBuildProgress(messages: AnyMessage[]) {
  const userIndex = messages.findLastIndex((message) => message.role === 'user');
  const user = messages[userIndex];

  if (
    !user ||
    (!getMessageFlags(user).includes(STARTER_BUILD_FLAG) && !getMessageText(user).includes(LEGACY_STARTER_MARKER))
  ) {
    return { status: 'inactive' as const, edited: false, previewReady: false, steps: 0 };
  }

  let edited = false;
  let previewReady = false;
  let denied = false;
  let steps = 0;

  for (const message of messages.slice(userIndex + 1)) {
    if (message.role !== 'assistant') {
      continue;
    }

    const parts = getMessageParts(message) ?? [];
    const stepCount = parts.filter((part) => part.type === 'step-start').length;
    const calls = parts.filter((part) => getToolName(part) !== undefined);
    steps += stepCount || (calls.length > 0 ? 1 : 0);

    for (const part of calls) {
      const name = getToolName(part);
      const output = getToolOutput(part) as Record<string, unknown> | undefined;
      const state = getToolState(part);
      denied ||= state === 'output-denied' || output?.denied === true;

      if (
        state !== 'output-available' ||
        !output ||
        output.isError === true ||
        (typeof output.exitCode === 'number' && output.exitCode !== 0)
      ) {
        continue;
      }

      edited ||=
        (name === 'project_write_file' && output.written === true) ||
        (name === 'project_patch_file' && output.patched === true);
      previewReady ||=
        (name === 'project_run_command' || name === 'project_get_process_output') && output.previewReady === true;
    }
  }

  const status = denied
    ? ('denied' as const)
    : edited && previewReady
      ? ('ready' as const)
      : steps >= MAX_STARTER_BUILD_STEPS
        ? ('limited' as const)
        : ('pending' as const);

  return { status, edited, previewReady, steps };
}

export function getStarterBuildToolChoice(progress: ReturnType<typeof getStarterBuildProgress>) {
  if (progress.status === 'pending') {
    return 'required' as const;
  }

  return progress.status === 'limited' ? ('none' as const) : ('auto' as const);
}

export function getStarterBuildInstructions(progress: ReturnType<typeof getStarterBuildProgress>): string {
  if (progress.status === 'inactive' || progress.status === 'ready') {
    return '';
  }

  if (progress.status === 'denied') {
    return 'The user declined a tool operation. Respect that decision and explain any work that remains unfinished.';
  }

  if (progress.status === 'limited') {
    return `The starter build reached its ${MAX_STARTER_BUILD_STEPS}-step limit. Stop using tools and summarize the actual progress and unfinished work. Do not claim the requested app is complete.`;
  }

  return `The starter is only the initial project, and the original build request is still unfinished.
Confirmed project changes: ${progress.edited ? 'yes' : 'no'}. Confirmed running preview: ${progress.previewReady ? 'yes' : 'no'}.
Continue implementing the original request through the available tools. A promise or plan alone is not completion: make a real tool call in this response. Once changes are implemented, install dependencies if needed, start the app, and inspect process output until previewReady is true. Keep using the existing process ID while it is running; do not start duplicate installs or servers. You have at most ${MAX_STARTER_BUILD_STEPS - progress.steps} model steps remaining for this starter build.`;
}
