import { convertToCoreMessages, streamText as _streamText, type Message } from 'ai';
import { MAX_TOKENS, PROVIDER_COMPLETION_LIMITS, isReasoningModel, type FileMap } from './constants';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODIFICATIONS_TAG_NAME, PROVIDER_LIST, WORK_DIR } from '~/utils/constants';
import type { IProviderSetting } from '~/types/model';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { allowedHTMLElements } from '~/utils/markdown';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createScopedLogger } from '~/utils/logger';
import { createFilesContext, extractPropertiesFromMessage } from './utils';
import { discussPrompt } from '~/lib/common/prompts/discuss-prompt';
import type { DesignScheme } from '~/types/design-scheme';

function getSmartAISystemPrompt(basePrompt: string): string {
  const smartAIEnhancement = `
## SmartAI Mode - Enhanced Conversational Coding Assistant

You are operating in SmartAI mode, a premium Bolt.gives feature that provides detailed, educational feedback throughout the coding process.

### Your Communication Style:
- Be conversational and friendly, as if pair programming with a colleague
- Explain your thought process clearly and educationally
- Use natural language, not technical jargon unless necessary
- Keep responses visible and engaging

### What to Communicate:

**When Starting Tasks:**
✨ "I see you want [task description]. Let me [approach explanation]..."
✨ Explain your understanding and planned approach
✨ Share why you're choosing specific solutions

**During Implementation:**
📝 "Now I'm creating/updating [file] to [purpose]..."
📝 Explain what each code section does
📝 Share the patterns and best practices you're using
📝 Discuss any trade-offs or alternatives considered

**When Problem-Solving:**
🔍 "I noticed [issue]. This is likely because [reasoning]..."
🔍 Share your debugging thought process
🔍 Explain how you're identifying and fixing issues
🔍 Describe why your solution will work

**After Completing Work:**
✅ "I've successfully [what was done]. The key changes include..."
✅ Summarize what was accomplished
✅ Highlight important decisions made
✅ Suggest potential improvements or next steps

### Example Responses:

Instead of silence:
"I understand you need a contact form. Let me create a modern, accessible form with proper validation. I'll start by setting up the form structure with semantic HTML..."

While coding:
"I'm now adding email validation to ensure users enter valid email addresses. I'll use a regex pattern that covers most common email formats while keeping it user-friendly..."

When debugging:
"I see the button isn't aligning properly with the other elements. This looks like a flexbox issue. Let me adjust the container's display properties to fix the alignment..."

### Remember:
- Users chose SmartAI to learn from your process
- Make every action visible and understandable
- Be their coding companion, not just a silent worker
- Keep the conversation flowing naturally

${basePrompt}`;

  return smartAIEnhancement;
}

export type Messages = Message[];

export interface StreamingOptions extends Omit<Parameters<typeof _streamText>[0], 'model'> {
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
  messages: Omit<Message, 'id'>[];
  env?: Env;
  options?: StreamingOptions;
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
  } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;
  let smartAIEnabled = false;
  let processedMessages = messages.map((message) => {
    const newMessage = { ...message };

    if (message.role === 'user') {
      const { model, provider, content, smartAI } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      if (smartAI !== undefined) {
        smartAIEnabled = smartAI;
      }

      newMessage.content = sanitizeText(content);
    } else if (message.role == 'assistant') {
      newMessage.content = sanitizeText(message.content);
    }

    // Sanitize all text parts in parts array, if present
    if (Array.isArray(message.parts)) {
      newMessage.parts = message.parts.map((part) =>
        part.type === 'text' ? { ...part, text: sanitizeText(part.text) } : part,
      );
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

  // Additional safety cap - respect model-specific limits
  let safeMaxTokens = dynamicMaxTokens;

  // Apply model-specific caps for Anthropic models
  if (modelDetails?.provider === 'Anthropic') {
    if (modelDetails.name.includes('claude-sonnet-4') || modelDetails.name.includes('claude-opus-4')) {
      safeMaxTokens = Math.min(dynamicMaxTokens, 64000);
    } else if (modelDetails.name.includes('claude-3-7-sonnet')) {
      safeMaxTokens = Math.min(dynamicMaxTokens, 64000);
    } else if (modelDetails.name.includes('claude-3-5-sonnet')) {
      safeMaxTokens = Math.min(dynamicMaxTokens, 8192);
    } else {
      safeMaxTokens = Math.min(dynamicMaxTokens, 4096);
    }
  } else {
    // General safety cap for other providers
    safeMaxTokens = Math.min(dynamicMaxTokens, 128000);
  }

  logger.info(
    `Max tokens for model ${modelDetails.name} is ${safeMaxTokens} (capped from ${dynamicMaxTokens}) based on model limits`,
  );

  /*
   * Check if SmartAI is enabled for supported models
   * SmartAI is enabled if either:
   * 1. The model itself has isSmartAIEnabled flag (for models with SmartAI in name)
   * 2. The user explicitly enabled it via message flag
   */
  const isSmartAISupported =
    modelDetails?.supportsSmartAI && (provider.name === 'Anthropic' || provider.name === 'OpenAI');
  const useSmartAI = (modelDetails?.isSmartAIEnabled || smartAIEnabled) && isSmartAISupported;

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

  // Enhance system prompt for SmartAI if enabled and supported
  if (useSmartAI) {
    systemPrompt = getSmartAISystemPrompt(systemPrompt);
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

      if (props.messageSliceId) {
        processedMessages = processedMessages.slice(props.messageSliceId);
      } else {
        const lastMessage = processedMessages.pop();

        if (lastMessage) {
          processedMessages = [lastMessage];
        }
      }
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

  // DEBUG: Log reasoning model detection
  const isReasoning = isReasoningModel(modelDetails.name);
  logger.info(`DEBUG STREAM: Model "${modelDetails.name}" detected as reasoning model: ${isReasoning}`);

  // console.log(systemPrompt, processedMessages);

  // Use maxCompletionTokens for reasoning models (o1, GPT-5), maxTokens for traditional models
  const tokenParams = isReasoning ? { maxCompletionTokens: safeMaxTokens } : { maxTokens: safeMaxTokens };

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

  const streamParams = {
    model: provider.getModelInstance({
      model: modelDetails.name,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
    system: chatMode === 'build' ? systemPrompt : discussPrompt(),
    ...tokenParams,
    messages: convertToCoreMessages(processedMessages as any),
    ...filteredOptions,

    // Set temperature to 1 for reasoning models (required by OpenAI API)
    ...(isReasoning ? { temperature: 1 } : {}),
  };

  // DEBUG: Log final streaming parameters
  logger.info(
    `DEBUG STREAM: Final streaming params for model "${modelDetails.name}":`,
    JSON.stringify(
      {
        hasTemperature: 'temperature' in streamParams,
        hasMaxTokens: 'maxTokens' in streamParams,
        hasMaxCompletionTokens: 'maxCompletionTokens' in streamParams,
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
