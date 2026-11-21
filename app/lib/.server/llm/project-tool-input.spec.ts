import { simulateReadableStream, streamText, toUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { repairBuildToolCall } from './project-tool-input';
import { toSafeStreamErrorMessage } from '~/lib/.server/api/errors';
import { projectToolDefinitions } from '~/lib/runtime/projectMcp.shared';

const patch = {
  path: '/home/project/tailwind.config.js',
  expectedRevision: 'a'.repeat(64),
  lineRange: { start: 1, end: 11 },
  newText: 'export default { content: [] };',
};

async function streamPatch(input: Record<string, unknown>) {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          {
            type: 'tool-call' as const,
            toolCallId: 'tailwind-edit',
            toolName: 'project_patch_file',
            input: JSON.stringify(input),
          },
          {
            type: 'finish' as const,
            finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 1, text: 1, reasoning: 0 },
            },
          },
        ],
      }),
    }),
  });

  const result = await streamText({
    model,
    prompt: 'Update the Tailwind config.',
    toolChoice: 'required',
    tools: { project_patch_file: projectToolDefinitions.project_patch_file },
    repairToolCall: repairBuildToolCall,
  });

  const chunks = await Array.fromAsync(toUIMessageStream({ stream: result.stream, onError: toSafeStreamErrorMessage }));
  expect(model.doStreamCalls).toHaveLength(1);

  return chunks;
}

describe('project patch call repair', () => {
  it('repairs the captured stringified range without changing its revision or replacement text', async () => {
    const chunks = await streamPatch({ ...patch, lineRange: '{start: 1, end: 11}' });

    expect(chunks.filter((chunk) => chunk.type.startsWith('tool-input'))).toEqual([
      expect.objectContaining({ type: 'tool-input-available', toolCallId: 'tailwind-edit', input: patch }),
    ]);
  });

  it.each([[1, 11], patch.lineRange].map((lineRange) => ({ lineRange })))(
    'repairs the reported $lineRange call with an extraneous replacementReason',
    async ({ lineRange }) => {
      const chunks = await streamPatch({ ...patch, lineRange, replacementReason: 'Update config' });

      expect(chunks.filter((chunk) => chunk.type.startsWith('tool-input'))).toEqual([
        expect.objectContaining({ type: 'tool-input-available', toolCallId: 'tailwind-edit', input: patch }),
      ]);
      expect(chunks.some((chunk) => chunk.type === 'tool-output-available')).toBe(false);
    },
  );

  it.each([
    { fields: { lineRange: [1, 11, 12] }, hint: 'positive integer start and end' },
    { fields: { lineRange: [0, 11] }, hint: 'positive integer start and end' },
    { fields: { lineRange: '{start: 1, start: 11}' }, hint: 'positive integer start and end' },
    { fields: { lineRange: [1, 11], expectedRevision: 'invalid' }, hint: 'Copy expectedRevision' },
    { fields: { unexpectedField: 'sensitive-value' }, hint: 'Remove fields outside the patch schema' },
  ])('returns a safe field-specific error when automatic repair would require guessing', async ({ fields, hint }) => {
    const chunks = await streamPatch({ ...patch, ...fields, replacementReason: 'sensitive-value' });
    const invalid = chunks.find((chunk) => chunk.type === 'tool-input-error');

    expect(chunks.some((chunk) => chunk.type === 'tool-input-available')).toBe(false);
    expect(invalid?.errorText).toContain(hint);
    expect(invalid?.errorText).not.toMatch(/sensitive-value|unexpectedField/);
  });
});
