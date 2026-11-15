import { describe, expect, it } from 'vitest';
import {
  getStarterBuildInstructions,
  getStarterBuildProgress,
  getStarterBuildToolChoice,
  MAX_STARTER_BUILD_STEPS,
  STARTER_BUILD_FLAG,
} from './starterBuild';
import type { AnyMessage } from '~/lib/persistence/messageMigration';

const handoff: AnyMessage = {
  role: 'user',
  metadata: { flags: ['hidden', STARTER_BUILD_FLAG] },
  parts: [{ type: 'text', text: 'Continue the original request.' }],
};

function response(...parts: Record<string, unknown>[]): AnyMessage {
  return { role: 'assistant', parts };
}

function result(name: string, output: Record<string, unknown>) {
  return { type: `tool-${name}`, toolCallId: name, state: 'output-available', output };
}

describe('starter build continuation', () => {
  it('requires action after the exact text-only promise that previously stopped the build', () => {
    const progress = getStarterBuildProgress([
      handoff,
      response({ type: 'text', text: "I'll create a stunning landing page. Let me build this out." }),
    ]);
    expect(progress.status).toBe('pending');
    expect(getStarterBuildToolChoice(progress)).toBe('required');
    expect(getStarterBuildInstructions(progress)).toContain('make a real tool call');
  });

  it('continues after reads or edits while the preview is still missing', () => {
    expect(
      getStarterBuildProgress([handoff, response(result('project_read_file', { content: 'starter' }))]).status,
    ).toBe('pending');

    const edited = getStarterBuildProgress([
      handoff,
      response(
        result('project_write_file', { written: true }),
        result('project_run_command', { status: 'running', previewReady: false }),
      ),
    ]);
    expect(edited.edited).toBe(true);
    expect(edited.status).toBe('pending');
  });

  it('allows the final answer after actual edits and a confirmed live preview', () => {
    const progress = getStarterBuildProgress([
      handoff,
      response(
        result('project_patch_file', { patched: true }),
        result('project_get_process_output', { status: 'running', previewReady: true }),
      ),
    ]);
    expect(progress.status).toBe('ready');
    expect(getStarterBuildToolChoice(progress)).toBe('auto');
  });

  it('does not count failed edits or a failed process as completion', () => {
    const progress = getStarterBuildProgress([
      handoff,
      response(
        result('project_write_file', { isError: true, written: true }),
        result('project_get_process_output', { previewReady: true, exitCode: 1 }),
      ),
    ]);
    expect(progress.edited).toBe(false);
    expect(progress.previewReady).toBe(false);
    expect(progress.status).toBe('pending');
  });

  it('stops forcing tool calls when the user denies an operation', () => {
    const progress = getStarterBuildProgress([
      handoff,
      response(result('project_run_command', { isError: true, denied: true })),
    ]);
    expect(progress.status).toBe('denied');
    expect(getStarterBuildToolChoice(progress)).toBe('auto');
  });

  it('bounds the continuation across browser tool-result requests, not just each HTTP request', () => {
    const steps = Array.from({ length: MAX_STARTER_BUILD_STEPS }, (_, index) => [
      { type: 'step-start' },
      { ...result('project_read_file', { content: 'starter' }), toolCallId: `call-${index}` },
    ]).flat();

    const progress = getStarterBuildProgress([handoff, response(...steps)]);
    expect(progress.status).toBe('limited');
    expect(getStarterBuildToolChoice(progress)).toBe('none');
    expect(getStarterBuildInstructions(progress)).toContain('unfinished work');
  });

  it('counts parallel calls as one model step', () => {
    const progress = getStarterBuildProgress([
      handoff,
      response({ type: 'step-start' }, result('project_read_file', {}), result('project_list_paths', {})),
    ]);
    expect(progress.steps).toBe(1);
  });

  it('leaves discussion and later user requests unaffected', () => {
    const progress = getStarterBuildProgress([handoff, { role: 'user', content: 'Explain how this works' }]);
    expect(progress.status).toBe('inactive');
    expect(getStarterBuildToolChoice(progress)).toBe('auto');
  });

  it('recognizes older template handoffs without the new metadata flag', () => {
    expect(
      getStarterBuildProgress([
        { role: 'user', content: 'Now that the Template is imported please continue with my original request' },
      ]).status,
    ).toBe('pending');
  });
});
