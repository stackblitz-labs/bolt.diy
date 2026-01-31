import { useStore } from '@nanostores/react';
import { generateId, type Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts } from '~/lib/hooks';
import { description, useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { getThemeByTemplateName } from '~/theme-prompts/registry';
import type { RestaurantThemeId } from '~/types/restaurant-theme';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROMPT_COOKIE_KEY, PROVIDER_LIST } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import { extractMessageAnnotations } from '~/lib/persistence/annotationHelpers';
import Cookies from 'js-cookie';
import { debounce } from '~/utils/debounce';
import { useSettings } from '~/lib/hooks/useSettings';
import type { ProviderInfo } from '~/types/model';
import { useSearchParams, useLoaderData } from '@remix-run/react';
import { createSampler } from '~/utils/sampler';
import { getTemplates, selectStarterTemplate } from '~/utils/selectStarterTemplate';
import { logStore } from '~/lib/stores/logs';
import { streamingState } from '~/lib/stores/streaming';
import { filesToArtifacts } from '~/utils/fileUtils';
import { supabaseConnection } from '~/lib/stores/supabase';
import { defaultDesignScheme, type DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import type { TextUIPart, FileUIPart, Attachment } from '@ai-sdk/ui-utils';
import { useMCPStore } from '~/lib/stores/mcp';
import type { LlmErrorAlertType } from '~/types/actions';
import { shouldRunInfoCollection } from '~/lib/hooks/useInfoCollectionGate';
import { setActiveSession } from '~/lib/stores/infoCollection';
import type { SessionUpdateAnnotation, TemplateInjectionAnnotation } from '~/types/info-collection';

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { projectId } = useLoaderData<{ id?: string; projectId?: string | null; error?: string | null }>();
  const {
    ready,
    initialMessages,
    loadingState,
    hasOlderMessages,
    loadingOlder,
    loadingOlderError,
    loadOlderMessages,
    storeMessageHistory,
    importChat,
    exportChat,
    clearChatHistory,
  } = useChatHistory(projectId || undefined);
  const title = useStore(description);
  const initialMessageIdsRef = useRef<Set<string> | null>(null);
  const lastProjectIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    /*
     * Reset the ref when the projectId changes (navigating to a different chat).
     * This ensures the new chat's initial messages are properly marked as reloaded.
     */
    if (lastProjectIdRef.current !== projectId) {
      initialMessageIdsRef.current = null;
      lastProjectIdRef.current = projectId;
    }

    /*
     * Only set reloaded messages on initial load, not on subsequent updates.
     * This prevents newly streamed messages from being marked as "reloaded"
     * which would cause their file actions to be skipped.
     *
     * For new chats (no initial messages), set an empty set to mark as initialized.
     */
    if (initialMessageIdsRef.current === null) {
      initialMessageIdsRef.current = new Set(initialMessages.map((m) => m.id));
      workbenchStore.setReloadedMessages(initialMessages.map((m) => m.id));
    }
  }, [initialMessages, projectId]);

  return (
    <>
      {ready && (
        <ChatImpl
          description={title}
          initialMessages={initialMessages}
          loadingState={loadingState}
          hasOlderMessages={hasOlderMessages}
          loadingOlder={loadingOlder}
          loadingOlderError={loadingOlderError}
          loadOlderMessages={loadOlderMessages}
          exportChat={exportChat}
          storeMessageHistory={storeMessageHistory}
          importChat={importChat}
          clearChatHistory={clearChatHistory}
        />
      )}
    </>
  );
}

const processSampledMessages = createSampler(
  (options: {
    messages: Message[];
    initialMessages: Message[];
    isLoading: boolean;
    parseMessages: (messages: Message[], isLoading: boolean) => void;
    storeMessageHistory: (messages: Message[]) => Promise<void>;
  }) => {
    const { messages, initialMessages, isLoading, parseMessages, storeMessageHistory } = options;
    parseMessages(messages, isLoading);

    // Only sync messages after streaming completes to avoid syncing empty content
    if (!isLoading && messages.length > initialMessages.length) {
      const unsyncedMessages = messages.filter((message) => {
        const annotations = extractMessageAnnotations(message);
        return !annotations.includes('hidden') && !annotations.includes('no-store');
      });

      storeMessageHistory(unsyncedMessages).catch((error) => toast.error(error.message));
    }
  },
  50,
);

interface ChatProps {
  initialMessages: Message[];
  loadingState?: import('~/types/message-loading').MessageLoadingState;
  hasOlderMessages: boolean;
  loadingOlder: boolean;
  loadingOlderError: string | null;
  loadOlderMessages: () => Promise<void>;
  storeMessageHistory: (messages: Message[]) => Promise<void>;
  importChat: (description: string, messages: Message[]) => Promise<void>;
  exportChat: () => void;
  clearChatHistory: () => Promise<void>;
  description?: string;
}

export const ChatImpl = memo(
  ({
    description,
    initialMessages,
    loadingState: _loadingState,
    hasOlderMessages,
    loadingOlder,
    loadingOlderError,
    loadOlderMessages,
    storeMessageHistory,
    importChat,
    exportChat,
    clearChatHistory,
  }: ChatProps) => {
    useShortcuts();

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [imageDataList, setImageDataList] = useState<string[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [fakeLoading, setFakeLoading] = useState(false);
    const files = useStore(workbenchStore.files);
    const [designScheme, setDesignScheme] = useState<DesignScheme>(defaultDesignScheme);
    const actionAlert = useStore(workbenchStore.alert);
    const deployAlert = useStore(workbenchStore.deployAlert);
    const supabaseConn = useStore(supabaseConnection);
    const selectedProject = supabaseConn.stats?.projects?.find(
      (project) => project.id === supabaseConn.selectedProjectId,
    );
    const supabaseAlert = useStore(workbenchStore.supabaseAlert);
    const { activeProviders, promptId, autoSelectTemplate, contextOptimizationEnabled } = useSettings();
    const [llmErrorAlert, setLlmErrorAlert] = useState<LlmErrorAlertType | undefined>(undefined);
    const [model, setModel] = useState(() => {
      const savedModel = Cookies.get('selectedModel');
      const selectedModel = savedModel || DEFAULT_MODEL;
      console.log('🤖 [Chat] Model initialized:', {
        savedModel,
        DEFAULT_MODEL,
        selectedModel,
      });

      return selectedModel;
    });
    const [provider, setProvider] = useState(() => {
      const savedProvider = Cookies.get('selectedProvider');
      const selectedProvider = (PROVIDER_LIST.find((p) => p.name === savedProvider) ||
        DEFAULT_PROVIDER) as ProviderInfo;
      console.log('🤖 [Chat] Provider initialized:', {
        savedProvider,
        DEFAULT_PROVIDER: DEFAULT_PROVIDER?.name,
        selectedProvider: selectedProvider.name,
      });

      return selectedProvider;
    });
    const [animationScope, animate] = useAnimate();
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [chatMode, setChatMode] = useState<'discuss' | 'build'>('build');
    const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
    const restaurantThemeIdRef = useRef<RestaurantThemeId | null>(null);
    const mcpSettings = useMCPStore((state) => state.settings);

    const {
      messages,
      isLoading,
      input,
      handleInputChange,
      setInput,
      stop,
      append,
      setMessages,
      reload,
      error,
      data: chatData,
      setData,
      addToolResult,
    } = useChat({
      api: '/api/chat',
      experimental_prepareRequestBody: ({ messages }) => ({
        messages,
        apiKeys,
        files,
        promptId,
        contextOptimization: contextOptimizationEnabled,
        chatMode,
        designScheme,
        restaurantThemeId: restaurantThemeIdRef.current,
        supabase: {
          isConnected: supabaseConn.isConnected,
          hasSelectedProject: !!selectedProject,
          credentials: {
            supabaseUrl: supabaseConn?.credentials?.supabaseUrl,
            anonKey: supabaseConn?.credentials?.anonKey,
          },
        },
        maxLLMSteps: mcpSettings.maxLLMSteps,
      }),
      sendExtraMessageFields: true,
      onError: (e) => {
        setFakeLoading(false);
        handleError(e, 'chat');
      },
      onFinish: (message, response) => {
        const usage = response.usage;
        setData(undefined);

        if (usage) {
          console.log('Token usage:', usage);
          logStore.logProvider('Chat response completed', {
            component: 'Chat',
            action: 'response',
            model,
            provider: provider.name,
            usage,
            messageLength: message.content.length,
          });
        }

        logger.debug('Finished streaming');
      },
      initialMessages,
      initialInput: Cookies.get(PROMPT_COOKIE_KEY) || '',
    });
    useEffect(() => {
      const prompt = searchParams.get('prompt');

      // console.log(prompt, searchParams, model, provider);

      if (prompt) {
        setSearchParams({});
        runAnimation();
        append({
          role: 'user',
          content: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${prompt}`,
        });
      }
    }, [model, provider, searchParams]);

    // Listen for info collection session updates from the data stream
    useEffect(() => {
      if (chatData) {
        const sessionUpdates = chatData.filter(
          (x) => typeof x === 'object' && (x as any).type === 'sessionUpdate',
        ) as unknown as SessionUpdateAnnotation[];

        if (sessionUpdates.length > 0) {
          // Use the most recent session update
          const latestUpdate = sessionUpdates[sessionUpdates.length - 1];
          logger.debug('Received session update from stream', {
            sessionId: latestUpdate.session.id,
            step: latestUpdate.session.currentStep,
          });
          setActiveSession(latestUpdate.session);
        }
      }
    }, [chatData]);

    // Track if we've already processed a template injection to avoid duplicates
    const templateInjectionProcessedRef = useRef<string | null>(null);

    /*
     * Listen for template injection from info collection flow
     * Process IMMEDIATELY when received (don't wait for isLoading to be false)
     * This ensures template files are injected before LLM generates incorrect content
     */
    useEffect(() => {
      if (chatData) {
        const templateInjections = chatData.filter(
          (x) => typeof x === 'object' && (x as any).type === 'templateInjection',
        ) as unknown as TemplateInjectionAnnotation[];

        if (templateInjections.length > 0) {
          const latestInjection = templateInjections[templateInjections.length - 1];
          const injectionKey = `${latestInjection.generation?.templateName}-${latestInjection.chatInjection.assistantMessage.length}`;

          // Only process if we haven't processed this injection yet
          if (templateInjectionProcessedRef.current !== injectionKey) {
            templateInjectionProcessedRef.current = injectionKey;

            logger.info('[TEMPLATE INJECTION] Received template injection from server', {
              templateName: latestInjection.generation?.templateName,
              themeId: latestInjection.generation?.themeId,
              isLoading,
            });

            // IMPORTANT: Stop the current request immediately to prevent LLM from generating wrong content
            if (isLoading) {
              logger.info('[TEMPLATE INJECTION] Stopping current request to inject template');
              stop();
            }

            const { assistantMessage, userMessage } = latestInjection.chatInjection;

            // Set the restaurant theme ID if available
            if (latestInjection.generation?.themeId) {
              restaurantThemeIdRef.current = latestInjection.generation.themeId as RestaurantThemeId;
              logger.info(`[TEMPLATE INJECTION] Setting restaurantThemeId: ${latestInjection.generation.themeId}`);
            }

            /*
             * Inject the template messages into the chat
             * IMPORTANT: We truncate the message history to avoid token explosion.
             * The info collection conversation (5-10 messages with tool calls) is
             * replaced with just:
             * 1. A brief context summary message (hidden from UI)
             * 2. The template assistant message (for WebContainer file parsing)
             * 3. The user continuation message
             *
             * This reduces token usage from ~200K+ to ~150K (just template files).
             */
            const timestamp = Date.now();
            const { generation } = latestInjection;

            // Create a condensed context message summarizing what was collected
            const contextSummary = `[CONTEXT] Website generation for ${generation?.businessName || 'business'} (${generation?.category || 'restaurant'}). Template: ${generation?.templateName}. Theme: ${generation?.themeId}.`;

            const newMessages = [
              /*
               * Brief context summary (hidden from UI but provides LLM context)
               */
              {
                id: `context-summary-${timestamp}`,
                role: 'user' as const,
                content: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${contextSummary}`,
                annotations: ['hidden'],
              },

              /* Template files from assistant */
              {
                id: `template-assistant-${timestamp}`,
                role: 'assistant' as const,
                content: assistantMessage,
              },

              /* Continuation instructions for LLM */
              {
                id: `template-user-${timestamp}`,
                role: 'user' as const,
                content: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userMessage}`,
                annotations: ['hidden'],
              },
            ];

            logger.info('[TEMPLATE INJECTION] Injecting template messages (truncated history)', {
              previousMessagesCount: messages.length,
              newMessagesCount: newMessages.length,
              assistantMessageLength: assistantMessage.length,
              tokenSavingsEstimate: `~${Math.round(messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4)} tokens removed`,
            });

            setMessages(newMessages);

            // Trigger reload to continue processing with the template
            setTimeout(() => {
              logger.info('[TEMPLATE INJECTION] Triggering reload to process template');
              reload();
            }, 100);
          }
        }
      }
    }, [chatData, isLoading, messages, model, provider.name, setMessages, reload, stop]);

    const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
    const { parsedMessages, parseMessages } = useMessageParser();

    const TEXTAREA_MAX_HEIGHT = 400;

    useEffect(() => {
      chatStore.setKey('started', initialMessages.length > 0);

      // Always show workbench side-by-side with chat panel
      workbenchStore.showWorkbench.set(true);

      // Add welcome message for newly created projects
      if (initialMessages.length === 0 && Object.keys(files).length > 0) {
        const { projectName } = chatStore.get();
        const welcomeMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `I've generated the initial draft for ${projectName || 'your project'}. Feel free to ask for any changes!`,
          createdAt: new Date(),
        };
        setMessages([welcomeMessage]);
        setChatStarted(true);
      }
    }, []);

    useEffect(() => {
      processSampledMessages({
        messages,
        initialMessages,
        isLoading,
        parseMessages,
        storeMessageHistory,
      });
    }, [messages, initialMessages, isLoading, parseMessages, storeMessageHistory]);

    const scrollTextArea = () => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    };

    const abort = () => {
      stop();
      chatStore.setKey('aborted', true);
      workbenchStore.abortAllActions();

      logStore.logProvider('Chat response aborted', {
        component: 'Chat',
        action: 'abort',
        model,
        provider: provider.name,
      });
    };

    const handleError = useCallback(
      (error: any, context: 'chat' | 'template' | 'llmcall' = 'chat') => {
        logger.error(`${context} request failed`, error);

        stop();
        setFakeLoading(false);

        let errorInfo = {
          message: 'An unexpected error occurred',
          isRetryable: true,
          statusCode: 500,
          provider: provider.name,
          type: 'unknown' as const,
          retryDelay: 0,
        };

        if (error.message) {
          try {
            const parsed = JSON.parse(error.message);

            if (parsed.error || parsed.message) {
              errorInfo = { ...errorInfo, ...parsed };
            } else {
              errorInfo.message = error.message;
            }
          } catch {
            errorInfo.message = error.message;
          }
        }

        let errorType: LlmErrorAlertType['errorType'] = 'unknown';
        let title = 'Request Failed';

        if (errorInfo.statusCode === 401 || errorInfo.message.toLowerCase().includes('api key')) {
          errorType = 'authentication';
          title = 'Authentication Error';
        } else if (errorInfo.statusCode === 429 || errorInfo.message.toLowerCase().includes('rate limit')) {
          errorType = 'rate_limit';
          title = 'Rate Limit Exceeded';
        } else if (errorInfo.message.toLowerCase().includes('quota')) {
          errorType = 'quota';
          title = 'Quota Exceeded';
        } else if (errorInfo.statusCode >= 500) {
          errorType = 'network';
          title = 'Server Error';
        }

        logStore.logError(`${context} request failed`, error, {
          component: 'Chat',
          action: 'request',
          error: errorInfo.message,
          context,
          retryable: errorInfo.isRetryable,
          errorType,
          provider: provider.name,
        });

        // Create API error alert
        setLlmErrorAlert({
          type: 'error',
          title,
          description: errorInfo.message,
          provider: provider.name,
          errorType,
        });
        setData([]);
      },
      [provider.name, stop],
    );

    const clearApiErrorAlert = useCallback(() => {
      setLlmErrorAlert(undefined);
    }, []);

    useEffect(() => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.style.height = 'auto';

        const scrollHeight = textarea.scrollHeight;

        textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
        textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
      }
    }, [input, textareaRef]);

    const runAnimation = async () => {
      if (chatStarted) {
        return;
      }

      await Promise.all([
        animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
        animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
      ]);

      chatStore.setKey('started', true);

      setChatStarted(true);

      /*
       * workbenchStore.showWorkbench.set(true);
       * console.log("workbenchStore.showWorkbench", workbenchStore.showWorkbench);
       */
    };

    // Helper function to create message parts array from text and images
    const createMessageParts = (text: string, images: string[] = []): Array<TextUIPart | FileUIPart> => {
      // Create an array of properly typed message parts
      const parts: Array<TextUIPart | FileUIPart> = [
        {
          type: 'text',
          text,
        },
      ];

      // Add image parts if any
      images.forEach((imageData) => {
        // Extract correct MIME type from the data URL
        const mimeType = imageData.split(';')[0].split(':')[1] || 'image/jpeg';

        // Create file part according to AI SDK format
        parts.push({
          type: 'file',
          mimeType,
          data: imageData.replace(/^data:image\/[^;]+;base64,/, ''),
        });
      });

      return parts;
    };

    // Helper function to convert File[] to Attachment[] for AI SDK
    const filesToAttachments = async (files: File[]): Promise<Attachment[] | undefined> => {
      if (files.length === 0) {
        return undefined;
      }

      const attachments = await Promise.all(
        files.map(
          (file) =>
            new Promise<Attachment>((resolve) => {
              const reader = new FileReader();

              reader.onloadend = () => {
                resolve({
                  name: file.name,
                  contentType: file.type,
                  url: reader.result as string,
                });
              };
              reader.readAsDataURL(file);
            }),
        ),
      );

      return attachments;
    };

    const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
      const messageContent = messageInput || input;

      if (!messageContent?.trim()) {
        return;
      }

      if (isLoading) {
        abort();
        return;
      }

      console.log('🤖 [Chat] sendMessage called with model:', model, 'provider:', provider.name);

      let finalMessageContent = messageContent;

      if (selectedElement) {
        console.log('Selected Element:', selectedElement);

        const elementInfo = `<div class=\"__boltSelectedElement__\" data-element='${JSON.stringify(selectedElement)}'>${JSON.stringify(`${selectedElement.displayText}`)}</div>`;
        finalMessageContent = messageContent + elementInfo;
      }

      runAnimation();

      if (!chatStarted) {
        setFakeLoading(true);

        /*
         * Check if this is a website generation request that needs info collection first
         */
        const { isWebsiteGen, gateResult } = await shouldRunInfoCollection(finalMessageContent);

        if (isWebsiteGen && gateResult.shouldCollectInfo) {
          /*
           * Website generation intent detected but info collection not complete
           * Skip template selection and let API handle info collection flow
           */
          logger.info('[INFO COLLECTION] Website generation detected, routing to info collection flow');

          /* Update store with active session if exists */
          if (gateResult.activeSession) {
            setActiveSession(gateResult.activeSession);
          }

          // Proceed directly to normal message flow - API will use info collection tools
          console.log('🤖 [Chat] Sending message with model:', model, 'provider:', provider.name);

          const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;
          const attachments = uploadedFiles.length > 0 ? await filesToAttachments(uploadedFiles) : undefined;

          setMessages([
            {
              id: `${new Date().getTime()}`,
              role: 'user',
              content: userMessageText,
              parts: createMessageParts(userMessageText, imageDataList),
              experimental_attachments: attachments,
            },
          ]);
          reload(attachments ? { experimental_attachments: attachments } : undefined);
          setFakeLoading(false);
          setInput('');
          Cookies.remove(PROMPT_COOKIE_KEY);

          setUploadedFiles([]);
          setImageDataList([]);

          resetEnhancer();

          textareaRef.current?.blur();

          return;
        }

        /*
         * If we have a completed info collection session, we could use its data here
         * For now, just proceed with normal template selection
         */
        if (gateResult.completedSession) {
          logger.info(
            `[INFO COLLECTION] Completed session found (${gateResult.completedSession.id}), proceeding to template selection`,
          );
        }

        /*
         * Check if files already exist in workbench (persists across component remounts)
         * This handles the case where website was generated, navigation occurred, and component remounted
         */
        const hasExistingFiles = Object.keys(files).length > 0;

        logger.info('[TEMPLATE_FLOW] Auto-select decision point', {
          autoSelectTemplate,
          templateInjectionProcessed: templateInjectionProcessedRef.current,
          willRunAutoSelect: autoSelectTemplate && !templateInjectionProcessedRef.current && !hasExistingFiles,
          chatStarted,
          hasExistingFiles,
        });

        if (hasExistingFiles) {
          logger.info('[TEMPLATE_FLOW] Skipping template selection - files already exist in workbench');

          /*
           * Files exist from previous generation - use the normal append flow instead of resetting messages
           * Mark chat as started since we have an existing project
           */
          setChatStarted(true);
          chatStore.setKey('started', true);
          setFakeLoading(false);

          // Use append (like the chatStarted flow) instead of setMessages (which resets everything)
          const modifiedFiles = workbenchStore.getModifiedFiles();
          const messageText =
            modifiedFiles !== undefined
              ? `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${filesToArtifacts(modifiedFiles, `${Date.now()}`)}${finalMessageContent}`
              : `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

          const attachmentOptions =
            uploadedFiles.length > 0
              ? { experimental_attachments: await filesToAttachments(uploadedFiles) }
              : undefined;

          append(
            {
              role: 'user',
              content: messageText,
              parts: createMessageParts(messageText, imageDataList),
            },
            attachmentOptions,
          );

          if (modifiedFiles !== undefined) {
            workbenchStore.resetAllFileModifications();
          }

          setInput('');
          Cookies.remove(PROMPT_COOKIE_KEY);
          setUploadedFiles([]);
          setImageDataList([]);
          resetEnhancer();
          textareaRef.current?.blur();

          return;
        } else if (autoSelectTemplate && !templateInjectionProcessedRef.current) {
          const { template, title } = await selectStarterTemplate({
            message: finalMessageContent,
            model,
            provider,
          });

          if (template !== 'blank') {
            logger.info(`[THEME DEBUG] Template selected: "${template}", checking for restaurant theme...`);

            const temResp = await getTemplates(template, title).catch((e) => {
              // Clear restaurantThemeId on template loading failure
              logger.warn(`[THEME DEBUG] Template loading failed for "${template}", clearing restaurantThemeId`);
              restaurantThemeIdRef.current = null;

              if (e.message.includes('rate limit')) {
                toast.warning('Rate limit exceeded. Skipping starter template\n Continuing with blank template');
              } else {
                toast.warning('Failed to import starter template\n Continuing with blank template');
              }

              return null;
            });

            if (temResp) {
              const { assistantMessage, userMessage } = temResp;
              const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

              // Set restaurantThemeId based on selected template
              const selectedTheme = getThemeByTemplateName(template);
              logger.info(`[THEME DEBUG] Looking up theme for template: "${template}"`);

              if (selectedTheme) {
                logger.info(`[THEME DEBUG] Theme found: id="${selectedTheme.id}", label="${selectedTheme.label}"`);
              } else {
                logger.warn(`[THEME DEBUG] No theme found for template: "${template}"`);
              }

              const themeId = selectedTheme?.id || null;
              logger.info(`[THEME DEBUG] Setting restaurantThemeId to: ${themeId || 'null'}`);
              restaurantThemeIdRef.current = themeId;

              setMessages([
                {
                  id: `1-${new Date().getTime()}`,
                  role: 'user',
                  content: userMessageText,
                  parts: createMessageParts(userMessageText, imageDataList),
                },
                {
                  id: `2-${new Date().getTime()}`,
                  role: 'assistant',
                  content: assistantMessage,
                },
                {
                  id: `3-${new Date().getTime()}`,
                  role: 'user',
                  content: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userMessage}`,
                  annotations: ['hidden'],
                },
              ]);

              const reloadOptions =
                uploadedFiles.length > 0
                  ? { experimental_attachments: await filesToAttachments(uploadedFiles) }
                  : undefined;

              reload(reloadOptions);
              setInput('');
              Cookies.remove(PROMPT_COOKIE_KEY);

              setUploadedFiles([]);
              setImageDataList([]);

              resetEnhancer();

              textareaRef.current?.blur();
              setFakeLoading(false);

              return;
            }
          }
        }

        // If autoSelectTemplate is disabled or template selection failed, proceed with normal message
        const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;
        const attachments = uploadedFiles.length > 0 ? await filesToAttachments(uploadedFiles) : undefined;

        setMessages([
          {
            id: `${new Date().getTime()}`,
            role: 'user',
            content: userMessageText,
            parts: createMessageParts(userMessageText, imageDataList),
            experimental_attachments: attachments,
          },
        ]);
        reload(attachments ? { experimental_attachments: attachments } : undefined);
        setFakeLoading(false);
        setInput('');
        Cookies.remove(PROMPT_COOKIE_KEY);

        setUploadedFiles([]);
        setImageDataList([]);

        resetEnhancer();

        textareaRef.current?.blur();

        return;
      }

      if (error != null) {
        setMessages(messages.slice(0, -1));
      }

      const modifiedFiles = workbenchStore.getModifiedFiles();

      chatStore.setKey('aborted', false);

      if (modifiedFiles !== undefined) {
        const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
        const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userUpdateArtifact}${finalMessageContent}`;

        const attachmentOptions =
          uploadedFiles.length > 0 ? { experimental_attachments: await filesToAttachments(uploadedFiles) } : undefined;

        append(
          {
            role: 'user',
            content: messageText,
            parts: createMessageParts(messageText, imageDataList),
          },
          attachmentOptions,
        );

        workbenchStore.resetAllFileModifications();
      } else {
        const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

        const attachmentOptions =
          uploadedFiles.length > 0 ? { experimental_attachments: await filesToAttachments(uploadedFiles) } : undefined;

        append(
          {
            role: 'user',
            content: messageText,
            parts: createMessageParts(messageText, imageDataList),
          },
          attachmentOptions,
        );
      }

      setInput('');
      Cookies.remove(PROMPT_COOKIE_KEY);

      setUploadedFiles([]);
      setImageDataList([]);

      resetEnhancer();

      textareaRef.current?.blur();
    };

    /**
     * Handles the change event for the textarea and updates the input state.
     * @param event - The change event from the textarea.
     */
    const onTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange(event);
    };

    /**
     * Debounced function to cache the prompt in cookies.
     * Caches the trimmed value of the textarea input after a delay to optimize performance.
     */
    const debouncedCachePrompt = useCallback(
      debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const trimmedValue = event.target.value.trim();
        Cookies.set(PROMPT_COOKIE_KEY, trimmedValue, { expires: 30 });
      }, 1000),
      [],
    );

    useEffect(() => {
      const storedApiKeys = Cookies.get('apiKeys');

      if (storedApiKeys) {
        setApiKeys(JSON.parse(storedApiKeys));
      }
    }, []);

    const handleModelChange = (newModel: string) => {
      setModel(newModel);
      Cookies.set('selectedModel', newModel, { expires: 30 });
    };

    const handleProviderChange = (newProvider: ProviderInfo) => {
      setProvider(newProvider);
      Cookies.set('selectedProvider', newProvider.name, { expires: 30 });
    };

    return (
      <BaseChat
        ref={animationScope}
        textareaRef={textareaRef}
        input={input}
        chatStarted={chatStarted}
        isStreaming={isLoading || fakeLoading}
        onStreamingChange={(streaming) => {
          streamingState.set(streaming);
        }}
        enhancingPrompt={enhancingPrompt}
        promptEnhanced={promptEnhanced}
        sendMessage={sendMessage}
        model={model}
        setModel={handleModelChange}
        provider={provider}
        setProvider={handleProviderChange}
        providerList={activeProviders}
        handleInputChange={(e) => {
          onTextareaChange(e);
          debouncedCachePrompt(e);
        }}
        handleStop={abort}
        description={description}
        importChat={importChat}
        exportChat={exportChat}
        clearChatHistory={clearChatHistory}
        hasOlderMessages={hasOlderMessages}
        loadingOlder={loadingOlder}
        loadingOlderError={loadingOlderError}
        onLoadOlderMessages={async () => {
          try {
            await loadOlderMessages();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load older messages';
            toast.error(message);
          }
        }}
        messages={messages.map((message, i) => {
          if (message.role === 'user') {
            return message;
          }

          return {
            ...message,
            content: parsedMessages[i] || '',
          };
        })}
        enhancePrompt={() => {
          enhancePrompt(
            input,
            (input) => {
              setInput(input);
              scrollTextArea();
            },
            model,
            provider,
            apiKeys,
          );
        }}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        imageDataList={imageDataList}
        setImageDataList={setImageDataList}
        actionAlert={actionAlert}
        clearAlert={() => workbenchStore.clearAlert()}
        supabaseAlert={supabaseAlert}
        clearSupabaseAlert={() => workbenchStore.clearSupabaseAlert()}
        deployAlert={deployAlert}
        clearDeployAlert={() => workbenchStore.clearDeployAlert()}
        llmErrorAlert={llmErrorAlert}
        clearLlmErrorAlert={clearApiErrorAlert}
        data={chatData}
        chatMode={chatMode}
        setChatMode={setChatMode}
        append={append}
        designScheme={designScheme}
        setDesignScheme={setDesignScheme}
        selectedElement={selectedElement}
        setSelectedElement={setSelectedElement}
        addToolResult={addToolResult}
      />
    );
  },
);
