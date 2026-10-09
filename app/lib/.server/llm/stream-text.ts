import {
  convertToModelMessages,
  pruneMessages,
  streamText as _streamText,
  type ModelMessage,
  type UIMessage,
} from 'ai';
import { MAX_TOKENS, PROVIDER_COMPLETION_LIMITS, isReasoningModel, type FileMap } from './constants';
import { withDevelopmentCommentaryWorkstyle } from './prompt-workstyle';
import { createFilesContext, extractPropertiesFromMessage } from './utils';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { discussPrompt } from '~/lib/common/prompts/discuss-prompt';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createMessage, getMessageText } from '~/lib/persistence/messageMigration';
import type { DesignScheme } from '~/types/design-scheme';
import type { IProviderSetting } from '~/types/model';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODIFICATIONS_TAG_NAME, PROVIDER_LIST, WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';
import { allowedHTMLElements } from '~/utils/markdown';

export type Messages = UIMessage[];

/*
 * `prompt` and `messages` are mutually exclusive in v7's Prompt type, and
 * Omit<> is non-distributive over a union, so deriving the whole options type
 * from Parameters<> collapses that XOR and leaves `prompt` as
 * `string | ModelMessage[] | undefined`. Subtracting them keeps the long tail
 * tracking the installed SDK while letting this module own the prompt, which is
 * the only place that builds it.
 */
type DerivedStreamOptions = Omit<
  Parameters<typeof _streamText>[0],
  'model' | 'messages' | 'prompt' | 'instructions' | 'system'
>;

export interface StreamingOptions extends DerivedStreamOptions {
  messages: ModelMessage[];
  system?: string;
  supabaseConnection?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

const logger = createScopedLogger('stream-text');

function getCompletionTokenLimit(modelDetails: any): number {
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

function sanitizeText(text: string): string {
  let sanitized = text.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
  sanitized = sanitized.replace(/<think>.*?<\/think>/s, '');
  sanitized = sanitized.replace(/<boltAction type="file" filePath="package-lock\.json">[\s\S]*?<\/boltAction>/g, '');

  return sanitized.trim();
}

export async function streamText(props: {
  messages: Omit<UIMessage, 'id'>[];
  env?: Env;

  /*
   * `messages` is excluded because this module builds the prompt itself from
   * the top-level `messages` prop; callers only supply the remaining options.
   */
  options?: Omit<StreamingOptions, 'messages'>;
  apiKeys?: Record<string, string>;
  files?: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  contextFiles?: FileMap;
  summary?: string;
  messageSliceId?: number;
  chatMode?: 'discuss' | 'build';
  designScheme?: DesignScheme;

  /*
   * v7 returns a single stream. Callers that used to iterate result.fullStream
   * alongside the merged UI stream must observe chunks here instead, otherwise
   * two consumers race for the same stream.
   */
  onChunk?: (options: { chunk: unknown }) => void;
}) {
  const {
    messages,
    env: serverEnv,
    options,
    apiKeys,
    files,
    providerSettings,
    promptId,
    contextOptimization,
    contextFiles,
    summary,
    chatMode,
    designScheme,
    onChunk,
  } = props;

  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;

  let processedMessages = messages.map((message) => {
    const newMessage = { ...message } as Record<string, any>;

    if (message.role === 'user') {
      const { model, provider } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;
    }

    /*
     * Text is rebuilt through createMessage so it lands in both `content` and
     * `parts`. convertToModelMessages reads only `parts` and dereferences
     * `message.parts.some(...)` on its first statement, so a message left
     * without parts is an immediate TypeError rather than a soft degradation.
     * `data-*` parts are preserved rather than flattened away, because bolt
     * reads annotations back off them.
     */
    const sanitizedParts = Array.isArray(message.parts)
      ? message.parts.map((part) =>
          part?.type === 'text' && typeof part.text === 'string' ? { ...part, text: sanitizeText(part.text) } : part,
        )
      : [];

    if (sanitizedParts.length > 0) {
      newMessage.parts = sanitizedParts;
      newMessage.content = sanitizedParts
        .filter((part: any) => part?.type === 'text' && typeof part.text === 'string')
        .map((part: any) => part.text)
        .join('');
    } else {
      const rebuilt = createMessage({
        role: message.role,
        text: sanitizeText(getMessageText(message)),
      });

      newMessage.parts = rebuilt.parts;
      newMessage.content = rebuilt.content;
    }

    return newMessage;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);

  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Check if it's a Google provider and the model name looks like it might be incorrect
      if (provider.name === 'Google' && currentModel.includes('2.5')) {
        throw new Error(
          `Model "${currentModel}" not found. Gemini 2.5 Pro doesn't exist. Available Gemini models include: gemini-1.5-pro, gemini-2.0-flash, gemini-1.5-flash. Please select a valid model.`,
        );
      }

      // Fallback to first model with warning
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const dynamicMaxTokens = modelDetails ? getCompletionTokenLimit(modelDetails) : Math.min(MAX_TOKENS, 16384);

  // Use model-specific limits directly - no artificial cap needed
  const safeMaxTokens = dynamicMaxTokens;

  logger.info(
    `Token limits for model ${modelDetails.name}: maxTokens=${safeMaxTokens}, maxTokenAllowed=${modelDetails.maxTokenAllowed}, maxCompletionTokens=${modelDetails.maxCompletionTokens}`,
  );

  let systemPrompt =
    PromptLibrary.getPropmtFromLibrary(promptId || 'default', {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: MODIFICATIONS_TAG_NAME,
      designScheme,
      supabase: {
        isConnected: options?.supabaseConnection?.isConnected || false,
        hasSelectedProject: options?.supabaseConnection?.hasSelectedProject || false,
        credentials: options?.supabaseConnection?.credentials || undefined,
      },
    }) ?? getSystemPrompt();

  // Inject workstyle commentary guidance for build mode
  if (chatMode === 'build') {
    systemPrompt = withDevelopmentCommentaryWorkstyle(systemPrompt);
  }

  if (chatMode === 'build' && contextFiles && contextOptimization) {
    const codeContext = createFilesContext(contextFiles, true);

    systemPrompt = `${systemPrompt}

    Below is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.
    CONTEXT BUFFER:
    ---
    ${codeContext}
    ---
    `;

    if (summary) {
      systemPrompt = `${systemPrompt}
      below is the chat history till now
      CHAT SUMMARY:
      ---
      ${props.summary}
      ---
      `;

      processedMessages = pruneMessages({ messages: processedMessages } as any);
    }
  }

  const effectiveLockedFilePaths = new Set<string>();

  if (files) {
    for (const [filePath, fileDetails] of Object.entries(files)) {
      if (fileDetails?.isLocked) {
        effectiveLockedFilePaths.add(filePath);
      }
    }
  }

  if (effectiveLockedFilePaths.size > 0) {
    const lockedFilesListString = Array.from(effectiveLockedFilePaths)
      .map((filePath) => `- ${filePath}`)
      .join('\n');
    systemPrompt = `${systemPrompt}

    IMPORTANT: The following files are locked and MUST NOT be modified in any way. Do not suggest or make any changes to these files. You can proceed with the request but DO NOT make any changes to these files specifically:
    ${lockedFilesListString}
    ---
    `;
  } else {
    console.log('No locked files found from any source for prompt.');
  }

  logger.info(`Sending llm call to ${provider.name} with model ${modelDetails.name}`);

  // Log reasoning model detection and token parameters
  const isReasoning = isReasoningModel(modelDetails.name);
  logger.info(
    `Model "${modelDetails.name}" is reasoning model: ${isReasoning}, using ${isReasoning ? 'maxCompletionTokens' : 'maxTokens'}: ${safeMaxTokens}`,
  );

  // Validate token limits before API call
  if (safeMaxTokens > (modelDetails.maxTokenAllowed || 128000)) {
    logger.warn(
      `Token limit warning: requesting ${safeMaxTokens} tokens but model supports max ${modelDetails.maxTokenAllowed || 128000}`,
    );
  }

  const tokenParams = { maxOutputTokens: safeMaxTokens };

  // Filter out unsupported parameters for reasoning models
  const filteredOptions =
    isReasoning && options
      ? Object.fromEntries(
          Object.entries(options).filter(
            ([key]) =>
              ![
                'temperature',
                'topP',
                'presencePenalty',
                'frequencyPenalty',
                'logprobs',
                'topLogprobs',
                'logitBias',
              ].includes(key),
          ),
        )
      : options || {};

  // DEBUG: Log filtered options
  logger.info(
    `DEBUG STREAM: Options filtering for model "${modelDetails.name}":`,
    JSON.stringify(
      {
        isReasoning,
        originalOptions: options || {},
        filteredOptions,
        originalOptionsKeys: options ? Object.keys(options) : [],
        filteredOptionsKeys: Object.keys(filteredOptions),
        removedParams: options ? Object.keys(options).filter((key) => !(key in filteredOptions)) : [],
      },
      null,
      2,
    ),
  );

  /*
   * supabaseConnection is Bolt's own option, not a v7 one. It is consumed above
   * to build the system prompt, and must not be forwarded, because v7 spreads
   * unknown keys all the way into the model call where they are silently
   * ignored. messages is excluded because this module builds the prompt itself.
   */
  const {
    supabaseConnection: _supabaseConnection,
    messages: _messages,
    ...forwardedOptions
  } = filteredOptions as StreamingOptions & Record<string, unknown>;

  const streamParams = {
    model: provider.getModelInstance({
      model: modelDetails.name,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
    system: chatMode === 'build' ? systemPrompt : discussPrompt(),
    ...tokenParams,
    messages: await convertToModelMessages(processedMessages as any),
    ...forwardedOptions,

    ...(onChunk ? { onChunk } : {}),

    // Set temperature to 1 for reasoning models (required by OpenAI API)
    ...(isReasoning ? { temperature: 1 } : {}),
  };

  // DEBUG: Log final streaming parameters
  logger.info(
    `DEBUG STREAM: Final streaming params for model "${modelDetails.name}":`,
    JSON.stringify(
      {
        hasTemperature: 'temperature' in streamParams,
        hasMaxOutputTokens: 'maxOutputTokens' in streamParams,
        paramKeys: Object.keys(streamParams).filter((key) => !['model', 'messages', 'system'].includes(key)),
        streamParams: Object.fromEntries(
          Object.entries(streamParams).filter(([key]) => !['model', 'messages', 'system'].includes(key)),
        ),
      },
      null,
      2,
    ),
  );

  return await _streamText(streamParams);
}
