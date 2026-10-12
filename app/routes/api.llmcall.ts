import { generateText, type UIMessage } from 'ai';
import type { ActionFunctionArgs } from 'react-router';
import { ApiError, toApiErrorResponse, toMissingCredentialError } from '~/lib/.server/api/errors';
import { readJsonBody } from '~/lib/.server/api/read-body';
import { REQUEST_LIMITS, asProviderInfo, llmCallRequestSchema, parseBody } from '~/lib/.server/api/schemas';
import { MAX_TOKENS, PROVIDER_COMPLETION_LIMITS, isReasoningModel } from '~/lib/.server/llm/constants';
import { toLlmCallResponse } from '~/lib/.server/llm/llmcall-response';
import { streamText } from '~/lib/.server/llm/stream-text';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { createMessage } from '~/lib/persistence/messageMigration';
import { withSecurity } from '~/lib/security';
import type { IProviderSetting } from '~/types/model';
import { PROVIDER_LIST } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';

export const action = withSecurity(llmCallAction, {
  allowedMethods: ['POST'],
});

async function getModelList(options: {
  apiKeys?: Record<string, string>;
  providerSettings?: Record<string, IProviderSetting>;
  serverEnv?: Record<string, string>;
}) {
  const llmManager = LLMManager.getInstance(import.meta.env);
  return llmManager.updateModelList(options);
}

const logger = createScopedLogger('api.llmcall');

function getCompletionTokenLimit(modelDetails: ModelInfo): number {
  // 1. If model specifies completion tokens, use that
  if (modelDetails.maxCompletionTokens && modelDetails.maxCompletionTokens > 0) {
    return modelDetails.maxCompletionTokens;
  }

  // 2. Use provider-specific default
  const providerDefault = PROVIDER_COMPLETION_LIMITS[modelDetails.provider];

  if (providerDefault) {
    return providerDefault;
  }

  // 3. Final fallback to MAX_TOKENS, but cap at reasonable limit for safety
  return Math.min(MAX_TOKENS, 16384);
}

function validateTokenLimits(modelDetails: ModelInfo, requestedTokens: number): { valid: boolean; error?: string } {
  const modelMaxTokens = modelDetails.maxTokenAllowed || 128000;
  const maxCompletionTokens = getCompletionTokenLimit(modelDetails);

  // Check against model's context window
  if (requestedTokens > modelMaxTokens) {
    return {
      valid: false,
      error: `Requested tokens (${requestedTokens}) exceed model's context window (${modelMaxTokens}). Please reduce your request size.`,
    };
  }

  // Check against completion token limits
  if (requestedTokens > maxCompletionTokens) {
    return {
      valid: false,
      error: `Requested tokens (${requestedTokens}) exceed model's completion limit (${maxCompletionTokens}). Consider using a model with higher token limits.`,
    };
  }

  return { valid: true };
}

async function llmCallAction({ context, request }: ActionFunctionArgs) {
  /*
   * Bounded read + schema check before any provider call. The previous
   * `request.json<T>()` was a compile-time assertion only: `message` and
   * `system` were unbounded strings and `provider` was destructured before any
   * validation, so `{ provider: {} }` threw a TypeError on `.name` deep inside
   * the handler and surfaced as a 500.
   */
  let body;

  try {
    const rawBody = await readJsonBody(request, { maxBytes: REQUEST_LIMITS.MAX_LLMCALL_BODY_BYTES });

    body = parseBody(llmCallRequestSchema, rawBody, 'llmcall');
  } catch (error) {
    return toApiErrorResponse(error);
  }

  const { system, message, model, streamOutput } = body;
  const provider = asProviderInfo(body.provider);
  const { name: providerName } = provider;

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  if (streamOutput) {
    try {
      const result = await streamText({
        options: {
          system,
        },
        messages: [
          /*
           * Cast: createMessage returns the SDK-independent AnyMessage so the
           * migration module survives the version bump, but the object it
           * builds is a valid UIMessage.
           */
          createMessage({ role: 'user', text: `${message}` }) as unknown as Omit<UIMessage, 'id'>,
        ],
        env: context.cloudflare?.env as any,
        apiKeys,
        providerSettings,
        model,
        provider: providerName,
      });

      return new Response(result.textStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('API key')) {
        return toApiErrorResponse(toMissingCredentialError(providerName, error.message));
      }

      return toApiErrorResponse(error, providerName);
    }
  } else {
    try {
      const models = await getModelList({ apiKeys, providerSettings, serverEnv: context.cloudflare?.env as any });
      const modelDetails = models.find((m: ModelInfo) => m.name === model);

      if (!modelDetails) {
        throw new ApiError(`Model "${model}" is not available for this provider.`, {
          status: 400,
          code: 'unknown_model',
          isRetryable: false,
          provider: providerName,
        });
      }

      const dynamicMaxTokens = modelDetails ? getCompletionTokenLimit(modelDetails) : Math.min(MAX_TOKENS, 16384);

      // Validate token limits before making API request
      const validation = validateTokenLimits(modelDetails, dynamicMaxTokens);

      if (!validation.valid) {
        throw new ApiError(validation.error!, {
          status: 400,
          code: 'token_limit_exceeded',
          isRetryable: false,
          provider: providerName,
        });
      }

      const providerInfo = PROVIDER_LIST.find((p) => p.name === provider.name);

      if (!providerInfo) {
        throw new ApiError(`Provider "${provider.name}" is not a supported provider.`, {
          status: 400,
          code: 'unknown_provider',
          isRetryable: false,
          provider: providerName,
        });
      }

      logger.info(`Generating response Provider: ${provider.name}, Model: ${modelDetails.name}`);

      // DEBUG: Log reasoning model detection
      const isReasoning = isReasoningModel(modelDetails.name);
      logger.info(`DEBUG: Model "${modelDetails.name}" detected as reasoning model: ${isReasoning}`);

      /*
       * v5 folded maxTokens and maxCompletionTokens into maxOutputTokens. The old
       * keys are no longer read, so keeping them meant no output cap at all.
       */
      const tokenParams = { maxOutputTokens: dynamicMaxTokens };

      // Filter out unsupported parameters for reasoning models
      const baseParams = {
        system,
        messages: [
          {
            role: 'user' as const,
            content: `${message}`,
          },
        ],
        model: providerInfo.getModelInstance({
          model: modelDetails.name,
          serverEnv: context.cloudflare?.env as any,
          apiKeys,
          providerSettings,
        }),
        ...tokenParams,
        toolChoice: 'none' as const,
      };

      // For reasoning models, set temperature to 1 (required by OpenAI API)
      const finalParams = isReasoning
        ? { ...baseParams, temperature: 1 } // Set to 1 for reasoning models (only supported value)
        : { ...baseParams, temperature: 0 };

      // DEBUG: Log final parameters
      logger.info(
        `DEBUG: Final params for model "${modelDetails.name}":`,
        JSON.stringify(
          {
            isReasoning,
            hasTemperature: 'temperature' in finalParams,
            hasMaxOutputTokens: 'maxOutputTokens' in finalParams,
            paramKeys: Object.keys(finalParams).filter((key) => !['model', 'messages', 'system'].includes(key)),
            tokenParams,
            finalParams: Object.fromEntries(
              Object.entries(finalParams).filter(([key]) => !['model', 'messages', 'system'].includes(key)),
            ),
          },
          null,
          2,
        ),
      );

      const result = await generateText(finalParams);
      logger.info(`Generated response`);

      return new Response(JSON.stringify(toLlmCallResponse(result)), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error: unknown) {
      /*
       * Token-limit failures are the user's call to make, not a server fault, so
       * they get an actionable 400 rather than falling through to a 500 whose
       * message says only "An unexpected error occurred".
       */
      if (
        error instanceof Error &&
        !isTypedFailure(error) &&
        (error.message.includes('max_tokens') ||
          error.message.includes('token') ||
          error.message.includes('exceeds') ||
          error.message.includes('maximum'))
      ) {
        return toApiErrorResponse(
          new ApiError(
            `Token limit error: ${error.message}. Try reducing your request size or using a model with higher token limits.`,
            { status: 400, code: 'token_limit_exceeded', isRetryable: false, provider: providerName },
          ),
        );
      }

      if (error instanceof Error && error.message.includes('API key')) {
        return toApiErrorResponse(toMissingCredentialError(providerName, error.message));
      }

      return toApiErrorResponse(error, providerName);
    }
  }
}

/** True for an error that already carries a deliberate status. */
function isTypedFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && 'status' in error;
}
