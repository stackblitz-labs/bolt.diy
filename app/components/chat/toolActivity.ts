import { getToolName, getToolOutput, getToolState } from '~/lib/persistence/messageMigration';
import { TOOL_EXECUTION_DENIED, TOOL_EXECUTION_ERROR, TOOL_NO_EXECUTE_FUNCTION } from '~/utils/constants';

export function getToolDisplayState(part: unknown) {
  const state = getToolState(part);
  const rawOutput = getToolOutput(part);
  const output = rawOutput && typeof rawOutput === 'object' ? (rawOutput as Record<string, unknown>) : {};

  if (
    state === 'output-error' ||
    state === 'output-denied' ||
    output.isError === true ||
    output.blocked === true ||
    [TOOL_EXECUTION_DENIED, TOOL_EXECUTION_ERROR, TOOL_NO_EXECUTE_FUNCTION].includes(rawOutput as any) ||
    (output.status === 'exited' && typeof output.exitCode === 'number' && output.exitCode !== 0)
  ) {
    return 'output-error';
  }

  if (
    state === 'output-available' &&
    output.status === 'running' &&
    ['project_run_command', 'project_get_process_output'].includes(getToolName(part) ?? '')
  ) {
    return 'process-running';
  }

  return state;
}

export function getToolDisplayError(part: unknown): string | undefined {
  if (getToolDisplayState(part) !== 'output-error') {
    return undefined;
  }

  const output = getToolOutput(part);

  if (output && typeof output === 'object') {
    if ('reason' in output && typeof output.reason === 'string') {
      return output.reason;
    }

    if ('error' in output && typeof output.error === 'string') {
      return output.error;
    }

    if ('exitCode' in output && typeof output.exitCode === 'number') {
      return `Command exited with code ${output.exitCode}.`;
    }
  }

  if (part && typeof part === 'object' && 'errorText' in part && typeof part.errorText === 'string') {
    return part.errorText;
  }

  return typeof output === 'string' ? output : 'Tool execution failed.';
}
