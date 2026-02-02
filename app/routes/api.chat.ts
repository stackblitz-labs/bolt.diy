import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createDataStream, generateId } from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, type FileMap } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import type { ContextAnnotation, ProgressAnnotation } from '~/types/context';
import { WORK_DIR } from '~/utils/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import type { DesignScheme } from '~/types/design-scheme';
import { MCPService } from '~/lib/services/mcpService';
import { StreamRecoveryManager } from '~/lib/.server/llm/stream-recovery';
import { requireSessionOrError } from '~/lib/auth/guards.server';
import type { RestaurantThemeId } from '~/types/restaurant-theme';
import { createInfoCollectionTools, retrievePendingGenerationResult } from '~/lib/tools/infoCollectionTools';
import { INFO_COLLECTION_SYSTEM_PROMPT } from '~/lib/prompts/infoCollectionPrompt';
import { infoCollectionService } from '~/lib/services/infoCollectionService.server';
import { PROVIDER_LIST } from '~/utils/constants';
import { createTrace, createGeneration, flushTraces, isLangfuseEnabled } from '~/lib/.server/telemetry/langfuse.server';

export async function action(args: ActionFunctionArgs) {
  // Require authentication for chat API
  const session = await requireSessionOrError(args.request);
  return chatAction(args, session);
}

const logger = createScopedLogger('api.chat');

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

/*
 * ============================================================================
 * Token Estimation and Guard
 * ============================================================================
 * Simple token estimation (~4 chars per token) to detect potential context
 * window overflow before making the LLM call.
 */

const TOKEN_LIMIT_WARNING_THRESHOLD = 150000; // Warn at 150K tokens
const TOKEN_LIMIT_MAX = 190000; // Hard limit at 190K (leaving buffer for response)

/**
 * Estimate token count for a string (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for messages array
 */
function estimateMessagesTokens(messages: Messages): number {
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return total + estimateTokens(content);
  }, 0);
}

/**
 * Truncate messages if they exceed token limit, keeping most recent messages
 * Returns truncated messages and whether truncation occurred
 */
function truncateMessagesIfNeeded(
  messages: Messages,
  maxTokens: number = TOKEN_LIMIT_MAX,
): { messages: Messages; truncated: boolean; originalTokens: number; finalTokens: number } {
  const originalTokens = estimateMessagesTokens(messages);

  if (originalTokens <= maxTokens) {
    return { messages, truncated: false, originalTokens, finalTokens: originalTokens };
  }

  logger.warn(`[TOKEN GUARD] Messages exceed limit: ${originalTokens} > ${maxTokens} tokens. Truncating...`);

  /*
   * Strategy: Keep first message (usually system context) and last N messages
   * Remove middle messages until under limit
   */
  const truncatedMessages: Messages = [];
  let currentTokens = 0;

  // Always keep last 3 messages (most recent context)
  const lastMessages = messages.slice(-3);
  const lastMessagesTokens = estimateMessagesTokens(lastMessages);

  // If even the last 3 messages exceed limit, we have a problem
  if (lastMessagesTokens > maxTokens) {
    logger.error(`[TOKEN GUARD] Even last 3 messages exceed limit: ${lastMessagesTokens} tokens`);

    // Return just the last message as emergency fallback
    const lastMessage = messages[messages.length - 1];

    return {
      messages: [lastMessage],
      truncated: true,
      originalTokens,
      finalTokens: estimateMessagesTokens([lastMessage]),
    };
  }

  // Start with remaining budget after last messages
  const remainingBudget = maxTokens - lastMessagesTokens;

  // Add messages from the beginning until we run out of budget
  for (let i = 0; i < messages.length - 3; i++) {
    const msg = messages[i];
    const msgTokens = estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));

    if (currentTokens + msgTokens <= remainingBudget) {
      truncatedMessages.push(msg);
      currentTokens += msgTokens;
    } else {
      // Add a summary message indicating truncation
      truncatedMessages.push({
        id: 'truncation-notice',
        role: 'system',
        content: `[Previous ${messages.length - 3 - i} messages truncated to fit context window]`,
      } as any);
      break;
    }
  }

  // Add the last messages
  truncatedMessages.push(...lastMessages);

  const finalTokens = estimateMessagesTokens(truncatedMessages);

  logger.info(`[TOKEN GUARD] Truncated messages: ${originalTokens} -> ${finalTokens} tokens`);

  return { messages: truncatedMessages, truncated: true, originalTokens, finalTokens };
}

async function chatAction({ context, request }: ActionFunctionArgs, session: any) {
  const streamRecovery = new StreamRecoveryManager({
    timeout: 45000,
    maxRetries: 2,
    onTimeout: () => {
      logger.warn('Stream timeout - attempting recovery');
    },
  });

  const {
    messages,
    files,
    promptId,
    contextOptimization,
    supabase,
    chatMode,
    designScheme,
    restaurantThemeId,
    maxLLMSteps,
    recentlyEdited,
  } = await request.json<{
    messages: Messages;
    files: any;
    promptId?: string;
    contextOptimization: boolean;
    chatMode: 'discuss' | 'build';
    designScheme?: DesignScheme;
    restaurantThemeId?: RestaurantThemeId | null;
    recentlyEdited?: string[];
    supabase?: {
      isConnected: boolean;
      hasSelectedProject: boolean;
      credentials?: {
        anonKey?: string;
        supabaseUrl?: string;
      };
    };
    maxLLMSteps: number;
  }>();

  logger.info(`[THEME DEBUG] Received restaurantThemeId: ${restaurantThemeId || 'null'}, chatMode: ${chatMode}`);

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');
  const providerSettings: Record<string, IProviderSetting> = JSON.parse(
    parseCookies(cookieHeader || '').providers || '{}',
  );

  // Create Langfuse trace for observability
  const env = context.cloudflare?.env;
  const chatId = messages[messages.length - 1]?.id || 'unknown';
  const lastUserMessage = messages.filter((m) => m.role === 'user').slice(-1)[0];
  const userMessageContent = (() => {
    if (typeof lastUserMessage?.content === 'string') {
      return lastUserMessage.content;
    }

    if (Array.isArray(lastUserMessage?.content)) {
      return (
        (lastUserMessage.content as Array<{ type: string; text?: string }>).find((item) => item.type === 'text')
          ?.text || ''
      );
    }

    return '';
  })();
  const traceContext = createTrace(env, {
    name: 'chat-request',
    userId: session?.user?.id,
    sessionId: chatId,
    metadata: { chatMode, restaurantThemeId, contextOptimization },
    input: { userMessage: userMessageContent.slice(0, 2000) },
  });

  const stream = new SwitchableStream();

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
  const encoder: TextEncoder = new TextEncoder();
  let progressCounter: number = 1;

  try {
    const mcpService = MCPService.getInstance();
    const totalMessageContent = messages.reduce((acc, message) => {
      const textContent = Array.isArray(message.content)
        ? message.content.find((item) => item.type === 'text')?.text || ''
        : message.content;
      return acc + textContent;
    }, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);

    // Detect if this is an info collection conversation
    const isInfoCollectionMode = messages.some((m) => {
      const textContent = Array.isArray(m.content)
        ? m.content.find((item) => item.type === 'text')?.text || ''
        : m.content;
      return (
        textContent.toLowerCase().includes('generate website') ||
        textContent.toLowerCase().includes('create website') ||
        textContent.toLowerCase().includes('build website') ||
        textContent.toLowerCase().includes('new website')
      );
    });

    // Create info collection tools if in that mode
    const userId = session?.user?.id;

    // Extract model and provider from the last user message for info collection tools
    const lastUserMsg = messages.filter((m) => m.role === 'user').slice(-1)[0];
    const { model: extractedModel, provider: extractedProviderName } = lastUserMsg
      ? extractPropertiesFromMessage(lastUserMsg)
      : { model: '', provider: '' };

    /*
     * Find provider info for info collection tools
     * Cast to ProviderInfo since PROVIDER_LIST elements have compatible structure
     */
    const extractedProvider = (extractedProviderName
      ? (PROVIDER_LIST.find((p) => p.name === extractedProviderName) ?? PROVIDER_LIST[0])
      : PROVIDER_LIST[0]) as unknown as import('~/types/model').ProviderInfo | undefined;

    // Get base URL from request for API calls
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const infoCollectionTools =
      isInfoCollectionMode && userId
        ? createInfoCollectionTools({
            userId,
            model: extractedModel,
            provider: extractedProvider,
            baseUrl,
          })
        : {};

    /*
     * Only use tools in 'discuss' mode, not 'build' mode
     * In 'build' mode, the LLM should output <boltArtifact> XML directly
     * Passing tools to the API triggers function-calling mode, which causes
     * the LLM to use <function_calls><invoke> format instead of <boltArtifact>
     */
    const allTools =
      chatMode === 'build'
        ? {}
        : {
            ...mcpService.toolsWithoutExecute,
            ...infoCollectionTools,
          };

    // Modify system prompt if in info collection mode
    const systemPromptAddition = isInfoCollectionMode ? `\n\n${INFO_COLLECTION_SYSTEM_PROMPT}` : '';

    logger.debug(
      `Info collection mode: ${isInfoCollectionMode}, user ID: ${userId || 'none'}, tools count: ${Object.keys(allTools).length}`,
    );
    logger.info(
      `[TOOL CONFIG] chatMode: ${chatMode}, tools enabled: ${Object.keys(allTools).length > 0}, tool names: ${Object.keys(allTools).join(', ') || 'none'}`,
    );

    let lastChunk: string | undefined = undefined;

    const dataStream = createDataStream({
      async execute(dataStream) {
        streamRecovery.startMonitoring();

        const filePaths = getFilePaths(files || {});
        let filteredFiles: FileMap | undefined = undefined;
        let summary: string | undefined = undefined;
        let messageSliceId = 0;

        const processedMessages = await mcpService.processToolInvocations(messages, dataStream);

        if (processedMessages.length > 3) {
          messageSliceId = processedMessages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization) {
          logger.debug('Generating Chat Summary');
          dataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Analysing Request',
          } satisfies ProgressAnnotation);

          // Create a summary of the chat
          console.log(`Messages count: ${processedMessages.length}`);

          // Create Langfuse generation for summary
          const summaryInputMessages = processedMessages.slice(-5).map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content.slice(0, 500) : '[complex content]',
          }));
          const summaryGeneration = traceContext
            ? createGeneration(env, traceContext, {
                name: 'create-summary',
                model: 'default',
                input: { messageCount: processedMessages.length, recentMessages: summaryInputMessages },
              })
            : null;
          const summaryStartTime = performance.now();

          summary = await createSummary({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            providerSettings,
            promptId,
            contextOptimization,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('createSummary token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;

                // End Langfuse generation with usage data
                summaryGeneration?.end({
                  promptTokens: resp.usage.promptTokens,
                  completionTokens: resp.usage.completionTokens,
                  totalTokens: resp.usage.totalTokens,
                  latencyMs: performance.now() - summaryStartTime,
                  output: resp.text?.slice(0, 1000),
                });
              }
            },
          });
          dataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'complete',
            order: progressCounter++,
            message: 'Analysis Complete',
          } satisfies ProgressAnnotation);

          dataStream.writeMessageAnnotation({
            type: 'chatSummary',
            summary,
            chatId: processedMessages.slice(-1)?.[0]?.id,
          } as ContextAnnotation);

          // Update context buffer
          logger.debug('Updating Context Buffer');
          dataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Determining Files to Read',
          } satisfies ProgressAnnotation);

          // Select context files
          console.log(`Messages count: ${processedMessages.length}`);
          filteredFiles = await selectContext({
            messages: [...processedMessages],
            files,
            summary,
            recentlyEdited,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('selectContext token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
          }

          dataStream.writeMessageAnnotation({
            type: 'codeContext',
            files: Object.keys(filteredFiles).map((key) => {
              let path = key;

              if (path.startsWith(WORK_DIR)) {
                path = path.replace(WORK_DIR, '');
              }

              return path;
            }),
          } as ContextAnnotation);

          dataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'complete',
            order: progressCounter++,
            message: 'Code Files Selected',
          } satisfies ProgressAnnotation);

          // logger.debug('Code Files Selected');
        }

        const hasTools = Object.keys(allTools).length > 0;

        // Create Langfuse generation for main streamText
        const mainGeneration = traceContext
          ? createGeneration(env, traceContext, {
              name: 'stream-text-main',
              model: extractedModel || 'unknown',
              input: { userMessage: userMessageContent.slice(0, 2000) },
            })
          : null;
        const mainStartTime = performance.now();

        const options: StreamingOptions = {
          supabaseConnection: supabase,
          ...(hasTools ? { toolChoice: 'auto' as const, tools: allTools } : {}),
          maxSteps: maxLLMSteps,
          onStepFinish: async ({ toolCalls, toolResults }) => {
            // add tool call annotations for frontend processing
            toolCalls.forEach((toolCall) => {
              mcpService.processToolCall(toolCall, dataStream);
            });

            // Check if any info collection tools were called
            const infoCollectionToolNames = [
              'startInfoCollection',
              'collectWebsiteUrl',
              'collectGoogleMapsUrl',
              'collectDescription',
              'updateCollectedInfo',
              'finalizeCollection',
            ];

            const hasInfoCollectionTool = toolCalls.some((toolCall) =>
              infoCollectionToolNames.includes(toolCall.toolName),
            );

            // If info collection tools were called, fetch and stream updated session
            if (hasInfoCollectionTool && userId) {
              try {
                const activeSession = await infoCollectionService.getActiveSession(userId);

                if (activeSession) {
                  logger.debug('Streaming session update', {
                    sessionId: activeSession.id,
                    step: activeSession.currentStep,
                  });
                  dataStream.writeData({
                    type: 'sessionUpdate',
                    session: activeSession,
                  } as unknown as import('ai').JSONValue);
                }
              } catch (error) {
                logger.error('Failed to fetch session for update', error);
              }
            }

            /*
             * Check for finalizeCollection tool result with hasPendingInjection flag.
             * The actual chatInjection is stored in temporary storage (not in tool result)
             * to avoid storing 100K+ tokens of template files in message history,
             * which would cause token explosion when reload() is called.
             */
            const finalizeResult = toolResults?.find(
              (result: any) => result.toolName === 'finalizeCollection' && result.result?.hasPendingInjection,
            );

            if (finalizeResult) {
              const { sessionId, generation } = (finalizeResult as any).result;

              // Retrieve the generation result from temporary storage
              const pendingResult = await retrievePendingGenerationResult(sessionId);

              if (pendingResult?.chatInjection?.assistantMessage) {
                const { chatInjection } = pendingResult;

                logger.info('[TEMPLATE INJECTION] Streaming template content to client', {
                  templateName: generation?.templateName,
                  themeId: generation?.themeId,
                  assistantMessageLength: chatInjection.assistantMessage.length,
                });

                /*
                 * Stream the template injection data to the client
                 * The client will inject these messages to load the template files
                 */
                dataStream.writeData({
                  type: 'templateInjection',
                  chatInjection: {
                    assistantMessage: chatInjection.assistantMessage,
                    userMessage: chatInjection.userMessage,
                  },
                  generation,
                } as unknown as import('ai').JSONValue);
              } else {
                logger.warn('[TEMPLATE INJECTION] No pending generation result found for session', { sessionId });
              }
            }
          },
          onFinish: async ({ text: content, finishReason, usage }) => {
            // Log complete LLM response
            console.log('[LLM RESPONSE COMPLETE]:', content);

            logger.debug('usage', JSON.stringify(usage));

            if (usage) {
              cumulativeUsage.completionTokens += usage.completionTokens || 0;
              cumulativeUsage.promptTokens += usage.promptTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
            }

            // End Langfuse generation with usage data
            mainGeneration?.end({
              promptTokens: usage?.promptTokens,
              completionTokens: usage?.completionTokens,
              totalTokens: usage?.totalTokens,
              latencyMs: performance.now() - mainStartTime,
              output: content?.slice(0, 2000),
              finishReason,
              provider: extractedProviderName,
            });

            if (finishReason !== 'length') {
              dataStream.writeMessageAnnotation({
                type: 'usage',
                value: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              dataStream.writeData({
                type: 'progress',
                label: 'response',
                status: 'complete',
                order: progressCounter++,
                message: 'Response Generated',
              } satisfies ProgressAnnotation);
              await new Promise((resolve) => setTimeout(resolve, 0));

              // stream.close();
              return;
            }

            if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
              throw Error('Cannot continue message: Maximum segments reached');
            }

            const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

            logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

            const lastUserMessage = processedMessages.filter((x) => x.role == 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            processedMessages.push({ id: generateId(), role: 'assistant', content });
            processedMessages.push({
              id: generateId(),
              role: 'user',
              content: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}`,
            });

            logger.info(
              `[THEME DEBUG] Calling streamText (continuation) with restaurantThemeId: ${restaurantThemeId || 'null'}`,
            );

            const result = await streamText({
              messages: [...processedMessages],
              env: context.cloudflare?.env,
              options,
              apiKeys,
              files,
              providerSettings,
              promptId,
              contextOptimization,
              contextFiles: filteredFiles,
              chatMode,
              designScheme,
              restaurantThemeId,
              summary,
              messageSliceId,
              additionalSystemPrompt: systemPromptAddition,
            });

            result.mergeIntoDataStream(dataStream);

            (async () => {
              for await (const part of result.fullStream) {
                if (part.type === 'error') {
                  const error: any = part.error;
                  logger.error(`${error}`);

                  return;
                }
              }
            })();

            return;
          },
        };

        dataStream.writeData({
          type: 'progress',
          label: 'response',
          status: 'in-progress',
          order: progressCounter++,
          message: 'Generating Response',
        } satisfies ProgressAnnotation);

        /*
         * Token Guard: Check and truncate messages if they exceed context window limit
         * This prevents the "prompt is too long" error from the LLM API
         */
        const tokenGuardResult = truncateMessagesIfNeeded(processedMessages as Messages);

        if (tokenGuardResult.truncated) {
          logger.warn(`[TOKEN GUARD] Messages truncated before LLM call`, {
            originalTokens: tokenGuardResult.originalTokens,
            finalTokens: tokenGuardResult.finalTokens,
            originalMessageCount: processedMessages.length,
            finalMessageCount: tokenGuardResult.messages.length,
          });

          // Notify client about truncation
          dataStream.writeData({
            type: 'progress',
            label: 'token-optimization',
            status: 'complete',
            order: progressCounter++,
            message: `Context optimized (${Math.round(tokenGuardResult.originalTokens / 1000)}K → ${Math.round(tokenGuardResult.finalTokens / 1000)}K tokens)`,
          } satisfies ProgressAnnotation);
        } else if (tokenGuardResult.originalTokens > TOKEN_LIMIT_WARNING_THRESHOLD) {
          logger.warn(`[TOKEN GUARD] Messages approaching limit: ${tokenGuardResult.originalTokens} tokens`);
        }

        const messagesToSend = tokenGuardResult.messages;

        logger.info(`[THEME DEBUG] Calling streamText (main) with restaurantThemeId: ${restaurantThemeId || 'null'}`);

        const result = await streamText({
          messages: [...messagesToSend],
          env: context.cloudflare?.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          chatMode,
          designScheme,
          restaurantThemeId,
          summary,
          messageSliceId,
          additionalSystemPrompt: systemPromptAddition,
        });

        (async () => {
          for await (const part of result.fullStream) {
            streamRecovery.updateActivity();

            // Log streaming text chunks
            if (part.type === 'text-delta') {
              console.log('[LLM STREAM]:', part.textDelta);
            }

            if (part.type === 'error') {
              const error: any = part.error;
              logger.error('Streaming error:', error);
              streamRecovery.stop();

              // Enhanced error handling for common streaming issues
              if (error.message?.includes('Invalid JSON response')) {
                logger.error('Invalid JSON response detected - likely malformed API response');
              } else if (error.message?.includes('token')) {
                logger.error('Token-related error detected - possible token limit exceeded');
              }

              return;
            }
          }
          streamRecovery.stop();
        })();
        result.mergeIntoDataStream(dataStream);
      },
      onError: (error: any) => {
        // Provide more specific error messages for common issues
        const errorMessage = error.message || 'Unknown error';

        if (errorMessage.includes('model') && errorMessage.includes('not found')) {
          return 'Custom error: Invalid model selected. Please check that the model name is correct and available.';
        }

        if (errorMessage.includes('Invalid JSON response')) {
          return 'Custom error: The AI service returned an invalid response. This may be due to an invalid model name, API rate limiting, or server issues. Try selecting a different model or check your API key.';
        }

        if (
          errorMessage.includes('API key') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('authentication')
        ) {
          return 'Custom error: Invalid or missing API key. Please check your API key configuration.';
        }

        if (errorMessage.includes('token') && errorMessage.includes('limit')) {
          return 'Custom error: Token limit exceeded. The conversation is too long for the selected model. Try using a model with larger context window or start a new conversation.';
        }

        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          return 'Custom error: API rate limit exceeded. Please wait a moment before trying again.';
        }

        if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          return 'Custom error: Network error. Please check your internet connection and try again.';
        }

        return `Custom error: ${errorMessage}`;
      },
    }).pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          if (!lastChunk) {
            lastChunk = ' ';
          }

          if (typeof chunk === 'string') {
            if (chunk.startsWith('g') && !lastChunk.startsWith('g')) {
              controller.enqueue(encoder.encode(`0: "<div class=\\"__boltThought__\\">"\n`));
            }

            if (lastChunk.startsWith('g') && !chunk.startsWith('g')) {
              controller.enqueue(encoder.encode(`0: "</div>\\n"\n`));
            }
          }

          lastChunk = chunk;

          let transformedChunk = chunk;

          if (typeof chunk === 'string' && chunk.startsWith('g')) {
            let content = chunk.split(':').slice(1).join(':');

            if (content.endsWith('\n')) {
              content = content.slice(0, content.length - 1);
            }

            transformedChunk = `0:${content}\n`;
          }

          // Convert the string stream to a byte stream
          const str = typeof transformedChunk === 'string' ? transformedChunk : JSON.stringify(transformedChunk);
          controller.enqueue(encoder.encode(str));
        },
      }),
    );

    // Flush Langfuse traces before response ends (non-blocking via waitUntil)
    if (isLangfuseEnabled(env)) {
      context.cloudflare?.ctx?.waitUntil(flushTraces(env));
    }

    return new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        'Text-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    logger.error(error);

    const errorResponse = {
      error: true,
      message: error.message || 'An unexpected error occurred',
      statusCode: error.statusCode || 500,
      isRetryable: error.isRetryable !== false, // Default to retryable unless explicitly false
      provider: error.provider || 'unknown',
    };

    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({
          ...errorResponse,
          message: 'Invalid or missing API key',
          statusCode: 401,
          isRetryable: false,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          statusText: 'Unauthorized',
        },
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { 'Content-Type': 'application/json' },
      statusText: 'Error',
    });
  }
}
