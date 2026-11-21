import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { getToolDisplayError, getToolDisplayState, shouldContinueAfterToolResults } from './toolActivity';

describe('tool activity status', () => {
  it('shows application errors as failures even when the SDK says output-available', () => {
    const part = {
      type: 'tool-project_run_command',
      state: 'output-available',
      output: { isError: true, error: 'ENOENT' },
    };
    expect(getToolDisplayState(part)).toBe('output-error');
    expect(getToolDisplayError(part)).toBe('ENOENT');
  });

  it('distinguishes a started server from a completed command', () => {
    const part = { type: 'tool-project_run_command', state: 'output-available', output: { status: 'running' } };
    expect(getToolDisplayState(part)).toBe('process-running');
    expect(getToolDisplayState({ ...part, output: { status: 'exited', exitCode: 0 } })).toBe('output-available');
  });

  it('also recognizes failed exits in saved results without an isError field', () => {
    const part = {
      type: 'tool-project_get_process_output',
      state: 'output-available',
      output: { status: 'exited', exitCode: 1 },
    };
    expect(getToolDisplayState(part)).toBe('output-error');
    expect(getToolDisplayError(part)).toBe('Command exited with code 1.');
  });

  it('shows a blocked task as unresolved with its concrete reason', () => {
    const part = {
      type: 'tool-agent_complete',
      state: 'output-available',
      output: { completed: false, blocked: true, reason: 'Registry unavailable.' },
    };
    expect(getToolDisplayState(part)).toBe('output-error');
    expect(getToolDisplayError(part)).toBe('Registry unavailable.');
  });
});

describe('tool result continuation', () => {
  const invalid: UIMessage['parts'][number] = {
    type: 'dynamic-tool',
    toolName: 'project_read_file',
    toolCallId: 'invalid',
    state: 'output-error',
    input: {},
    errorText: 'Missing path.',
  };
  const completed: UIMessage['parts'][number] = {
    type: 'tool-project_list_paths',
    toolCallId: 'completed',
    state: 'output-available',
    input: {},
    output: { entries: [] },
  };
  const shouldContinue = (parts: UIMessage['parts']) =>
    shouldContinueAfterToolResults({ messages: [{ role: 'assistant', id: 'reply', parts }] });

  it('does not restart a request after the server stops on an invalid call', () => {
    expect(shouldContinue([completed, { type: 'step-start' }, invalid])).toBe(false);
  });

  it('continues after the browser supplies a result for a valid call in the same step', () => {
    expect(shouldContinue([invalid, completed])).toBe(true);
  });
});
