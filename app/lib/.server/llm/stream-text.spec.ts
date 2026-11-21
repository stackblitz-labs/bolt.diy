import { APICallError, jsonSchema, simulateReadableStream, tool, toUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamText } from './stream-text';
import { PROVIDER_LIST } from '~/utils/constants';

afterEach(() => vi.restoreAllMocks());

describe('OpenRouter tool streams', () => {
  it.each([undefined, { require_parameters: false, order: ['private-routing-preference'] }])(
    'forwards routing options and logs only safe diagnostics (%j)',
    async (routing) => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const error = new APICallError({
        message: 'Unsupported parameter: private-provider-message',
        url: 'https://provider.example/?key=private-api-key',
        requestBodyValues: { prompt: 'private-user-prompt' },
        responseBody: 'private-provider-body',
        statusCode: 400,
      });
      const model = new MockLanguageModelV4({
        doStream: async () => ({
          stream: simulateReadableStream({ chunks: [{ type: 'error' as const, error }] }),
        }),
      });

      const provider = PROVIDER_LIST.find((provider) => provider.name === 'OpenRouter')!;
      vi.spyOn(provider, 'getModelInstance').mockReturnValue(model);

      const result = await streamText({
        provider: 'OpenRouter',
        model: provider.staticModels[0].name,
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'private-user-prompt' }] }],
        options: {
          maxRetries: 0,
          tools: {
            project_read_file: tool({
              inputSchema: jsonSchema({ type: 'object', description: 'private-tool-schema' }),
            }),
          },
          ...(routing ? { providerOptions: { openrouter: { provider: routing } } } : {}),
        },
      });

      const chunks = await Array.fromAsync(
        toUIMessageStream({ stream: result.stream, onError: () => 'Safe streamed error' }),
      );
      expect(model.doStreamCalls[0].providerOptions?.openrouter?.provider).toEqual(routing);
      expect(chunks).toContainEqual({ type: 'error', errorText: 'Safe streamed error' });

      const logs = log.mock.calls.flat().join(' ');
      expect(logs).toContain('type=APICallError, status=400, retryable=false, reason=unsupported');
      expect(logs).not.toContain('private-');
      expect(consoleError).not.toHaveBeenCalled();
    },
  );
});
