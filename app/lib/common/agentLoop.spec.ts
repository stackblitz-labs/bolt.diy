import { describe, expect, it } from 'vitest';
import {
  getAgentCompletionProblems,
  getAgentLoopInstructions,
  getAgentLoopProgress,
  MAX_AGENT_STEPS,
  type AgentPlan,
} from './agentLoop';
import type { AnyMessage } from '~/lib/persistence/messageMigration';

const plan: AgentPlan = {
  goal: 'Change the button',
  steps: ['Inspect', 'Patch', 'Run and check'],
  criteria: [{ id: 'button', description: 'The requested button is present and checks pass.' }],
  requiresPreview: true,
};

const user: AnyMessage = { role: 'user', content: 'Change the button' };

function result(name: string, output: Record<string, unknown>, id = name) {
  return { type: `tool-${name}`, toolCallId: id, state: 'output-available', output };
}

function response(...parts: Record<string, unknown>[]): AnyMessage {
  return { role: 'assistant', parts };
}

const planned = result('agent_plan', { plan });
const edited = result('project_patch_file', { patched: true, changed: true }, 'edit');

const run = result(
  'project_run_command',
  { processId: 'server', purpose: 'run', status: 'running', previewReady: true },
  'run',
);
const test = result(
  'project_run_command',
  { processId: 'check', purpose: 'test', status: 'exited', exitCode: 0, previewReady: true },
  'test',
);

const complete = result('agent_complete', { completed: true });
const verifiedMessages = [user, response(planned, edited, run, test)];

describe('agent build loop', () => {
  it('requires a recorded plan, real execution, passing verification and explicit completion', () => {
    const initial = getAgentLoopProgress([user, response({ type: 'text', text: 'I will build it.' })], true);
    expect(initial.status).toBe('pending');
    expect(getAgentCompletionProblems(initial)).toHaveLength(3);

    const verified = getAgentLoopProgress(verifiedMessages, true);
    expect(verified).toMatchObject({ status: 'pending', edited: true, ran: true, tested: true, previewReady: true });
    expect(getAgentCompletionProblems(verified)).toEqual([]);
    expect(getAgentLoopProgress([...verifiedMessages, response(complete)], true).status).toBe('ready');
  });

  it('does not treat a started check or an install as passing verification', () => {
    for (const output of [
      { processId: 'test', purpose: 'test', status: 'running' },
      { processId: 'install', purpose: 'install', status: 'exited', exitCode: 0 },
    ]) {
      const progress = getAgentLoopProgress(
        [user, response(planned, edited, run, result('project_run_command', output), complete)],
        true,
      );
      expect(progress.tested).toBe(false);
      expect(progress.status).toBe('pending');
    }
  });

  it('repairs failed checks and requires a fresh passing result after the repair', () => {
    const failed = result('project_run_command', {
      processId: 'bad',
      purpose: 'test',
      status: 'exited',
      exitCode: 1,
      isError: true,
    });

    const messages = [user, response(planned, edited, run, failed, edited)];
    expect(getAgentLoopProgress(messages, true).tested).toBe(false);
    expect(getAgentLoopProgress([...messages, response(test, complete)], true).status).toBe('ready');
  });

  it('invalidates passing verification and completion after any subsequent change', () => {
    const messages = [...verifiedMessages, response(complete, edited)];
    expect(getAgentLoopProgress(messages, true)).toMatchObject({ tested: false, status: 'pending' });
    expect(getAgentLoopProgress([...messages, response(test, complete)], true).status).toBe('ready');
  });

  it('rejects a check started before an edit even if it finishes afterward', () => {
    const started = result('project_run_command', { processId: 'check', purpose: 'test', status: 'running' });

    const polled = result('project_get_process_output', {
      processId: 'check',
      purpose: 'test',
      status: 'exited',
      exitCode: 0,
    });

    const progress = getAgentLoopProgress([user, response(planned, started, edited, run, polled, complete)], true);
    expect(progress.tested).toBe(false);
    expect(progress.status).toBe('pending');
  });

  it('requires a check after execution and does not complete after stopping the app', () => {
    const nonWebPlan = result('agent_plan', { plan: { ...plan, requiresPreview: false } });
    const earlyTest = { ...test, output: { ...test.output, previewReady: false } };

    const programRun = result('project_run_command', {
      processId: 'program',
      purpose: 'run',
      status: 'exited',
      exitCode: 0,
    });
    expect(
      getAgentLoopProgress([user, response(nonWebPlan, edited, earlyTest, programRun, complete)], true).tested,
    ).toBe(false);
    expect(
      getAgentLoopProgress([user, response(nonWebPlan, edited, programRun, earlyTest, complete)], true).status,
    ).toBe('ready');
    expect(
      getAgentLoopProgress(
        [
          ...verifiedMessages,
          response(complete, result('project_stop_process', { processId: 'server', stopped: true, purpose: 'run' })),
        ],
        true,
      ).status,
    ).toBe('pending');
  });

  it('invalidates a non-web program run after edits', () => {
    const progress = getAgentLoopProgress(
      [
        user,
        response(
          result('agent_plan', { plan: { ...plan, requiresPreview: false } }),
          result('project_run_command', { processId: 'script', purpose: 'run', status: 'exited', exitCode: 0 }),
          edited,
          { ...test, output: { ...test.output, previewReady: false } },
          complete,
        ),
      ],
      true,
    );
    expect(progress.ran).toBe(false);
    expect(progress.status).toBe('pending');
  });

  it('requires preview readiness for a web app and notices a stopped preview', () => {
    const progress = getAgentLoopProgress(
      [
        ...verifiedMessages,
        response(
          complete,
          result('project_get_process_output', {
            processId: 'server',
            purpose: 'run',
            previewReady: false,
            status: 'exited',
            exitCode: 1,
          }),
        ),
      ],
      true,
    );
    expect(progress.previewReady).toBe(false);
    expect(progress.status).toBe('pending');
    expect(getAgentCompletionProblems(progress)).toContain('Confirm a running preview.');
  });

  it('does not force unnecessary edits when a request is already satisfied', () => {
    const progress = getAgentLoopProgress(
      [
        user,
        response(
          planned,
          result('project_read_file', { content: 'requested button already present' }),
          run,
          test,
          complete,
        ),
      ],
      true,
    );
    expect(progress).toMatchObject({ edited: false, status: 'ready' });
  });

  it('no-op patches preserve verification while plan revisions invalidate completion', () => {
    expect(
      getAgentLoopProgress(
        [...verifiedMessages, response(result('project_patch_file', { patched: true, changed: false }), complete)],
        true,
      ).status,
    ).toBe('ready');
    expect(getAgentLoopProgress([...verifiedMessages, response(complete, planned)], true).status).toBe('pending');
  });

  it('excludes failed and unfinished command evidence', () => {
    const progress = getAgentLoopProgress(
      [
        user,
        response(
          result('project_run_command', { processId: 'pending', status: 'running' }, 'pending'),
          result('project_patch_file', { isError: true }, 'failed'),
          result('project_read_file', { content: 'source' }, 'read'),
        ),
      ],
      true,
    );
    expect(progress.evidence).toEqual(['read']);
  });

  it('isolates each follow-up from previous plans, changes and checks', () => {
    expect(
      getAgentLoopProgress(
        [...verifiedMessages, response(complete), { role: 'user', content: 'Move the microphone' }],
        true,
      ),
    ).toMatchObject({ status: 'pending', plan: undefined, tested: false, edited: false, steps: 0, evidence: [] });
  });

  it('keeps informational requests and disabled agent mode outside the build loop', () => {
    expect(getAgentLoopProgress([{ role: 'user', content: 'Explain this component' }], true).status).toBe('inactive');
    expect(getAgentLoopProgress([user], false).status).toBe('inactive');
  });

  it('bounds the task across browser continuation requests and respects denial', () => {
    const messages = [
      user,
      ...Array.from({ length: MAX_AGENT_STEPS }, () =>
        response({ type: 'step-start' }, result('project_read_file', { content: 'source' })),
      ),
    ];
    expect(getAgentLoopProgress(messages, true).status).toBe('limited');

    const denied = getAgentLoopProgress(
      [user, response({ type: 'tool-project_run_command', toolCallId: 'denied', state: 'output-denied' })],
      true,
    );
    expect(denied.status).toBe('blocked');
    expect(getAgentLoopInstructions(denied)).toContain('without claiming success');
  });

  it('rejects completion while project operations are still pending', () => {
    const progress = getAgentLoopProgress(
      [
        ...verifiedMessages,
        response({ type: 'tool-project_patch_file', toolCallId: 'pending', state: 'input-available' }, complete),
      ],
      true,
    );
    expect(progress.status).toBe('pending');
    expect(getAgentCompletionProblems(progress)).toContain('Wait for pending project tool results before completing.');
  });
});
