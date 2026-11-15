import { generateText } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { toLlmCallResponse } from './llmcall-response';

const COMPLETION = '<templateName>blank</templateName><title>Hi</title>';

/* Derived from the mock so the spec needs no direct @ai-sdk/provider dependency. */
type MockGenerateResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;

function mockModel() {
  return new MockLanguageModelV4({
    doGenerate: async (): Promise<MockGenerateResult> => ({
      content: [{ type: 'text', text: COMPLETION }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        /*
         * v7 provider usage is nested and has no provider-level totalTokens:
         * inputTokens/outputTokens are objects and the SDK flattens them onto
         * LanguageModelUsage, deriving totalTokens itself.
         */
        inputTokens: { total: 7, noCache: 7, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, reasoning: 0, text: 5 },
      },
      warnings: [],
    }),
  });
}

describe('toLlmCallResponse', () => {
  /*
   * Regression guard for "Error parsing template selection: Cannot read
   * properties of undefined (reading 'match')". /api/llmcall used to return
   * JSON.stringify(result) directly; in v5+ the text survives only nested under
   * steps[0].content, so the caller's `text` was undefined.
   */
  it('puts text at the top level, where callers read it', async () => {
    const result = await generateText({ model: mockModel(), prompt: 'pick a template' });

    expect(JSON.parse(JSON.stringify(result)).text).toBeUndefined();

    expect(JSON.parse(JSON.stringify(toLlmCallResponse(result))).text).toBe(COMPLETION);
  });

  it('passes flattened usage through', async () => {
    const result = await generateText({ model: mockModel(), prompt: 'x' });

    expect(toLlmCallResponse(result).usage).toMatchObject({
      inputTokens: 7,
      outputTokens: 5,
      totalTokens: 12,
    });
  });

  it('always emits a string text even for an empty completion', () => {
    const empty = {
      get text() {
        return '';
      },
      get finishReason() {
        return 'stop';
      },
      get totalUsage() {
        return undefined;
      },
    };

    expect(toLlmCallResponse(empty as never)).toEqual({
      text: '',
      reasoning: undefined,
      finishReason: 'stop' as const,
      usage: undefined,
    });
  });
});
