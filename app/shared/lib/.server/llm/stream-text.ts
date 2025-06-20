import { convertToCoreMessages, streamText as _streamText, type Message } from 'ai';
import { MAX_TOKENS, type FileMap } from './constants';
import { getSystemPrompt } from '~/shared/lib/prompts/prompt-variants/prompts';
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  MODIFICATIONS_TAG_NAME,
  PROVIDER_LIST,
  WORK_DIR,
} from '~/shared/utils/constants';
import type { IProviderSetting } from '~/shared/types/model';
import { PromptLibrary } from '~/shared/lib/prompts/prompt-library';
import { allowedHTMLElements } from '~/shared/utils/markdown';
import { LLMManager } from '~/shared/lib/providers/manager';
import { createScopedLogger } from '~/shared/utils/logger';
import { createFilesContext, extractPropertiesFromMessage } from './utils';
import { discussPrompt } from '~/shared/lib/prompts/prompt-variants/discuss-prompt';
import type { DesignScheme } from '~/shared/types/design-scheme';

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

interface StreamTextProps {
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
}

interface ProcessedMessage extends Omit<Message, 'id'> {
  content: string;
}

interface ModelInfo {
  details: any;
  maxTokens: number;
  provider: any;
}

const logger = createScopedLogger('stream-text');

// Helper functions for better organization
function processMessages(messages: Omit<Message, 'id'>[]): {
  processedMessages: ProcessedMessage[];
  currentModel: string;
  currentProvider: string;
} {
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;

  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    } else if (message.role === 'assistant') {
      let content = message.content;

      // Remove thought tags
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      // Remove package-lock.json content
      content = content.replace(
        /<boltAction type="file" filePath="package-lock\.json">[\s\S]*?<\/boltAction>/g,
        '[package-lock.json content removed]',
      );
      content = content.trim();

      return { ...message, content };
    }

    return message;
  });

  return { processedMessages, currentModel, currentProvider };
}

async function resolveModelInfo(
  currentProvider: string,
  currentModel: string,
  apiKeys?: Record<string, string>,
  providerSettings?: Record<string, IProviderSetting>,
  serverEnv?: any,
): Promise<ModelInfo> {
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
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const maxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;
  logger.info(
    `Max tokens for model ${modelDetails.name} is ${maxTokens} based on ${modelDetails.maxTokenAllowed} or ${MAX_TOKENS}`,
  );

  return {
    details: modelDetails,
    maxTokens,
    provider,
  };
}

function buildSystemPrompt(props: {
  promptId?: string;
  chatMode?: 'discuss' | 'build';
  contextFiles?: FileMap;
  contextOptimization?: boolean;
  summary?: string;
  files?: FileMap;
  designScheme?: DesignScheme;
  supabaseConnection?: StreamingOptions['supabaseConnection'];
  messageSliceId?: number;
  processedMessages: ProcessedMessage[];
}): { systemPrompt: string; finalMessages: ProcessedMessage[] } {
  const {
    promptId,
    chatMode,
    contextFiles,
    contextOptimization,
    summary,
    files,
    designScheme,
    supabaseConnection,
    messageSliceId,
    processedMessages,
  } = props;

  let systemPrompt =
    PromptLibrary.getPropmtFromLibrary(promptId || 'default', {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: MODIFICATIONS_TAG_NAME,
      designScheme,
      supabase: {
        isConnected: supabaseConnection?.isConnected || false,
        hasSelectedProject: supabaseConnection?.hasSelectedProject || false,
        credentials: supabaseConnection?.credentials || undefined,
      },
    }) ?? getSystemPrompt();

  let finalMessages = [...processedMessages];

  // Add context buffer for build mode
  if (chatMode === 'build' && contextFiles && contextOptimization) {
    const codeContext = createFilesContext(contextFiles, true);
    systemPrompt += `\n\nBelow is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.\nCONTEXT BUFFER:\n---\n${codeContext}\n---\n`;

    // Add chat summary if available
    if (summary) {
      systemPrompt += `\nbelow is the chat history till now\nCHAT SUMMARY:\n---\n${summary}\n---\n`;

      // Slice messages if needed
      if (messageSliceId) {
        finalMessages = processedMessages.slice(messageSliceId);
      } else {
        const lastMessage = processedMessages.pop();

        if (lastMessage) {
          finalMessages = [lastMessage];
        }
      }
    }
  }

  // Add locked files warning
  if (files) {
    const lockedFiles = Object.entries(files)
      .filter(([, fileDetails]) => fileDetails?.isLocked)
      .map(([filePath]) => filePath);

    if (lockedFiles.length > 0) {
      const lockedFilesListString = lockedFiles.map((filePath) => `- ${filePath}`).join('\n');
      systemPrompt += `\n\nIMPORTANT: The following files are locked and MUST NOT be modified in any way. Do not suggest or make any changes to these files. You can proceed with the request but DO NOT make any changes to these files specifically:\n${lockedFilesListString}\n---\n`;
    }
  }

  return { systemPrompt, finalMessages };
}

export async function streamText(props: StreamTextProps) {
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
    messageSliceId,
  } = props;

  // 1. Process messages and extract model info
  const { processedMessages, currentModel, currentProvider } = processMessages(messages);

  // 2. Resolve model information
  const modelInfo = await resolveModelInfo(currentProvider, currentModel, apiKeys, providerSettings, serverEnv);

  // 3. Build system prompt
  const { systemPrompt, finalMessages } = buildSystemPrompt({
    promptId,
    chatMode,
    contextFiles,
    contextOptimization,
    summary,
    files,
    designScheme,
    supabaseConnection: options?.supabaseConnection,
    messageSliceId,
    processedMessages,
  });

  // 4. Make the LLM call
  logger.info(`Sending llm call to ${modelInfo.provider.name} with model ${modelInfo.details.name}`);

  return await _streamText({
    model: modelInfo.provider.getModelInstance({
      model: modelInfo.details.name,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
    system: chatMode === 'build' ? systemPrompt : discussPrompt(),
    maxTokens: modelInfo.maxTokens,
    messages: convertToCoreMessages(finalMessages as any),
    ...options,
  });
}
