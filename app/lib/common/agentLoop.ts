import {
  getMessageParts,
  getMessageText,
  getToolCallId,
  getToolInput,
  getToolName,
  getToolOutput,
  getToolState,
  type AnyMessage,
} from '~/lib/persistence/messageMigration';

export const MAX_AGENT_STEPS = 32;

export interface AgentPlan {
  goal: string;
  steps: string[];
  criteria: Array<{ id: string; description: string }>;
  requiresPreview: boolean;
}

export function isAgentPlan(value: unknown): value is AgentPlan {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const plan = value as Partial<AgentPlan>;

  return (
    typeof plan.goal === 'string' &&
    Array.isArray(plan.steps) &&
    plan.steps.every((step) => typeof step === 'string') &&
    Array.isArray(plan.criteria) &&
    plan.criteria.length > 0 &&
    plan.criteria.every(
      (criterion) => typeof criterion?.id === 'string' && typeof criterion.description === 'string',
    ) &&
    typeof plan.requiresPreview === 'boolean'
  );
}

export function getAgentLoopProgress(messages: AnyMessage[], enabled: boolean) {
  const userIndex = messages.findLastIndex((message) => message.role === 'user');

  const text =
    userIndex >= 0
      ? getMessageText(messages[userIndex])
          .replace(/\[(?:Model|Provider):[^\]]*\]/g, '')
          .trim()
      : '';
  const informational =
    /^(?:(?:please|can you|could you)\s+)*(?:explain|tell me|what|where|when|why|how|which|who|find|search|research)\b/i.test(
      text,
    ) && !/\b(?:build|create|implement|make|add|change|edit|fix|update|remove|move|replace|refactor)\b/i.test(text);

  let plan: AgentPlan | undefined;
  let lastEdit = -1;
  let lastFailure = -1;
  let lastPassingTest = -1;
  let lastRun = -1;
  let lastPlan = -1;
  let previewReady = false;
  let denied = false;
  let completedAt = -1;
  let blocked = false;
  let steps = 0;
  let position = 0;

  const evidence: string[] = [];
  const starts = new Map<string, number>();

  let pendingProjectCalls = false;

  for (const message of messages.slice(userIndex + 1)) {
    if (message.role !== 'assistant') {
      continue;
    }

    const parts = getMessageParts(message) ?? [];
    steps +=
      parts.filter((part) => part.type === 'step-start').length || (parts.some((part) => getToolName(part)) ? 1 : 0);

    for (const part of parts) {
      const name = getToolName(part);

      if (!name) {
        continue;
      }

      position++;

      const output = getToolOutput(part) as Record<string, unknown> | undefined;
      const state = getToolState(part);
      denied ||= state === 'output-denied' || output?.denied === true;

      if (
        name.startsWith('project_') &&
        (state === 'input-available' || state === 'input-streaming' || state === 'approval-requested')
      ) {
        pendingProjectCalls = true;
      }

      if (name.startsWith('project_') && state === 'output-error') {
        lastFailure = position;
      }

      if (state !== 'output-available' || !output) {
        continue;
      }

      if (name === 'agent_complete' && output.blocked === true) {
        blocked = true;
      }

      const failed = output.isError === true || (typeof output.exitCode === 'number' && output.exitCode !== 0);
      const commandResult = name === 'project_run_command' || name === 'project_get_process_output';

      if (commandResult && typeof output.previewReady === 'boolean') {
        previewReady = output.previewReady;
      }

      if (name === 'project_stop_process' && output.stopped === true && output.purpose === 'run') {
        previewReady = false;
      }

      if (failed) {
        if (name.startsWith('project_')) {
          lastFailure = position;
        }

        continue;
      }

      if (name === 'agent_plan' && isAgentPlan(output.plan)) {
        plan = output.plan;
        lastPlan = position;
      }

      if (name === 'agent_complete' && output.completed === true) {
        completedAt = position;
      }

      if (name === 'project_write_file' || name === 'project_patch_file' || name === 'project_delete_path') {
        if (
          output.changed !== false &&
          (output.written === true || output.patched === true || output.deleted === true)
        ) {
          lastEdit = position;
        }
      }

      const processId = typeof output.processId === 'string' ? output.processId : undefined;

      if (name === 'project_run_command' && processId) {
        starts.set(processId, position);
      }

      if (commandResult) {
        const input = getToolInput(part) as Record<string, unknown> | undefined;
        const purpose = output.purpose ?? (name === 'project_run_command' ? input?.purpose : undefined);
        const startedAt = processId ? starts.get(processId) : undefined;

        if (
          purpose === 'run' &&
          output.status === 'exited' &&
          output.exitCode === 0 &&
          startedAt !== undefined &&
          startedAt > lastEdit
        ) {
          lastRun = position;
        }

        if (
          purpose === 'test' &&
          output.status === 'exited' &&
          output.exitCode === 0 &&
          startedAt !== undefined &&
          startedAt > lastEdit &&
          startedAt > lastFailure &&
          (lastRun > lastEdit || previewReady)
        ) {
          lastPassingTest = position;
        }
      }

      const id = getToolCallId(part);

      if (id && name.startsWith('project_') && (output.status !== 'running' || output.previewReady === true)) {
        evidence.push(id);
      }
    }
  }

  const tested = lastPassingTest > lastEdit && lastPassingTest > lastFailure && lastPassingTest >= 0;
  const active = enabled && userIndex >= 0 && !informational;
  const ran = (lastRun > lastEdit && lastRun >= 0) || previewReady;

  const completed =
    completedAt > lastPlan &&
    completedAt > lastEdit &&
    completedAt > lastFailure &&
    tested &&
    ran &&
    Boolean(plan) &&
    (!plan?.requiresPreview || previewReady) &&
    !pendingProjectCalls;
  const status = !active
    ? 'inactive'
    : denied || blocked
      ? 'blocked'
      : completed
        ? 'ready'
        : steps >= MAX_AGENT_STEPS
          ? 'limited'
          : 'pending';

  return { status, plan, edited: lastEdit >= 0, ran, previewReady, tested, steps, evidence, pendingProjectCalls };
}

export function getAgentCompletionProblems(progress: ReturnType<typeof getAgentLoopProgress>) {
  const problems: string[] = [];

  if (progress.status === 'inactive') {
    problems.push('There is no active build task.');
  }

  if (progress.pendingProjectCalls) {
    problems.push('Wait for pending project tool results before completing.');
  }

  if (!progress.plan) {
    problems.push('Record a plan with explicit completion criteria using agent_plan.');
  }

  if (!progress.ran) {
    problems.push('Run the app or requested program and inspect the result.');
  }

  if (progress.plan?.requiresPreview && !progress.previewReady) {
    problems.push('Confirm a running preview.');
  }

  if (!progress.tested) {
    problems.push(
      'Run a relevant test/check with purpose test and confirm exit code 0 after the latest edit or failure.',
    );
  }

  return problems;
}

export function getAgentLoopInstructions(progress: ReturnType<typeof getAgentLoopProgress>) {
  if (progress.status === 'inactive') {
    return '';
  }

  if (progress.status === 'blocked') {
    return 'Stop using tools. Explain the blocker or denied operation and list unmet completion criteria without claiming success.';
  }

  if (progress.status === 'limited') {
    return `The ${MAX_AGENT_STEPS}-step task limit was reached. Stop using tools and report actual progress, unmet completion criteria, and checks that did not pass.`;
  }

  if (progress.status === 'ready') {
    return 'The completion gate accepted this task. Summarize the relevant changed files, passing checks, and fulfilled criteria. Do not start unrelated work.';
  }

  return `Follow Plan -> edit -> run -> test -> repair. Record a short plan and observable completion criteria with agent_plan. Inspect relevant files, then use small exact patches. Run the app/program with purpose run; use an existing live server for follow-up UI edits. Run the smallest relevant available checks with purpose test and wait for exit code 0. If a check fails, inspect its output, patch the cause, and rerun the check. Any edit after a passing check requires fresh verification. Call agent_complete alone with evidence for every criterion before finishing. A plan or started process alone is not completion. If no automated test script exists, use an available typecheck, lint, focused runtime assertion, or smoke check and explain its limits; do not invent passing tests. If work cannot proceed, report outcome blocked with a concrete reason. Remaining task steps: ${MAX_AGENT_STEPS - progress.steps}. Confirmed: plan=${Boolean(progress.plan)}, edits=${progress.edited}, run=${progress.ran}, passing check after latest changes=${progress.tested}, preview=${progress.previewReady}.
Recorded criteria: ${JSON.stringify(progress.plan?.criteria ?? [])}. Available successful tool-call evidence IDs: ${JSON.stringify(progress.evidence)}.`;
}
