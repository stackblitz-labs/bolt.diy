import { generateText, isStepCount } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { createAgentLoopTools } from './agent-loop';
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
  criteria: [{ id: 'button', evidence: ['edit', 'check'] }],
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

  it('withholds completion until run and test evidence exist', () => {
    const loop = createAgentLoopTools(
      [user, { role: 'assistant', parts: [part('agent_plan', { plan })] }],
      true,
      true,
      ['project_read_file', 'project_run_command'],
    );
    expect(loop.prepareStep({ steps: [] }).activeTools).toEqual(['project_read_file', 'agent_plan', 'agent_complete']);
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

  it('requires valid evidence for every criterion and excludes failed tool calls', async () => {
    const loop = createAgentLoopTools(verified, true, true);

    for (const criteria of [[], [{ id: 'button', evidence: ['invented'] }]]) {
      expect(await loop.tools.agent_complete.execute!({ ...completion, criteria }, executeOptions)).toMatchObject({
        isError: true,
        completed: false,
        error: expect.stringContaining('Criterion button'),
        availableEvidence: expect.arrayContaining(['edit', 'run', 'check']),
        plannedCriteria: ['button'],
      });
    }
    expect(await loop.tools.agent_complete.execute!(completion, executeOptions)).toMatchObject({ completed: true });
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
