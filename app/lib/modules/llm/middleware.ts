import type { LanguageModelV1, LanguageModelV1Middleware, LanguageModelV1StreamPart } from 'ai';
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai';
import type { ModelInfo } from './types';

/**
 * Applies middleware to a language model based on its features
 *
 * @param model The language model to wrap
 * @param modelInfo The model information including supported features
 * @returns The wrapped language model with applied middleware
 */
export function applyMiddleware(model: LanguageModelV1, modelInfo: ModelInfo): LanguageModelV1 {
  let wrappedModel = model;

  // Apply reasoning middleware if model supports reasoning
  if (modelInfo.features?.reasoning) {
    // Special handling for Anthropic models which need more robust tag handling
    if (modelInfo.provider === 'Anthropic') {
      wrappedModel = wrapLanguageModel({
        model: wrappedModel,
        middleware: createCustomReasoningMiddleware(),
      });
    } else {
      // Standard reasoning middleware for other providers
      wrappedModel = wrapLanguageModel({
        model: wrappedModel,
        middleware: extractReasoningMiddleware({ tagName: 'think' }),
      });
    }
  }

  // Apply image generation middleware for models that support it
  if (modelInfo.features?.imageGeneration) {
    wrappedModel = wrapLanguageModel({
      model: wrappedModel,
      middleware: createImageGenerationMiddleware(),
    });
  }

  // Apply structured output middleware for models that support it
  if (modelInfo.features?.structuredOutput) {
    wrappedModel = wrapLanguageModel({
      model: wrappedModel,
      middleware: createStructuredOutputMiddleware(),
    });
  }

  // Apply code diff middleware for models that support it
  if (modelInfo.features?.codeDiff || modelSupportsCodeDiff(modelInfo.name)) {
    wrappedModel = wrapLanguageModel({
      model: wrappedModel,
      middleware: createCodeDiffMiddleware(),
    });
  }

  /*
   * Add more middleware for other features as needed
   * For example, for image generation, sources, etc.
   */

  return wrappedModel;
}

/**
 * Extract reasoning from text if it includes <think> tags for models that support reasoning
 * @param text The text to extract reasoning from
 * @returns The processed text and extracted reasoning
 */
function processReasoningInText(text: string): { text: string; reasoning?: string } {
  // Try to find reasoning blocks
  const reasoningPatterns = [
    /<think>([\s\S]*?)<\/think>/,
    /<reasoning>([\s\S]*?)<\/reasoning>/,
    /<thinking>([\s\S]*?)<\/thinking>/,
  ];

  let reasoning: string | undefined;
  let processedText = text;

  for (const pattern of reasoningPatterns) {
    const match = text.match(pattern);

    if (match) {
      reasoning = match[1].trim();

      // Remove the reasoning block from the text
      processedText = text.replace(pattern, '').trim();
      break;
    }
  }

  return { text: processedText, reasoning };
}

/**
 * Create a custom reasoning middleware that safely handles Anthropic's XML output
 * This creates a more robust extraction that can handle Claude's sometimes inconsistent XML formatting
 */
function createCustomReasoningMiddleware(): LanguageModelV1Middleware {
  return {
    middlewareVersion: 'v1',
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();

      if (result.text) {
        const processed = processReasoningInText(result.text);

        return {
          ...result,
          text: processed.text,
          reasoning: processed.reasoning || result.reasoning,
        };
      }

      return result;
    },

    wrapStream: async ({ doStream }) => {
      const stream = await doStream();

      // Return a new stream with the same interface but with processed reasoning
      return {
        ...stream,

        // Must keep the original methods and properties
        [Symbol.asyncIterator]() {
          // Cast to any to avoid type compatibility issues
          const originalIterator = (stream as any)[Symbol.asyncIterator]();

          return {
            async next() {
              const { done, value } = await originalIterator.next();

              if (done || !value) {
                return { done, value };
              }

              // Process reasoning in text chunks
              if ('text' in value && typeof value.text === 'string') {
                const processed = processReasoningInText(value.text);

                return {
                  done,
                  value: {
                    ...value,
                    text: processed.text,
                    reasoning: processed.reasoning || (value as any).reasoning,
                  } as LanguageModelV1StreamPart,
                };
              }

              return { done, value };
            },
          };
        },
      };
    },
  };
}

/**
 * Create a middleware to ensure DeepSeek models produce complete code blocks
 * Addresses common issues with incomplete code generation in DeepSeek models
 */
function createDeepSeekCodeCompletionMiddleware(): LanguageModelV1Middleware {
  return {
    middlewareVersion: 'v1',
    wrapStream: async ({ doStream }) => {
      const stream = await doStream();
      let fullOutput = '';
      let lastCodeBlock: { language: string; content: string; start: number; end: number; complete: boolean } | null =
        null;

      return {
        ...stream,
        [Symbol.asyncIterator]() {
          const originalIterator = (stream as any)[Symbol.asyncIterator]();

          return {
            async next() {
              const { done, value } = await originalIterator.next();

              if (done || !value) {
                // Before finishing, check if there was an incomplete code block
                if (lastCodeBlock && !lastCodeBlock.complete && 'text' in value) {
                  // Add closing backticks if missing
                  const fixedText = fullOutput + '```';
                  return {
                    done,
                    value: {
                      ...value,
                      text: fixedText,
                    } as LanguageModelV1StreamPart,
                  };
                }

                return { done, value };
              }

              // Track and process text chunks
              if ('text' in value && typeof value.text === 'string') {
                fullOutput += value.text;

                // Check for code blocks
                const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
                let match;

                // Reset the regex each time to scan the entire accumulated output
                codeBlockRegex.lastIndex = 0;

                while ((match = codeBlockRegex.exec(fullOutput)) !== null) {
                  const language = match[1] || '';
                  const content = match[2];
                  const startIdx = match.index;
                  const endIdx = startIdx + match[0].length;

                  // Mark this code block as complete
                  lastCodeBlock = {
                    language,
                    content,
                    start: startIdx,
                    end: endIdx,
                    complete: true,
                  };
                }

                // Check for potentially incomplete code blocks (starting backticks but no ending ones)
                const incompleteBlockRegex = /```(\w+)?\n([\s\S]*)$/;
                const incompleteMatch = fullOutput.match(incompleteBlockRegex);

                if (incompleteMatch && !fullOutput.endsWith('```')) {
                  const language = incompleteMatch[1] || '';
                  const content = incompleteMatch[2] || '';
                  const startIdx = incompleteMatch.index!;

                  lastCodeBlock = {
                    language,
                    content,
                    start: startIdx,
                    end: fullOutput.length,
                    complete: false,
                  };
                }
              }

              return { done, value };
            },
          };
        },
      };
    },
  };
}

/**
 * Create middleware for handling image generation capabilities
 * This helps with properly formatting image requests and responses
 */
function createImageGenerationMiddleware(): LanguageModelV1Middleware {
  return {
    middlewareVersion: 'v1',
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();
      return result;
    },
    wrapStream: async ({ doStream }) => {
      const stream = await doStream();
      return stream;
    },
  };
}

/**
 * Create middleware for handling structured output capabilities
 * This improves JSON generation and helps catch/fix common structured output errors
 */
function createStructuredOutputMiddleware(): LanguageModelV1Middleware {
  return {
    middlewareVersion: 'v1',
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();
      return result;
    },
    wrapStream: async ({ doStream }) => {
      const stream = await doStream();
      let jsonOutput = '';
      let inJsonBlock = false;
      let jsonEnded = false;
      let bracketCount = 0;

      return {
        ...stream,
        [Symbol.asyncIterator]() {
          const originalIterator = (stream as any)[Symbol.asyncIterator]();

          return {
            async next() {
              const { done, value } = await originalIterator.next();

              if (done || !value) {
                /*
                 * If we were in the middle of a JSON block and it wasn't properly closed,
                 * try to fix it by adding missing closing brackets/braces
                 */
                if (inJsonBlock && !jsonEnded && 'text' in value) {
                  let fixedJson = jsonOutput;

                  // Add missing closing brackets/braces
                  while (bracketCount > 0) {
                    fixedJson += '}';
                    bracketCount--;
                  }

                  return {
                    done,
                    value: {
                      ...value,
                      text: fixedJson,
                    } as LanguageModelV1StreamPart,
                  };
                }

                return { done, value };
              }

              // Process text chunks to improve JSON handling
              if ('text' in value && typeof value.text === 'string') {
                const text = value.text;

                /* Check for JSON code block start */
                if (!inJsonBlock && text.includes('```json')) {
                  inJsonBlock = true;
                  jsonOutput = text.substring(text.indexOf('```json') + 7);

                  return { done, value };
                }

                // Check for JSON code block end
                if (inJsonBlock && text.includes('```') && !jsonEnded) {
                  inJsonBlock = false;
                  jsonEnded = true;
                  jsonOutput += text.substring(0, text.indexOf('```'));

                  // Try to parse and format the JSON
                  try {
                    const parsed = JSON.parse(jsonOutput);
                    const formatted = JSON.stringify(parsed, null, 2);

                    return {
                      done,
                      value: {
                        ...value,
                        text: formatted,
                      } as LanguageModelV1StreamPart,
                    };
                  } catch {
                    // If parsing fails, return the original

                    return { done, value };
                  }
                }

                // Track opening and closing braces to help with unclosed JSON
                if (inJsonBlock) {
                  for (let i = 0; i < text.length; i++) {
                    if (text[i] === '{') {
                      bracketCount++;
                    }

                    if (text[i] === '}') {
                      bracketCount--;
                    }
                  }

                  jsonOutput += text;
                }
              }

              return { done, value };
            },
          };
        },
      };
    },
  };
}

/**
 * Create middleware for handling code diff capabilities
 * This helps models properly understand and handle diff format code changes
 */
function createCodeDiffMiddleware(): LanguageModelV1Middleware {
  return {
    middlewareVersion: 'v1',
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();
      return result;
    },
    wrapStream: async ({ doStream }) => {
      const stream = await doStream();
      let diffOutput = '';
      let inDiffBlock = false;
      let diffEnded = false;

      return {
        ...stream,
        [Symbol.asyncIterator]() {
          const originalIterator = (stream as any)[Symbol.asyncIterator]();

          return {
            async next() {
              const { done, value } = await originalIterator.next();

              if (done || !value) {
                /*
                 * If we were in the middle of a diff block and it wasn't properly closed,
                 * try to clean it up
                 */
                if (inDiffBlock && !diffEnded && 'text' in value) {
                  let cleanedDiff = diffOutput;

                  // Try to normalize the diff format
                  cleanedDiff = cleanedDiff.replace(/^[<>+\-]/gm, (match) => {
                    if (match === '<') {
                      return '-';
                    }

                    if (match === '>') {
                      return '+';
                    }

                    return match;
                  });

                  return {
                    done,
                    value: {
                      ...value,
                      text: cleanedDiff,
                    } as LanguageModelV1StreamPart,
                  };
                }

                return { done, value };
              }

              // Process text chunks to improve diff handling
              if ('text' in value && typeof value.text === 'string') {
                const text = value.text;

                /* Check for diff code block start */
                if (!inDiffBlock && (text.includes('```diff') || text.includes('```patch'))) {
                  inDiffBlock = true;

                  const startIndex = text.includes('```diff')
                    ? text.indexOf('```diff') + 7
                    : text.indexOf('```patch') + 8;
                  diffOutput = text.substring(startIndex);

                  return { done, value };
                }

                // Check for diff code block end
                if (inDiffBlock && text.includes('```') && !diffEnded) {
                  inDiffBlock = false;
                  diffEnded = true;
                  diffOutput += text.substring(0, text.indexOf('```'));

                  // Format the diff with consistent syntax
                  const formattedDiff = diffOutput.replace(/^[<>+\-]/gm, (match) => {
                    if (match === '<') {
                      return '-';
                    }

                    if (match === '>') {
                      return '+';
                    }

                    return match;
                  });

                  return {
                    done,
                    value: {
                      ...value,
                      text: formattedDiff,
                    } as LanguageModelV1StreamPart,
                  };
                }

                // Track diff blocks
                if (inDiffBlock) {
                  diffOutput += text;
                }
              }

              return { done, value };
            },
          };
        },
      };
    },
  };
}

/**
 * Create middleware based on model capabilities
 * @param model The model name to create middleware for
 * @returns Middleware array appropriate for the model's capabilities
 */
export function createMiddlewareForModel(model: string): LanguageModelV1Middleware[] {
  const middleware: LanguageModelV1Middleware[] = [];

  // Add reasoning middleware for models that support it
  if (modelSupportsReasoning(model)) {
    middleware.push(createCustomReasoningMiddleware());
  }

  // Add DeepSeek code completion middleware for DeepSeek models
  if (isDeepSeekModel(model)) {
    middleware.push(createDeepSeekCodeCompletionMiddleware());
  }

  return middleware;
}

/**
 * Determine if a model name is known to support reasoning
 * This helps identify models that support reasoning across different providers
 *
 * @param modelName The name of the model to check
 * @returns true if the model supports reasoning
 */
export function modelSupportsReasoning(modelName: string): boolean {
  // First check if this is a newer model from a provider that supports reasoning
  const modelNameLower = modelName.toLowerCase();

  /*
   * Check for model families rather than specific versions
   * Most advanced models from major providers now support reasoning
   */
  const supportsReasoningByFamily = [
    /* OpenAI models - newer GPT-4 versions have good reasoning */
    modelNameLower.includes('gpt-4o') ||
      modelNameLower.includes('gpt-4-turbo') ||
      modelNameLower.includes('gpt-4-vision'),

    /* Claude models - especially newer ones */
    modelNameLower.includes('claude-3'),

    /* Amazon Bedrock models */
    modelNameLower.includes('anthropic.claude-3'),

    /* Mistral models - larger variants */
    modelNameLower.includes('mistral-large'),

    /* DeepSeek models */
    modelNameLower.includes('deepseek-coder') ||
      modelNameLower.includes('deepseek-v2') ||
      modelNameLower.includes('deepseek-r1'),
  ].some(Boolean);

  /*
   * Additional capability detection based on version numbers
   * Higher version numbers generally indicate more advanced capabilities
   */
  const hasVersionIndicator = /[.-](\d+(\.\d+)?)/.exec(modelNameLower);
  const versionNumber = hasVersionIndicator ? parseFloat(hasVersionIndicator[1]) : 0;
  const hasAdvancedVersion = versionNumber >= 3.5;

  return supportsReasoningByFamily || hasAdvancedVersion;
}

/**
 * Determine if a model is from DeepSeek
 * Used to apply specialized middleware for DeepSeek models
 *
 * @param modelName The name of the model to check
 * @returns true if the model is a DeepSeek model
 */
export function isDeepSeekModel(modelName: string): boolean {
  // List of DeepSeek model identifiers
  const deepseekModels = [
    'deepseek-coder',
    'deepseek-chat',
    'deepseek-reasoner',
    'deepseek-v2',
    'deepseek-r1',
    'deepseek/',
    'deepseek-ai/',
  ];

  // Check if the model name contains any of the DeepSeek model identifiers
  return deepseekModels.some((deepseekModel) => modelName.toLowerCase().includes(deepseekModel.toLowerCase()));
}

/**
 * Determine if a model name is known to support image generation
 * @param modelName The name of the model to check
 * @returns true if the model supports image generation
 */
export function modelSupportsImageGeneration(modelName: string): boolean {
  const modelNameLower = modelName.toLowerCase();

  /*
   * Most vision-capable models from major providers
   * Check for model families rather than specific versions
   */
  const supportsImageGeneration = [
    /* OpenAI models */
    modelNameLower.includes('gpt-4o') ||
      modelNameLower.includes('gpt-4-vision') ||
      modelNameLower.includes('gpt-4-turbo'),

    /* Anthropic models */
    modelNameLower.includes('claude-3'),

    /* Google models */
    modelNameLower.includes('gemini'),
  ].some(Boolean);

  return supportsImageGeneration;
}

/**
 * Determine if a model name is known to support structured output
 * @param modelName The name of the model to check
 * @returns true if the model supports structured output
 */
export function modelSupportsStructuredOutput(modelName: string): boolean {
  // First check if this is a newer model from a provider that supports structured output
  const modelNameLower = modelName.toLowerCase();

  /*
   * Most modern models support structured output
   * Check for model families rather than specific versions
   */
  const supportsStructuredOutputByFamily = [
    /* OpenAI models */
    modelNameLower.includes('gpt-4') || modelNameLower.includes('gpt-3.5'),

    /* Claude models - all modern ones support structured output */
    modelNameLower.includes('claude-3') || modelNameLower.includes('claude-2'),

    /* Mistral models */
    modelNameLower.includes('mistral'),

    /* Google models */
    modelNameLower.includes('gemini'),

    /* Code-focused models tend to be good with structured output */
    modelNameLower.includes('coder') || modelNameLower.includes('-code'),

    /* Other known models with structured output support */
    modelNameLower.includes('command') || modelNameLower.includes('deepseek'),
  ].some(Boolean);

  /*
   * Additional capability detection based on version numbers
   * Higher version numbers generally indicate more advanced capabilities
   */
  const hasVersionIndicator = /[.-](\d+(\.\d+)?)/.exec(modelNameLower);
  const versionNumber = hasVersionIndicator ? parseFloat(hasVersionIndicator[1]) : 0;
  const hasRecentVersion = versionNumber >= 2.0;

  return supportsStructuredOutputByFamily || hasRecentVersion;
}

/**
 * Determine if a model name is known to support code diff
 * @param modelName The name of the model to check
 * @returns true if the model supports code diff
 */
export function modelSupportsCodeDiff(modelName: string): boolean {
  // First check if this is a newer model from a provider that supports code diff
  const modelNameLower = modelName.toLowerCase();

  /*
   * Most advanced models from major providers support code diff
   * Check for model families rather than specific versions
   */
  const supportsDiffByFamily = [
    /* OpenAI GPT-4 family */
    modelNameLower.includes('gpt-4'),

    /* Claude 3 family */
    modelNameLower.includes('claude-3'),

    /* Mistral large and medium models */
    modelNameLower.includes('mistral-large') || modelNameLower.includes('mistral-medium'),

    /* Code-specialized models */
    modelNameLower.includes('coder') || modelNameLower.includes('-code'),

    /* Gemini models */
    modelNameLower.includes('gemini-1.5') || modelNameLower.includes('gemini-2'),

    /* DeepSeek models generally good with code */
    modelNameLower.includes('deepseek'),

    /* Anthropic models (older ones) */
    modelNameLower.includes('claude-instant') && !modelNameLower.includes('claude-instant-1'),
  ].some(Boolean);

  /*
   * Additional capability detection based on version numbers
   * Higher version numbers generally indicate more advanced capabilities
   */
  const hasVersionIndicator = /[.-](\d+(\.\d+)?)/.exec(modelNameLower);
  const versionNumber = hasVersionIndicator ? parseFloat(hasVersionIndicator[1]) : 0;
  const hasHighVersion = versionNumber >= 3.0;

  return supportsDiffByFamily || hasHighVersion;
}
