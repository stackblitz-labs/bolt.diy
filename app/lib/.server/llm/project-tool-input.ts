import { InvalidToolInputError, type ToolCallRepairFunction, type ToolSet } from 'ai';
import { agentPlanSchema } from './agent-loop';
import { projectToolDefinitions } from '~/lib/runtime/projectMcp.shared';

const patchInputSchema = projectToolDefinitions.project_patch_file.inputSchema;
const writeInputSchema = projectToolDefinitions.project_write_file.inputSchema;
const replaceLinesInputSchema = projectToolDefinitions.project_replace_lines.inputSchema;

function parseInput(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function normalizeLineRange(range: unknown): unknown {
  if (typeof range === 'string') {
    const json = parseInput(range);

    if (json !== undefined) {
      range = json;
    } else {
      const pair = /^\s*\{\s*(start|end)\s*:\s*(\d+)\s*,\s*(start|end)\s*:\s*(\d+)\s*\}\s*$/.exec(range);

      if (pair && pair[1] !== pair[3]) {
        return { [pair[1]]: Number(pair[2]), [pair[3]]: Number(pair[4]) };
      }
    }
  }

  return Array.isArray(range) && range.length === 2 ? { start: range[0], end: range[1] } : range;
}

/** Correct known formatting mistakes while preserving the model's intended plan or edit. */
export const repairBuildToolCall: ToolCallRepairFunction<ToolSet> = async ({ toolCall, error }) => {
  if (
    !InvalidToolInputError.isInstance(error) ||
    (toolCall.toolName !== 'agent_plan' && toolCall.toolName !== 'project_patch_file')
  ) {
    return null;
  }

  const input = parseInput(toolCall.input);

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const args = input as Record<string, unknown>;

  if (toolCall.toolName === 'agent_plan') {
    const { criteria } = args;

    if (
      !Array.isArray(criteria) ||
      !criteria.every((description) => typeof description === 'string' && description.trim())
    ) {
      return null;
    }

    const repaired = agentPlanSchema.safeParse({
      ...args,
      criteria: criteria.map((description, index) => ({ id: `criterion-${index + 1}`, description })),
    });

    return repaired.success ? { ...toolCall, input: JSON.stringify(repaired.data) } : null;
  }

  const { replacementReason, ...patchArgs } = args;
  const range = normalizeLineRange(patchArgs.lineRange);

  if (replacementReason !== undefined && typeof replacementReason !== 'string') {
    return null;
  }

  if (range === patchArgs.lineRange && replacementReason === undefined) {
    return null;
  }

  if (range !== patchArgs.lineRange) {
    patchArgs.lineRange = range;
  }

  const repaired = patchInputSchema.safeParse(patchArgs);

  return repaired.success ? { ...toolCall, input: JSON.stringify(repaired.data) } : null;
};

/** Report schema requirements without including the raw call, values, or arbitrary field names. */
export function getProjectPatchInputHint(rawInput: string) {
  const input = parseInput(rawInput);

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'Send one valid JSON object with the patch arguments.';
  }

  const result = patchInputSchema.safeParse(input);

  if (result.success) {
    return 'Use the declared patch input schema.';
  }

  const hints = result.error.issues.map((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.path.length === 0 && issue.keys.length === 1 && issue.keys[0] === 'replacementReason'
        ? 'Remove replacementReason. It belongs to project_write_file.'
        : 'Remove fields outside the patch schema.';
    }

    switch (issue.path[0]) {
      case 'lineRange':
        return 'Use lineRange as an object with positive integer start and end fields.';
      case 'expectedRevision':
        return 'Copy expectedRevision from the latest numbered read.';
      case 'path':
        return 'Supply the file path as a non-empty string.';
      case 'newText':
        return 'Supply newText as a string with the replacement code.';
      case 'oldText':
        return 'Supply a non-empty oldText string for an exact-match patch.';
      case 'expectedContent':
        return 'Omit expectedContent when patching a numbered range.';
      default:
        return 'Supply exactly one of lineRange or oldText. For numbered edits, use project_replace_lines with startLine and endLine from the read.';
    }
  });

  return [...new Set(hints)].join(' ');
}

export function getProjectWriteInputHint(rawInput: string) {
  const input = parseInput(rawInput);

  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
    return 'Send one complete JSON object with path and content. If a long source response was cut off, split the implementation into smaller complete files.';
  }

  const result = writeInputSchema.safeParse(input);

  if (result.success) {
    return 'Use the declared file write input schema.';
  }

  const hints = result.error.issues.map((issue) => {
    switch (issue.path[0]) {
      case 'path':
        return 'Supply the file path as a non-empty string.';
      case 'content':
        return 'Supply the complete file contents as a string with real line breaks.';
      case 'overwrite':
        return 'Supply overwrite as a boolean or omit it.';
      case 'replacementReason':
        return 'Omit replacementReason or supply a string of at most 500 characters.';
      default:
        return 'Remove fields outside the file write schema.';
    }
  });

  return [...new Set(hints)].join(' ');
}

export function getProjectReplaceLinesInputHint(rawInput: string) {
  const input = parseInput(rawInput);

  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
    return 'Send one complete JSON object with path, startLine, endLine, expectedRevision, and newText. For a full-file replacement, use project_write_file with complete source.';
  }

  const result = replaceLinesInputSchema.safeParse(input);

  if (result.success) {
    return 'Use the declared numbered edit input schema.';
  }

  const hints = result.error.issues.map((issue) => {
    switch (issue.path[0]) {
      case 'path':
        return 'Supply the file path as a non-empty string.';
      case 'startLine':
      case 'endLine':
        return 'Supply startLine and endLine as positive JSON integers from the numbered read.';
      case 'expectedRevision':
        return 'Copy the entire revision from the latest numbered read into expectedRevision.';
      case 'newText':
        return 'Supply newText as a string with the complete replacement lines.';
      default:
        return 'Remove fields outside the numbered edit schema.';
    }
  });

  return [...new Set(hints)].join(' ');
}
