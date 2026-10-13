import { tool, type Instructions } from 'ai';
import { z } from 'zod';
import { getAgentCompletionProblems, getAgentLoopInstructions, getAgentLoopProgress } from '~/lib/common/agentLoop';
import type { AnyMessage } from '~/lib/persistence/messageMigration';

const planSchema = z
  .object({
    goal: z.string().min(1).max(500),
    steps: z.array(z.string().min(1).max(250)).min(1).max(6),
    criteria: z
      .array(z.object({ id: z.string().min(1).max(40), description: z.string().min(1).max(400) }))
      .min(1)
      .max(8),
    requiresPreview: z.boolean(),
  })
  .refine(
    (plan) => new Set(plan.criteria.map((criterion) => criterion.id)).size === plan.criteria.length,
    'Criterion IDs must be unique.',
  );

/** Plan and completion tools execute on the server; project effects remain in the browser. */
export function createAgentLoopTools(messages: AnyMessage[], enabled: boolean, requiresPreview: boolean) {
  let currentMessages = messages;

  const tools = {
    agent_plan: tool({
      description:
        'Record a concise task plan and observable completion criteria before editing. Use stable criterion IDs. Require a preview for a web app, and preserve the existing project on follow-up requests.',
      inputSchema: planSchema,
      execute: async (plan) => ({ plan: { ...plan, requiresPreview: requiresPreview || plan.requiresPreview } }),
    }),
    agent_complete: tool({
      description:
        'Finish the current task only after running it and passing relevant checks after the latest edit. Report each planned criterion with real tool-call evidence. Use outcome blocked with a concrete reason if completion is impossible.',
      inputSchema: z.object({
        outcome: z.enum(['complete', 'blocked']),
        summary: z.string().min(1).max(1000),
        criteria: z
          .array(
            z.object({ id: z.string().min(1).max(40), evidence: z.array(z.string().min(1).max(256)).min(1).max(20) }),
          )
          .max(8),
      }),
      execute: async (input) => {
        if (input.outcome === 'blocked') {
          return { completed: false, blocked: true, reason: input.summary };
        }

        const progress = getAgentLoopProgress(currentMessages, enabled);
        const problems = getAgentCompletionProblems(progress);

        for (const criterion of progress.plan?.criteria ?? []) {
          const report = input.criteria.find((item) => item.id === criterion.id);

          if (
            !report ||
            report.evidence.length === 0 ||
            !report.evidence.every((id) => progress.evidence.includes(id))
          ) {
            problems.push(`Criterion ${criterion.id} needs valid successful tool-call evidence.`);
          }
        }

        if (problems.length > 0) {
          return { isError: true, completed: false, problems, error: problems.join(' ') };
        }

        return { completed: true, summary: input.summary, criteria: input.criteria };
      },
    }),
  };

  return {
    tools,
    prepareStep: ({
      steps,
      initialInstructions,
    }: {
      steps: Array<{
        toolCalls: Array<{ toolName: string; toolCallId: string; input: unknown }>;
        toolResults: Array<{ toolCallId: string; output: unknown }>;
      }>;
      initialInstructions?: Instructions;
    }) => {
      currentMessages = [
        ...messages,
        ...steps.map((step) => ({
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            ...step.toolCalls.map((call) => {
              const result = step.toolResults.find((result) => result.toolCallId === call.toolCallId);
              return {
                type: `tool-${call.toolName}`,
                toolCallId: call.toolCallId,
                input: call.input,
                state: result ? 'output-available' : 'input-available',
                output: result?.output,
              };
            }),
          ],
        })),
      ];

      const progress = getAgentLoopProgress(currentMessages, enabled);
      const guidance = getAgentLoopInstructions(progress);

      const instructions =
        initialInstructions === undefined
          ? {}
          : {
              instructions:
                typeof initialInstructions === 'string'
                  ? `${initialInstructions}\n\nCurrent agent loop state:\n${guidance}`
                  : [
                      ...(Array.isArray(initialInstructions) ? initialInstructions : [initialInstructions]),
                      { role: 'system' as const, content: guidance },
                    ],
            };

      if (['blocked', 'limited', 'ready'].includes(progress.status)) {
        return { ...instructions, toolChoice: 'none' as const };
      }

      if (progress.status === 'inactive') {
        return { ...instructions, toolChoice: 'auto' as const };
      }

      return {
        ...instructions,
        toolChoice: 'required' as const,
        ...(!progress.plan ? { activeTools: ['agent_plan' as const] } : {}),
      };
    },
  };
}
