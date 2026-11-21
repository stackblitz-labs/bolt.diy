import { generateText, isStepCount, simulateReadableStream, streamText, toUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { createAgentLoopTools } from './agent-loop';
import { repairBuildToolCall } from './project-tool-input';
import { toSafeStreamErrorMessage } from '~/lib/.server/api/errors';
import type { AgentPlan } from '~/lib/common/agentLoop';
import type { AnyMessage } from '~/lib/persistence/messageMigration';

const plan: AgentPlan = {
  goal: 'Change the button',
  steps: ['Read', 'Patch', 'Run and verify'],
  criteria: [{ id: 'button', description: 'The requested button is present and checks pass.' }],
  requiresPreview: true,
};

const user: AnyMessage = { role: 'user', content: 'Change the button' };

const part = (name: string, output: Record<string, unknown>, id = name) => ({
  type: `tool-${name}`,
  toolCallId: id,
  state: 'output-available',
  output,
});
const verified: AnyMessage[] = [
  user,
  {
    role: 'assistant',
    parts: [
      part('agent_plan', { plan }),
      part('project_patch_file', { patched: true }, 'edit'),
      part(
        'project_run_command',
        { processId: 'server', purpose: 'run', status: 'running', previewReady: true },
        'run',
      ),
      part(
        'project_run_command',
        { processId: 'check', purpose: 'test', status: 'exited', exitCode: 0, previewReady: true },
        'check',
      ),
    ],
  },
];
const completion = {
  outcome: 'complete' as const,
  summary: 'Button updated and checks pass.',
  criteria: [{ id: 'button' }],
};

const executeOptions = { toolCallId: 'complete', messages: [], context: {} };

describe('agent plan and completion tools', () => {
  it('requires the plan tool first and enforces preview criteria for starter builds', async () => {
    const loop = createAgentLoopTools([user], true, true);
    expect(loop.prepareStep({ steps: [] })).toEqual({
      toolChoice: { type: 'tool', toolName: 'agent_plan' },
      activeTools: ['agent_plan'],
    });
    expect(await loop.tools.agent_plan.execute!({ ...plan, requiresPreview: false }, executeOptions)).toMatchObject({
      plan: { requiresPreview: true },
    });
  });

  it.each([
    {
      description: 'assigns stable IDs to plain-text criteria',
      criteria: ['Button is visible', 'Checks pass'],
      valid: true,
    },
    { description: 'rejects a blank criterion', criteria: ['Button is visible', '   '], valid: false },
  ])('$description in a streamed plan call', async ({ criteria, valid }) => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            {
              type: 'tool-call' as const,
              toolCallId: 'plan',
              toolName: 'agent_plan',
              input: JSON.stringify({ ...plan, criteria, requiresPreview: false }),
            },
            {
              type: 'finish' as const,
              finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, reasoning: 0, text: 1 },
              },
            },
          ],
        }),
      }),
    });

    const loop = createAgentLoopTools([user], true, true);

    const result = await streamText({
      model,
      prompt: 'Change the button.',
      tools: loop.tools,
      prepareStep: loop.prepareStep,
      repairToolCall: repairBuildToolCall,
      streamRetries: 0,
      stopWhen: isStepCount(1),
    });

    const chunks = await Array.fromAsync(
      toUIMessageStream({ stream: result.stream, onError: toSafeStreamErrorMessage }),
    );
    expect(model.doStreamCalls).toHaveLength(1);

    if (valid) {
      expect(chunks).toContainEqual(
        expect.objectContaining({
          type: 'tool-output-available',
          toolCallId: 'plan',
          output: {
            plan: {
              ...plan,
              criteria: [
                { id: 'criterion-1', description: 'Button is visible' },
                { id: 'criterion-2', description: 'Checks pass' },
              ],
            },
          },
        }),
      );
      expect(chunks.some((chunk) => chunk.type === 'tool-input-error')).toBe(false);
    } else {
      expect(chunks).toContainEqual(
        expect.objectContaining({
          type: 'tool-input-error',
          toolCallId: 'plan',
          errorText: expect.stringContaining('a unique id and a description'),
        }),
      );
      expect(chunks.some((chunk) => chunk.type === 'tool-output-available')).toBe(false);
    }
  });

  it('allows commands once a plan exists, before any file edit', () => {
    const loop = createAgentLoopTools(
      [user, { role: 'assistant', parts: [part('agent_plan', { plan })] }],
      true,
      true,
      ['project_read_file', 'project_run_command'],
    );
    expect(loop.prepareStep({ steps: [] }).activeTools).toEqual([
      'project_read_file',
      'project_run_command',
      'agent_plan',
      'agent_complete',
    ]);
  });

  it('enables edits and commands only after the plan is recorded, even after browser inspection', async () => {
    const loop = createAgentLoopTools(
      [
        user,
        {
          role: 'assistant',
          parts: [
            part('project_list_paths', { paths: ['src/App.tsx'] }),
            part('project_read_file', { path: 'src/App.tsx', content: '<button>Save</button>' }),
          ],
        },
      ],
      true,
      true,
      ['project_list_paths', 'project_read_file', 'project_write_file', 'project_run_command'],
    );

    const inspection = loop.prepareStep({ steps: [], initialInstructions: 'Base project instructions.' });
    expect(inspection.toolChoice).toBe('required');
    expect(inspection.activeTools).toEqual(['project_list_paths', 'project_read_file', 'agent_plan']);
    expect(inspection.instructions).toContain('completion criteria grounded in the existing project');

    const output = await loop.tools.agent_plan.execute!(plan, executeOptions);

    const editing = loop.prepareStep({
      steps: [
        {
          toolCalls: [{ toolName: 'agent_plan', toolCallId: 'plan', input: plan }],
          toolResults: [{ toolCallId: 'plan', output }],
        },
      ],
    });
    expect(editing.activeTools).toContain('project_write_file');
    expect(editing.activeTools).toContain('agent_complete');
    expect(editing.activeTools).toContain('project_run_command');
  });

  it('keeps commands available after exit 127 and later unrelated edit errors', () => {
    const loop = createAgentLoopTools(
      [
        user,
        {
          role: 'assistant',
          parts: [
            part('agent_plan', { plan }),
            part('project_replace_lines', { patched: true }),
            part('project_get_process_output', {
              command: 'npm run dev',
              purpose: 'run',
              exitCode: 127,
              isError: true,
            }),
            { type: 'tool-project_replace_lines', state: 'output-error' },
          ],
        },
      ],
      true,
      true,
      ['project_read_file', 'project_run_command', 'project_get_process_output'],
    );

    const next = loop.prepareStep({ steps: [], initialInstructions: 'Base instructions.' });
    expect(next.activeTools).toContain('project_run_command');
    expect(next.activeTools).toContain('project_get_process_output');
    expect(next.instructions).toContain('Recover the failed command');
  });

  it('rejects completion without actual run and test evidence', async () => {
    const loop = createAgentLoopTools(
      [
        user,
        {
          role: 'assistant',
          parts: [part('agent_plan', { plan }), part('project_patch_file', { patched: true }, 'edit')],
        },
      ],
      true,
      true,
    );
    expect(await loop.tools.agent_complete.execute!(completion, executeOptions)).toMatchObject({
      isError: true,
      completed: false,
      error: expect.stringContaining('purpose test'),
    });
  });

  it('requires every planned criterion and attaches successful tool-call evidence automatically', async () => {
    const loop = createAgentLoopTools(verified, true, true);

    for (const criteria of [[], [{ id: 'invented' }], [{ id: 'button' }, { id: 'button' }]]) {
      expect(await loop.tools.agent_complete.execute!({ ...completion, criteria }, executeOptions)).toMatchObject({
        isError: true,
        completed: false,
        error: expect.stringContaining('criterion'),
        availableEvidence: expect.arrayContaining(['edit', 'run', 'check']),
        plannedCriteria: ['button'],
      });
    }

    const completed = await loop.tools.agent_complete.execute!(
      {
        ...completion,
        criteria: [{ id: 'button', evidence: ['server-123', 'npm run build'] }],
      },
      executeOptions,
    );

    expect(completed).toMatchObject({
      completed: true,
      criteria: [{ id: 'button', evidence: ['edit', 'run', 'check'] }],
    });
  });

  it('supports a concrete blocked outcome without claiming success', async () => {
    const loop = createAgentLoopTools([user], true, true);

    const output = await loop.tools.agent_complete.execute!(
      { outcome: 'blocked', summary: 'Dependency registry is unavailable.', criteria: [] },
      executeOptions,
    );
    expect(output).toMatchObject({ completed: false, blocked: true });
    expect(
      loop.prepareStep({
        steps: [
          {
            toolCalls: [{ toolName: 'agent_complete', toolCallId: 'complete', input: {} }],
            toolResults: [{ toolCallId: 'complete', output }],
          },
        ],
      }),
    ).toEqual({ toolChoice: 'none' });
  });

  it('sees a server-executed plan in the next SDK step of the same request', async () => {
    const loop = createAgentLoopTools([user], true, true);
    const output = await loop.tools.agent_plan.execute!(plan, executeOptions);
    expect(
      loop.prepareStep({
        steps: [
          {
            toolCalls: [{ toolName: 'agent_plan', toolCallId: 'plan', input: plan }],
            toolResults: [{ toolCallId: 'plan', output }],
          },
        ],
      }),
    ).toEqual({ toolChoice: 'required' });
  });

  it('allows a final answer after successful completion within the real SDK loop', async () => {
    let call = 0;

    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        const completing = call++ === 0;
        return {
          content: completing
            ? [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'complete',
                  toolName: 'agent_complete',
                  input: JSON.stringify(completion),
                },
              ]
            : [{ type: 'text' as const, text: 'Updated the button. Checks passed.' }],
          finishReason: {
            unified: completing ? ('tool-calls' as const) : ('stop' as const),
            raw: completing ? 'tool_calls' : 'stop',
          },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, reasoning: 0, text: 1 },
          },
          warnings: [],
        };
      },
    });

    const loop = createAgentLoopTools(verified, true, true);

    const result = await generateText({
      model,
      prompt: 'Finish the verified change.',
      system: 'Base project instructions.',
      tools: loop.tools,
      prepareStep: loop.prepareStep,
      stopWhen: isStepCount(4),
    });
    expect(result.text).toBe('Updated the button. Checks passed.');
    expect(model.doGenerateCalls.map((call) => call.toolChoice)).toEqual([{ type: 'required' }, { type: 'none' }]);
    expect(result.steps[0].toolResults[0].output).toMatchObject({ completed: true });
    expect(result.steps).toHaveLength(2);
    expect(model.doGenerateCalls[1].prompt[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('completion gate accepted'),
    });
    expect(model.doGenerateCalls[1].prompt[0]).toMatchObject({
      content: expect.stringContaining('Base project instructions.'),
    });
  });
});
