import { ActiveUsers } from './ActiveUsers';
import { useChatPresence } from '~/lib/hooks/useChatPresence';
import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts } from '~/lib/hooks';
import { description, useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROMPT_COOKIE_KEY, PROVIDER_LIST } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import Cookies from 'js-cookie';
import { debounce } from '~/utils/debounce';
import { useSettings } from '~/lib/hooks/useSettings';
import type { ProviderInfo } from '~/types/model';
import { useSearchParams } from '@remix-run/react';
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
import { useAuth } from '~/lib/hooks/useAuth';
import { useRealtimeChat } from '~/lib/hooks/useRealtimeChat';

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory, importChat, exportChat } = useChatHistory();
  const title = useStore(description);
  useEffect(() => {
    workbenchStore.setReloadedMessages(initialMessages.map((m) => m.id));
  }, [initialMessages]);

  return (
    <>
      {ready && (
        <ChatImpl
          description={title}
          initialMessages={initialMessages}
          exportChat={exportChat}
          storeMessageHistory={storeMessageHistory}
          importChat={importChat}
        />
      )}
    </>
  );
}

/*
 * Removed processSampledMessages - now calling parseMessages directly
 * to ensure parsedMessages is always updated, even during real-time updates
 */

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
  importChat: (description: string, messages: Message[]) => Promise<void>;
  exportChat: () => void;
  description?: string;
}

export const ChatImpl = memo(
  ({ description, initialMessages, storeMessageHistory, importChat, exportChat }: ChatProps) => {
    useShortcuts();

    const { setEditing } = useChatPresence();
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
      return savedModel || DEFAULT_MODEL;
    });
    const [provider, setProvider] = useState(() => {
      const savedProvider = Cookies.get('selectedProvider');
      return (PROVIDER_LIST.find((p) => p.name === savedProvider) || DEFAULT_PROVIDER) as ProviderInfo;
    });
    const { showChat } = useStore(chatStore);
    const [animationScope, animate] = useAnimate();
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [chatMode, setChatMode] = useState<'discuss' | 'build'>('build');
    const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
    const mcpSettings = useMCPStore((state) => state.settings);

    const { user } = useAuth();
    const isApplyingRealtimeUpdateRef = useRef(false);
    const initialMessagesRef = useRef(initialMessages);
    const hasSetInitialMessagesRef = useRef(false);
    const [isWaitingForAssistant, setIsWaitingForAssistant] = useState(false);

    // Update initialMessages when they change (for page reload)
    useEffect(() => {
      if (initialMessages.length > 0 && !hasSetInitialMessagesRef.current) {
        initialMessagesRef.current = initialMessages;
        hasSetInitialMessagesRef.current = true;
      } else if (initialMessages.length > 0 && initialMessagesRef.current.length !== initialMessages.length) {
        initialMessagesRef.current = initialMessages;
      }
    }, [initialMessages]);

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
      body: {
        apiKeys,
        files,
        promptId,
        contextOptimization: contextOptimizationEnabled,
        chatMode,
        designScheme,
        supabase: {
          isConnected: supabaseConn.isConnected,
          hasSelectedProject: !!selectedProject,
          credentials: {
            supabaseUrl: supabaseConn?.credentials?.supabaseUrl,
            anonKey: supabaseConn?.credentials?.anonKey,
          },
        },
        maxLLMSteps: mcpSettings.maxLLMSteps,
      },
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
      initialMessages: initialMessagesRef.current,
      initialInput: Cookies.get(PROMPT_COOKIE_KEY) || '',
    });

    // Sync messages when initialMessages change (for page reload)
    useEffect(() => {
      if (initialMessages.length > 0 && messages.length === 0 && !isLoading) {
        setMessages(initialMessages);
      }
    }, [initialMessages, messages.length, isLoading, setMessages]);

    // Debounce real-time updates to batch rapid updates together (for performance)
    const pendingUpdateRef = useRef<any | null>(null);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastProcessedTimestampRef = useRef<number>(0);
    const previousLastMessageRef = useRef<{ id: string; content: string; role: string } | null>(null);

    // Extract update processing logic to a separate function
    const processRealtimeUpdate = useCallback(
      (update: any) => {
        if (!update.messages || update.messages.length === 0) {
          console.log('No messages in update, skipping');
          return;
        }

        // Check if messages actually changed - optimized for performance
        const messageCountIncreased = update.messages.length > messages.length;
        const isCurrentUser = user?.id && update.last_modified_by === user.id;
        const isCurrentlyStreaming = isLoading;

        // Fast path: if count increased, messages definitely changed
        let messagesChanged = messageCountIncreased;

        if (!messageCountIncreased) {
          /*
           * Only do deep comparison if count is same (for streaming updates)
           * Optimize: check last message first (most common case for streaming)
           */
          const lastMessageChanged =
            messages.length > 0 &&
            update.messages.length > 0 &&
            (messages[messages.length - 1]?.id !== update.messages[update.messages.length - 1]?.id ||
              messages[messages.length - 1]?.content !== update.messages[update.messages.length - 1]?.content ||
              messages[messages.length - 1]?.role !== update.messages[update.messages.length - 1]?.role);

          // Only do full comparison if last message changed
          if (lastMessageChanged) {
            messagesChanged =
              messages.length !== update.messages.length ||
              messages.some((msg, idx) => {
                const updateMsg = update.messages[idx];

                if (!updateMsg) {
                  return true;
                }

                return msg.id !== updateMsg.id || msg.content !== updateMsg.content || msg.role !== updateMsg.role;
              });
          }
        }

        /*
         * Always apply if:
         * 1. From a different user (other users' updates) - ALWAYS apply
         * 2. Message count increased (new assistant message added) - ALWAYS apply
         * 3. Messages changed and not currently streaming (to allow streaming updates but prevent loops)
         * 4. Last message content changed AND update has MORE content (for streaming assistant messages from same user)
         */
        const lastMessageContentChanged =
          messages.length > 0 &&
          update.messages.length > 0 &&
          messages[messages.length - 1]?.id === update.messages[update.messages.length - 1]?.id &&
          messages[messages.length - 1]?.content !== update.messages[update.messages.length - 1]?.content &&
          update.messages[update.messages.length - 1]?.role === 'assistant';

        // Check if update has more content than current (to prevent overwriting local streaming with stale data)
        const updateHasMoreContent =
          lastMessageContentChanged &&
          (update.messages[update.messages.length - 1]?.content?.length || 0) >
            (messages[messages.length - 1]?.content?.length || 0);

        // Check if the new assistant message has content (to prevent overwriting with empty streaming state)
        const lastMessageInUpdate = update.messages[update.messages.length - 1];
        const isNewAssistantMessageEmpty =
          messageCountIncreased &&
          lastMessageInUpdate?.role === 'assistant' &&
          (!lastMessageInUpdate?.content || lastMessageInUpdate.content.length === 0);

        /*
         * Check if assistant message already exists and is complete (to prevent re-streaming when user 2 receives it)
         * Scenario: User 1 sends message, assistant streams to user 1 (complete), user 2 receives it, user 1 shouldn't see it re-stream
         * Also check if the assistant response was triggered by the current user's message
         * IMPORTANT: During streaming, the first packet saved to Postgres triggers a real-time update
         * We need to skip it if the local message is still streaming or already has content
         */
        const lastMessageInUpdateId = lastMessageInUpdate?.id;
        const existingAssistantMessage = lastMessageInUpdateId
          ? messages.find((msg) => msg.id === lastMessageInUpdateId && msg.role === 'assistant')
          : null;

        // Find the user message that triggered this assistant response (the message before the assistant in the update)
        const assistantMessageIndex = update.messages.findIndex(
          (msg: Message) => msg.id === lastMessageInUpdateId && msg.role === 'assistant',
        );
        const previousUserMessageInUpdate =
          assistantMessageIndex > 0 ? update.messages[assistantMessageIndex - 1] : null;
        const previousUserMessageExistsLocally =
          previousUserMessageInUpdate?.role === 'user'
            ? messages.some((msg) => msg.id === previousUserMessageInUpdate.id && msg.role === 'user')
            : false;

        /*
         * Check if this assistant response was triggered by the current user's message
         * If the previous user message exists locally, it means the current user sent it
         */
        const isAssistantResponseFromCurrentUser = previousUserMessageExistsLocally && isCurrentUser;

        /*
         * Check if we should skip: assistant message exists locally AND either:
         * 1. Currently streaming (isLoading) - skip to prevent re-showing during streaming
         * 2. Already has content and update doesn't have more content
         */
        const localAssistantHasContent =
          existingAssistantMessage && existingAssistantMessage.content && existingAssistantMessage.content.length > 0;
        const updateHasLessOrEqualContent =
          !lastMessageInUpdate?.content ||
          lastMessageInUpdate.content.length <= (existingAssistantMessage?.content?.length || 0);

        const isAssistantMessageAlreadyComplete =
          isCurrentUser &&
          isAssistantResponseFromCurrentUser && // Only skip if it was triggered by current user
          lastMessageInUpdate?.role === 'assistant' &&
          lastMessageInUpdateId === existingAssistantMessage?.id &&
          existingAssistantMessage &&
          ((isCurrentlyStreaming && localAssistantHasContent) || // Skip if streaming and already has content
            (!isCurrentlyStreaming && localAssistantHasContent && updateHasLessOrEqualContent)); // Skip if complete and update doesn't have more

        const shouldApply =
          !isCurrentUser || // From different user - always apply
          (!isAssistantMessageAlreadyComplete && messageCountIncreased && !isNewAssistantMessageEmpty) || // New message added - apply only if it has content AND not already complete
          (lastMessageContentChanged && updateHasMoreContent) || // Assistant message content changed AND update has more content
          (!isAssistantMessageAlreadyComplete && messagesChanged && !isCurrentlyStreaming); // Messages changed and not streaming - apply (but not if assistant already complete)

        if (shouldApply) {
          console.log('Applying real-time chat update:', {
            reason: !isCurrentUser
              ? 'different user'
              : messageCountIncreased
                ? 'message count increased'
                : 'messages changed',
            currentCount: messages.length,
            updateCount: update.messages.length,
            lastMessageRole: update.messages[update.messages.length - 1]?.role,
            lastModifiedBy: update.last_modified_by,
          });
          isApplyingRealtimeUpdateRef.current = true;

          /*
           * Create a new array with new message objects to ensure React detects the change
           * Deep clone messages to ensure all nested properties are new references
           */
          const newMessages = update.messages.map((msg: Message) => ({
            ...msg,

            // Ensure parts array is also a new reference if it exists
            parts: msg.parts ? [...msg.parts] : undefined,

            // Ensure annotations array is also a new reference if it exists
            annotations: msg.annotations ? [...msg.annotations] : undefined,
          }));

          // Use function form to ensure React detects the change
          setMessages(() => newMessages);

          /*
           * Check if we're waiting for an assistant response
           * Show loader if last message is from another user and is a user message
           * Keep loader showing if assistant message is still streaming (content changing)
           */
          const lastMessage = update.messages[update.messages.length - 1];
          const isLastMessageFromOtherUser = !isCurrentUser && lastMessage?.role === 'user';
          const isLastMessageAssistant = lastMessage?.role === 'assistant';
          const isAssistantFromOtherUser = !isCurrentUser && isLastMessageAssistant;

          /*
           * Check if assistant message is still streaming by comparing with previous update
           * Use ref to track previous update's last message (not old messages state)
           */
          const prevLastMessageFromRef = previousLastMessageRef.current;
          const isAssistantStreaming =
            isLastMessageAssistant &&
            prevLastMessageFromRef?.id === lastMessage?.id &&
            prevLastMessageFromRef?.content !== lastMessage?.content;

          // Update ref for next comparison
          if (lastMessage) {
            previousLastMessageRef.current = {
              id: lastMessage.id,
              content: lastMessage.content,
              role: lastMessage.role,
            };
          }

          if (isLastMessageFromOtherUser) {
            // Show loader when we receive a user message from another user
            setIsWaitingForAssistant(true);
          } else if (isAssistantFromOtherUser) {
            // Assistant message from another user
            const currentLastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            const isNewAssistantMessage = !currentLastMessage || currentLastMessage.id !== lastMessage?.id;

            if (messageCountIncreased || isNewAssistantMessage) {
              // New assistant message added - it's complete, hide loader
              setIsWaitingForAssistant(false);
            } else if (isAssistantStreaming) {
              // Same message ID but content changed - still streaming, keep loader
              setIsWaitingForAssistant(true);
            } else {
              // Same message ID and same content - complete, hide loader
              setIsWaitingForAssistant(false);
            }
          }

          /*
           * Reset flag immediately after React state update is queued
           * Use requestAnimationFrame to ensure it happens after React processes the update
           */
          requestAnimationFrame(() => {
            isApplyingRealtimeUpdateRef.current = false;
          });
          lastProcessedTimestampRef.current = Date.now();
        } else {
          console.log('Skipping real-time update:', {
            isCurrentUser,
            messageCountIncreased,
            messagesChanged,
            isCurrentlyStreaming,
            lastMessageContentChanged,
            updateHasMoreContent,
            isNewAssistantMessageEmpty,
            isAssistantMessageAlreadyComplete,
            isAssistantResponseFromCurrentUser,
            previousUserMessageExistsLocally,
            localAssistantHasContent,
            updateHasLessOrEqualContent,
            reason: isAssistantMessageAlreadyComplete
              ? isCurrentlyStreaming
                ? 'assistant message streaming locally and triggered by current user'
                : 'assistant message already complete locally and triggered by current user'
              : isNewAssistantMessageEmpty
                ? 'new assistant message is empty'
                : isCurrentUser && isCurrentlyStreaming && !updateHasMoreContent
                  ? 'local streaming has more content'
                  : 'other',
          });
        }
      },
      [user?.id, setMessages, messages, isLoading],
    );

    useRealtimeChat(
      useCallback(
        (update) => {
          console.log('🔔 Real-time update received:', {
            messageCount: update.messages?.length || 0,
            lastModifiedBy: update.last_modified_by,
            currentUserId: user?.id,
            lastMessageRole: update.messages?.[update.messages.length - 1]?.role,
            lastMessageId: update.messages?.[update.messages.length - 1]?.id,
            currentMessageCount: messages.length,
          });

          // Store the latest update (always keep the most recent)
          pendingUpdateRef.current = update;

          // Clear existing timeout
          if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
          }

          /*
           * Check if we should apply immediately (if it's been >100ms since last processed update or new message)
           * Also apply immediately for assistant messages from other users (to show streaming updates faster)
           */
          const timeSinceLastProcessed = Date.now() - lastProcessedTimestampRef.current;
          const lastMessage = update.messages[update.messages.length - 1];
          const isAssistantFromOtherUser =
            (!user?.id || update.last_modified_by !== user.id) && lastMessage?.role === 'assistant';
          const shouldApplyImmediately =
            timeSinceLastProcessed > 100 || update.messages.length > messages.length || isAssistantFromOtherUser;

          if (shouldApplyImmediately) {
            // Apply immediately for new messages or if it's been a while
            processRealtimeUpdate(update);
            pendingUpdateRef.current = null;
          } else {
            // Debounce rapid streaming updates (50ms) to batch them together
            updateTimeoutRef.current = setTimeout(() => {
              if (pendingUpdateRef.current) {
                processRealtimeUpdate(pendingUpdateRef.current);
                pendingUpdateRef.current = null;
              }

              updateTimeoutRef.current = null;
            }, 50);
          }
        },
        [user?.id, messages, processRealtimeUpdate],
      ),
    );

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
      };
    }, []);

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

    const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
    const { parsedMessages, parseMessages } = useMessageParser();
    const prevIsLoadingRef = useRef<boolean>(false);

    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    useEffect(() => {
      chatStore.setKey('started', initialMessages.length > 0);
    }, []);

    useEffect(() => {
      // Track when streaming completes (isLoading goes from true to false)
      const streamingJustCompleted = prevIsLoadingRef.current && !isLoading;
      prevIsLoadingRef.current = isLoading;

      // Hide loader when current user starts streaming (their own message)
      if (isLoading) {
        setIsWaitingForAssistant(false);
      }

      /*
       * Always parse messages to update parsedMessages (needed for UI rendering)
       * Even during real-time updates, we need to parse so parsedMessages is updated
       */
      parseMessages(messages, isLoading);

      // Skip saving if we're applying a real-time update
      if (isApplyingRealtimeUpdateRef.current) {
        return;
      }

      /*
       * Save messages to IndexedDB and Supabase (only when not applying real-time update)
       * Only save when:
       * 1. Streaming completes (streamingJustCompleted) - saves complete assistant message
       * 2. New user message added (not during assistant streaming) - saves user message immediately
       */
      const lastMessage = messages[messages.length - 1];
      const isNewUserMessage = lastMessage?.role === 'user' && messages.length > initialMessages.length;
      const shouldSave = streamingJustCompleted || (isNewUserMessage && !isLoading);

      if (shouldSave) {
        storeMessageHistory(messages).catch((error) => toast.error(error.message));
      }
    }, [messages, isLoading, parseMessages]);

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

    // Track editing state when user types
    useEffect(() => {
      const handleFocus = () => setEditing(true);
      const handleBlur = () => setEditing(false);

      if (textareaRef.current) {
        textareaRef.current.addEventListener('focus', handleFocus);
        textareaRef.current.addEventListener('blur', handleBlur);
      }

      return () => {
        if (textareaRef.current) {
          textareaRef.current.removeEventListener('focus', handleFocus);
          textareaRef.current.removeEventListener('blur', handleBlur);
        }
      };
    }, [textareaRef, setEditing]);

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

      let finalMessageContent = messageContent;

      if (selectedElement) {
        console.log('Selected Element:', selectedElement);

        const elementInfo = `<div class=\"__boltSelectedElement__\" data-element='${JSON.stringify(selectedElement)}'>${JSON.stringify(`${selectedElement.displayText}`)}</div>`;
        finalMessageContent = messageContent + elementInfo;
      }

      runAnimation();

      if (!chatStarted) {
        setFakeLoading(true);

        if (autoSelectTemplate) {
          const { template, title } = await selectStarterTemplate({
            message: finalMessageContent,
            model,
            provider,
          });

          if (template !== 'blank') {
            const temResp = await getTemplates(template, title).catch((e) => {
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
      <>
        <ActiveUsers />
        <BaseChat
          ref={animationScope}
          textareaRef={textareaRef}
          input={input}
          showChat={showChat}
          chatStarted={chatStarted}
          isStreaming={isLoading || fakeLoading || isWaitingForAssistant}
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
      </>
    );
  },
);
