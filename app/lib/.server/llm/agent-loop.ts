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
export function createAgentLoopTools<TaskToolName extends string = never>(
  messages: AnyMessage[],
  enabled: boolean,
  requiresPreview: boolean,
  taskToolNames?: TaskToolName[],
) {
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
        'Finish the current task only after running it and passing relevant checks after the latest edit. Report every planned criterion by its exact ID. The server attaches evidence from successful project tool calls automatically; do not provide process IDs, command names, or guessed evidence IDs. Use outcome blocked with a concrete reason if completion is impossible.',
      inputSchema: z.object({
        outcome: z.enum(['complete', 'blocked']),
        summary: z.string().min(1).max(1000),
        criteria: z
          .array(
            z.object({
              id: z.string().min(1).max(40),
              evidence: z.array(z.string().min(1).max(256)).max(20).optional(),
            }),
          )
          .max(8),
      }),
      execute: async (input) => {
        if (input.outcome === 'blocked') {
          return { completed: false, blocked: true, reason: input.summary };
        }

        const progress = getAgentLoopProgress(currentMessages, enabled);
        const problems = getAgentCompletionProblems(progress);
        const plannedCriteria = progress.plan?.criteria ?? [];
        const plannedIds = new Set(plannedCriteria.map((criterion) => criterion.id));
        const reportedIds = new Set(input.criteria.map((criterion) => criterion.id));

        if (reportedIds.size !== input.criteria.length) {
          problems.push('Report each planned criterion exactly once.');
        }

        for (const criterion of plannedCriteria) {
          if (!reportedIds.has(criterion.id)) {
            problems.push(`Report planned criterion ${criterion.id} by its exact ID.`);
          }
        }

        for (const criterion of input.criteria) {
          if (!plannedIds.has(criterion.id)) {
            problems.push(`Criterion ${criterion.id} is not in the recorded plan.`);
          }
        }

        if (progress.evidence.length === 0) {
          problems.push('Successful project tool-call evidence is missing.');
        }

        if (problems.length > 0) {
          return {
            isError: true,
            completed: false,
            problems,
            availableEvidence: progress.evidence,
            plannedCriteria: progress.plan?.criteria.map((criterion) => criterion.id) ?? [],
            error: problems.join(' '),
          };
        }

        return {
          completed: true,
          summary: input.summary,
          criteria: plannedCriteria.map((criterion) => ({ id: criterion.id, evidence: progress.evidence })),
        };
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
        toolCalls: Array<{ toolName: string; toolCallId: string; input: unknown; invalid?: boolean }>;
        toolResults: Array<{ toolCallId: string; output: unknown }>;
      }>;
      initialInstructions?: Instructions;
    }): {
      instructions?: Instructions;
      toolChoice: 'none' | 'auto' | 'required' | { type: 'tool'; toolName: 'agent_plan' };
      activeTools?: Array<TaskToolName | 'agent_plan' | 'agent_complete'>;
    } => {
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
                state: result ? 'output-available' : call.invalid ? 'output-error' : 'input-available',
                output: result?.output,
              };
            }),
          ],
        })),
      ];

      const progress = getAgentLoopProgress(currentMessages, enabled);

      const guidance = [
        getAgentLoopInstructions(progress),
        progress.status === 'pending'
          ? 'Use the supplied tools interface to make actual tool calls. Never print tool-call JSON or a promise to act in place of calling a tool. Follow each tool input schema exactly.'
          : '',
      ]
        .filter(Boolean)
        .join('\n');

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

      if (!progress.plan) {
        return {
          ...instructions,
          toolChoice: { type: 'tool' as const, toolName: 'agent_plan' as const },
          activeTools: ['agent_plan' as const],
        };
      }

      const editingTools = new Set([
        'project_read_file',
        'project_write_file',
        'project_patch_file',
        'project_create_directory',
        'project_list_paths',
        'project_search_content',
        'project_find_related_files',
        'web_search',
        'web_fetch',
      ]);

      const activeProjectTools = taskToolNames?.filter((toolName) => {
        return progress.needsRepair || !progress.edited ? editingTools.has(toolName) : true;
      });

      return {
        ...instructions,
        toolChoice: 'required' as const,
        ...(taskToolNames
          ? {
              activeTools: [...activeProjectTools!, 'agent_plan' as const, 'agent_complete' as const],
            }
          : {}),
      };
    },
  };
}
