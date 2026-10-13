import { describe, expect, it } from 'vitest';
import { getToolDisplayError, getToolDisplayState } from './toolActivity';

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
