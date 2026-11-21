import { asSchema, isStepCount, simulateReadableStream, streamText, toUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { getProjectToolNames, projectToolDefinitions } from './projectMcp.shared';

describe('getProjectToolNames', () => {
  it('includes both built-in web tools when web search is enabled', () => {
    const tools = getProjectToolNames(true);

    expect(tools).toContain('web_search');
    expect(tools).toContain('web_fetch');
  });

  it('omits both built-in web tools when web search is disabled', () => {
    const tools = getProjectToolNames(false);

    expect(tools).not.toContain('web_search');
    expect(tools).not.toContain('web_fetch');
    expect(tools).toContain('project_read_file');
  });
});

describe('project tool input validation', () => {
  it('publishes the numbered edit arguments as required top-level schema fields', async () => {
    const schema = await asSchema(projectToolDefinitions.project_replace_lines.inputSchema).jsonSchema;

    expect(schema.required).toEqual(['path', 'startLine', 'endLine', 'expectedRevision', 'newText']);
    expect(schema.properties).not.toHaveProperty('lineRange');
  });

  it('reports invalid input to the model and allows a corrected call within the same stream', async () => {
    const model = new MockLanguageModelV4({
      doStream: async (params) => {
        const isRetry = params.prompt.some((message) => message.role === 'tool');

        return {
          stream: simulateReadableStream({
            chunks: [
              {
                type: 'tool-call' as const,
                toolCallId: isRetry ? 'corrected' : 'invalid',
                toolName: 'project_read_file',
                input: isRetry ? '{"path":"src/App.tsx"}' : '{"file":"src/App.tsx"}',
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
        };
      },
    });

    const result = await streamText({
      model,
      prompt: 'Read src/App.tsx.',
      tools: { project_read_file: projectToolDefinitions.project_read_file },
      stopWhen: isStepCount(2),
    });

    const chunks = await Array.fromAsync(toUIMessageStream({ stream: result.stream }));

    expect(model.doStreamCalls).toHaveLength(2);
    expect(chunks.filter((chunk) => chunk.type === 'tool-input-available')).toEqual([
      expect.objectContaining({ toolCallId: 'corrected', input: { path: 'src/App.tsx' } }),
    ]);
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: 'tool-input-error',
        toolCallId: 'invalid',
        errorText: expect.stringContaining('path'),
      }),
    );
  });
});
