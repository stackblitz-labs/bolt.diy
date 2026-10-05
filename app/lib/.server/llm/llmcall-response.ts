export type LlmCallResponse = {
  text: string;
  reasoning: unknown;
  finishReason: unknown;
  usage: unknown;
};

/*
 * v5 turned GenerateTextResult into a class whose `text`, `usage` and
 * `finishReason` are prototype getters, which JSON.stringify skips. Returning
 * JSON.stringify(result) therefore emitted an object with no top-level `text`,
 * and selectStarterTemplate threw "Cannot read properties of undefined
 * (reading 'match')" on `llmOutput.match(...)`.
 *
 * Takes `unknown` because the SDK's exact result type is internal and unstable;
 * text is coerced so callers always receive a string.
 *
 * Note: finishReason is read off the result object, which v7 does not populate
 * reliably. Code that needs it should use the streamText `onEnd` callback, whose
 * finishReason comes from the stream's finish chunk.
 */
export function toLlmCallResponse(result: unknown): LlmCallResponse {
  const source = (result ?? {}) as {
    text?: unknown;
    reasoning?: unknown;
    finishReason?: unknown;
    totalUsage?: unknown;
  };

  return {
    text: typeof source.text === 'string' ? source.text : '',
    reasoning: source.reasoning,
    finishReason: source.finishReason,
    usage: source.totalUsage,
  };
}
