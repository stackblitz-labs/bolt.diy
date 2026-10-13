import {
  createUIMessageStreamResponse,
  generateId,
  isStepCount,
  jsonSchema,
  toUIMessageStream,
  type JSONSchema7,
  type UIMessage,
} from 'ai';
import type { ActionFunctionArgs } from 'react-router';
import { createChatUIMessageStream } from '~/lib/.server/api/chat-stream';
import { toApiErrorResponse, toMissingCredentialError, toSafeStreamErrorMessage } from '~/lib/.server/api/errors';
import { readJsonBody } from '~/lib/.server/api/read-body';
import {
  REQUEST_LIMITS,
  asDesignScheme,
  asFileMap,
  asMessages,
  chatRequestSchema,
  parseBody,
} from '~/lib/.server/api/schemas';
import { createAgentLoopTools } from '~/lib/.server/llm/agent-loop';
import { createAgentStreamRecovery } from '~/lib/.server/llm/agent-stream';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, type FileMap } from '~/lib/.server/llm/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { getWebResearchInstructions } from '~/lib/.server/llm/prompt-web-tools';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import { streamText, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { getAgentLoopInstructions, getAgentLoopProgress } from '~/lib/common/agentLoop';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { getStarterBuildProgress } from '~/lib/common/starterBuild';
import { createMessage, getMessageText } from '~/lib/persistence/messageMigration';
import { getPluginToolDescriptions, getPluginTools } from '~/lib/plugins/adapters';
import { getProjectToolNames, projectToolDefinitions } from '~/lib/runtime/projectMcp.shared';
import { withSecurity } from '~/lib/security';
import { MCPService } from '~/lib/services/mcpService';
import type { ContextAnnotation, ProgressAnnotation, ToolCallAnnotation } from '~/types/context';
import type { IProviderSetting } from '~/types/model';
import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.chat');

export const action = withSecurity(chatAction, {
  allowedMethods: ['POST'],
});

async function chatAction({ context, request }: ActionFunctionArgs) {
  /*
   * Validation happens before any provider work, not inside the try block below.
   * `request.json<T>()` only asserts a TypeScript type — at runtime a crafted
   * body with `maxLLMSteps: 100000` or an unbounded `files` map sailed straight
   * into streamText. This reads the body under a byte budget, then checks it
   * against a schema, so malformed input costs one parse and no model calls.
   */
  const rawBody = await readJsonBody(request, { maxBytes: REQUEST_LIMITS.MAX_CHAT_BODY_BYTES });

  let body;

  try {
    body = parseBody(chatRequestSchema, rawBody, 'chat');
  } catch (error) {
    return toApiErrorResponse(error);
  }

  const {
    promptId,
    contextOptimization,
    supabase,
    chatMode,
    agentMode,
    maxLLMSteps,
    webSearchEnabled = true,
    connectorEnabled,
  } = body;

  const messages = asMessages(body.messages);
  const starterBuild = chatMode === 'build' ? getStarterBuildProgress(messages) : getStarterBuildProgress([]);
  const agentLoopEnabled = chatMode === 'build' && (agentMode || starterBuild.status !== 'inactive');
  const agentProgress = getAgentLoopProgress(messages, agentLoopEnabled);
  const agentLoop = createAgentLoopTools(messages, agentLoopEnabled, starterBuild.status !== 'inactive');
  const files = asFileMap(body.files);
  const designScheme = asDesignScheme(body.designScheme);

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings: Record<string, IProviderSetting> = getProviderSettingsFromCookie(cookieHeader);

  /*
   * SwitchableStream is no longer used: its .switches counter was the only
   * thing read and it never advanced, which left the MAX_RESPONSE_SEGMENTS guard
   * dead. Continuation segments are now counted explicitly below.
   */

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };

  let progressCounter: number = 1;

  try {
    const mcpService = MCPService.getInstance();
    const totalMessageContent = messages.reduce((acc, message) => acc + getMessageText(message), '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);

    /*
     * Counts model responses, including the initial response. This used to read SwitchableStream.switches,
     * which is only incremented by switchSource() and is never called, so the
     * MAX_RESPONSE_SEGMENTS guard was dead and a model that kept returning
     * finishReason 'length' could recurse without bound.
     */
    let responseSegments = 1;

    /*
     * Single chunk observer shared by the initial and continuation segments.
     * v7 exposes one stream per streamText call, so progress is observed through
     * onChunk rather than by iterating the stream alongside the UI merge.
     */
    const observeChunk = ({ chunk }: { chunk: unknown }) => {
      const part = chunk as { type?: string };

      if (part.type === 'error') {
        logger.error('Streaming provider error');
      }
    };

    const uiStream = createChatUIMessageStream(messages, {
      async execute({ writer }) {
        const filePaths = getFilePaths(files || {});

        let filteredFiles: FileMap | undefined = undefined;
        let summary: string | undefined = undefined;
        let messageSliceId = 0;

        const isInitialTemplateRequest = messages.some(
          (message) =>
            message.role === 'assistant' &&
            /<boltArtifact\b[^>]*\bid=["']imported-files["']/i.test(getMessageText(message)),
        );

        const processedMessages = await mcpService.processToolInvocations(messages, writer, {
          browserUseCloudEnabled: connectorEnabled?.browserUseCloud === true,
          disabledTools: Object.entries(body.toolEnabled ?? {})
            .filter(([, enabled]) => !enabled)
            .map(([toolName]) => toolName),
        });

        if (processedMessages.length > 3) {
          messageSliceId = processedMessages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization && !isInitialTemplateRequest) {
          logger.debug('Generating Chat Summary');
          writer.write({
            type: 'data-progress',
            data: {
              type: 'progress',
              label: 'summary',
              status: 'in-progress',
              order: progressCounter++,
              message: 'Analysing Request',
            } satisfies ProgressAnnotation,
          });

          // Create a summary of the chat
          console.log(`Messages count: ${processedMessages.length}`);

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
                cumulativeUsage.completionTokens += (resp.usage as any)?.outputTokens || 0;
                cumulativeUsage.promptTokens += (resp.usage as any)?.inputTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });
          writer.write({
            type: 'data-progress',
            data: {
              type: 'progress',
              label: 'summary',
              status: 'complete',
              order: progressCounter++,
              message: 'Analysis Complete',
            } satisfies ProgressAnnotation,
          });

          writer.write({
            type: 'data-chatSummary',
            data: { summary, chatId: processedMessages.slice(-1)?.[0]?.id } as ContextAnnotation,
          });

          // Update context buffer
          logger.debug('Updating Context Buffer');
          writer.write({
            type: 'data-progress',
            data: {
              type: 'progress',
              label: 'context',
              status: 'in-progress',
              order: progressCounter++,
              message: 'Determining Files to Read',
            } satisfies ProgressAnnotation,
          });

          // Select context files
          console.log(`Messages count: ${processedMessages.length}`);
          filteredFiles = await selectContext({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            files: files ?? {},
            providerSettings,
            promptId,
            contextOptimization,
            summary,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('selectContext token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += (resp.usage as any)?.outputTokens || 0;
                cumulativeUsage.promptTokens += (resp.usage as any)?.inputTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
          }

          writer.write({
            type: 'data-codeContext',
            data: {
              files: Object.keys(filteredFiles).map((key) => {
                let path = key;

                if (path.startsWith(WORK_DIR)) {
                  path = path.replace(WORK_DIR, '');
                }

                return path;
              }),
            } as ContextAnnotation,
          });

          writer.write({
            type: 'data-progress',
            data: {
              type: 'progress',
              label: 'context',
              status: 'complete',
              order: progressCounter++,
              message: 'Code Files Selected',
            } satisfies ProgressAnnotation,
          });

          // logger.debug('Code Files Selected');
        }

        const mcpTools = mcpService.getToolsWithoutExecute({
          disabledServers: connectorEnabled?.browserUseCloud === true ? [] : ['browser-use-cloud'],
          disabledTools: Object.entries(body.toolEnabled ?? {})
            .filter(([, enabled]) => !enabled)
            .map(([toolName]) => toolName),
        });

        const enabledPlugins = body.plugins ?? [];

        const pluginTools = getPluginTools(
          enabledPlugins,
          Object.entries(body.toolEnabled ?? {})
            .filter(([, enabled]) => !enabled)
            .map(([toolName]) => toolName),
        );

        const browserUseToolNames = Object.keys(mcpTools).filter(
          (toolName) => mcpService.getToolServerName(toolName) === 'browser-use-cloud',
        );

        const projectTools =
          chatMode === 'build'
            ? Object.fromEntries(
                getProjectToolNames(webSearchEnabled).map((name) => [
                  name,
                  {
                    description: projectToolDefinitions[name].description,
                    inputSchema: jsonSchema(projectToolDefinitions[name].inputSchema as JSONSchema7),
                  },
                ]),
              )
            : {};

        const agentTools = agentProgress.status !== 'inactive' ? agentLoop.tools : {};

        const pluginAndProjectToolNames = [
          ...Object.keys(projectTools),
          ...Object.keys(pluginTools),
          ...Object.keys(agentTools),
        ];

        const collisions = pluginAndProjectToolNames.filter(
          (name, index) => name in mcpTools || pluginAndProjectToolNames.indexOf(name) !== index,
        );

        if (collisions.length > 0) {
          throw new Error(`Built-in MCP tool name conflict: ${collisions.join(', ')}`);
        }

        const tools = { ...mcpTools, ...projectTools, ...pluginTools, ...agentTools };
        const pluginToolDescriptions = getPluginToolDescriptions(enabledPlugins);
        const hasTools = Object.keys(tools).length > 0;
        const recoveringAgent = agentProgress.status === 'pending';

        const recovery = createAgentStreamRecovery(() => {
          writer.write({
            type: 'data-progress',
            data: {
              type: 'progress',
              label: 'response',
              status: 'in-progress',
              order: progressCounter++,
              message: 'Provider response stalled. Retrying the current step; completed work is preserved.',
            } satisfies ProgressAnnotation,
          });
        });
        const mapStreamError = (error: unknown) =>
          toSafeStreamErrorMessage(recoveringAgent ? recovery.getError(error) : error);

        const options: Omit<StreamingOptions, 'messages'> = {
          supabaseConnection: supabase,
          system: [
            getWebResearchInstructions({
              browserUseToolNames,
              webToolNames: Object.keys(projectTools).filter(
                (toolName) => toolName === 'web_search' || toolName === 'web_fetch',
              ),
            }),
            getAgentLoopInstructions(agentProgress),
          ]
            .filter(Boolean)
            .join('\n\n'),

          ...(hasTools
            ? { tools, ...(agentProgress.status !== 'inactive' ? { prepareStep: agentLoop.prepareStep } : {}) }
            : {}),

          /*
           * isStepCount(undefined) can never be true, and supplying it replaces
           * v7's own default of isStepCount(1), so the step cap would be dead.
           */
          /*
           * Agent mode can take several inspect/edit/check cycles, but keeps a
           * hard per-request ceiling even if the user's general step setting is higher.
           */
          stopWhen: isStepCount(agentLoopEnabled ? Math.min(maxLLMSteps ?? 12, 12) : (maxLLMSteps ?? 1)),
          timeout: recoveringAgent ? { stepMs: 660_000, totalMs: 900_000 } : { chunkMs: 45_000 },
          ...(recoveringAgent ? { streamRetries: 0, onError: recovery.onError } : {}),

          abortSignal: request.signal,
          telemetry: { functionId: 'bolt-chat' },
          onStepEnd: ({ toolCalls, finishReason }) => {
            if (finishReason !== 'error') {
              recovery.stepSucceeded();
            }

            toolCalls.forEach((toolCall) => {
              mcpService.processToolCall(toolCall, writer);

              const toolName = toolCall.toolName;

              if (toolName in projectTools) {
                writer.write({
                  type: 'data-toolCall',
                  data: {
                    type: 'toolCall',
                    toolCallId: toolCall.toolCallId,
                    serverName: toolName.startsWith('web_') ? 'Web MCP' : 'Project MCP',
                    toolName,
                    toolDescription:
                      projectToolDefinitions[toolName as keyof typeof projectToolDefinitions].description,
                  } satisfies ToolCallAnnotation,
                });
              } else if (toolName in agentTools) {
                writer.write({
                  type: 'data-toolCall',
                  data: {
                    type: 'toolCall',
                    toolCallId: toolCall.toolCallId,
                    serverName: 'Agent',
                    toolName,
                    toolDescription: String(agentLoop.tools[toolName as keyof typeof agentLoop.tools].description),
                  } satisfies ToolCallAnnotation,
                });
              } else if (toolName in pluginToolDescriptions) {
                const pluginTool = pluginToolDescriptions[toolName];
                writer.write({
                  type: 'data-toolCall',
                  data: {
                    type: 'toolCall',
                    toolCallId: toolCall.toolCallId,
                    serverName: pluginTool.pluginId,
                    toolName,
                    toolDescription: pluginTool.description,
                  } satisfies ToolCallAnnotation,
                });
              }
            });
          },
          onEnd: async ({ text: content, finishReason, usage }) => {
            logger.debug('usage', JSON.stringify(usage));

            if (usage) {
              cumulativeUsage.completionTokens += usage.outputTokens || 0;
              cumulativeUsage.promptTokens += usage.inputTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
            }

            if (finishReason === 'error') {
              return;
            }

            if (finishReason !== 'length') {
              writer.write({
                type: 'data-usage',
                data: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              writer.write({
                type: 'data-progress',
                data: {
                  type: 'progress',
                  label: 'response',
                  status: 'complete',
                  order: progressCounter++,
                  message: 'Response Generated',
                } satisfies ProgressAnnotation,
              });
              await new Promise((resolve) => setTimeout(resolve, 0));

              return;
            }

            if (responseSegments >= MAX_RESPONSE_SEGMENTS) {
              throw Error('Cannot continue message: Maximum segments reached');
            }

            responseSegments += 1;

            const switchesLeft = MAX_RESPONSE_SEGMENTS - responseSegments;

            logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

            const lastUserMessage = processedMessages.filter((x) => x.role == 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            processedMessages.push(createMessage({ id: generateId(), role: 'assistant', text: content }) as UIMessage);
            processedMessages.push(
              createMessage({
                id: generateId(),
                role: 'user',
                text: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}`,
              }) as UIMessage,
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
              agentMode,
              designScheme,
              summary,
              messageSliceId,

              /*
               * Without this the continuation segment produces no activity, so a
               * slow continuation trips the staleness timeout and triggers a
               * spurious recovery attempt.
               */
              onChunk: observeChunk,
            });

            writer.merge(
              toUIMessageStream({
                stream: result.stream,
                sendStart: false,
                sendFinish: false,
                onError: mapStreamError,
              }),
            );

            /*
             * The old code iterated result.fullStream here in parallel with the
             * merge above. In v7 fullStream is the same stream object, so the
             * second consumer starved the first. Chunk observation now happens
             * in onChunk, which fires as the merged consumer reads.
             */
            return;
          },
        };

        writer.write({
          type: 'data-progress',
          data: {
            type: 'progress',
            label: 'response',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Generating Response',
          } satisfies ProgressAnnotation,
        });

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
          agentMode,
          designScheme,
          summary,
          messageSliceId,
          onChunk: observeChunk,
        });

        writer.merge(
          toUIMessageStream({
            stream: result.stream,
            sendStart: false,
            sendFinish: true,

            /*
             * This is the hook that actually decides what the client sees. The
             * model's errors are turned into chunks by *this* `toUIMessageStream`,
             * and its own default is `() => 'An error occurred.'`. Passing the
             * mapper only to the outer `createUIMessageStream` (or to `streamText`)
             * left every failure showing the generic string.
             */
            onError: mapStreamError,
          }),
        );
      },

      /*
       * Staleness detection used to be torn down by the tail of the parallel
       * fullStream loop. With a single consumer, onEnd is the reliable signal
       * that every merged stream has drained.
       */
      onEnd: () => {
        // no-op: stream is managed by merged consumer
      },
      onError: (error: any) => {
        return toSafeStreamErrorMessage(error);
      },
    });

    /*
     * createUIMessageStreamResponse sets the whole SSE header set, including
     * `x-vercel-ai-ui-message-stream: v1`, and pipes the chunk stream through
     * JsonToSseTransformStream. The v4 hand-rolled headers are gone; note that
     * `Text-Encoding: chunked` is meaningless on the Fetch API and was dropped.
     */
    return createUIMessageStreamResponse({
      stream: uiStream,
      keepAliveMs: 15_000,
    });
  } catch (error: unknown) {
    logger.error('Chat route error');

    /*
     * Same credential check as before, but as a typed error so the status,
     * retryability and provider survive into the response body. The client reads
     * those fields to pick its alert type, so they are part of the contract.
     */
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('API key')) {
      return toApiErrorResponse(toMissingCredentialError('unknown', message));
    }

    return toApiErrorResponse(error);
  }
}
