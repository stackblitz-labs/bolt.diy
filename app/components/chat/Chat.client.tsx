/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
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
import { createSampler } from '~/utils/sampler';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getTemplates, selectStarterTemplate } from '~/utils/selectStarterTemplate';
import { logStore } from '~/lib/stores/logs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { streamingState } from '~/lib/stores/streaming';
import { filesToArtifacts } from '~/utils/fileUtils';
import { useWebSearch } from '~/lib/hooks/useWebSearch';

// Add a browser-compatible UUID generator
const generateUUID = () => {
  // Use browser's native crypto API if available
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;

    return v.toString(16);
  });
};

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

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
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color palettes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
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

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  },
  50,
);

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

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [imageDataList, setImageDataList] = useState<string[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [fakeLoading, setFakeLoading] = useState(false);
    const files = useStore(workbenchStore.files);
    const actionAlert = useStore(workbenchStore.alert);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { activeProviders, promptId, autoSelectTemplate, contextOptimizationEnabled } = useSettings();

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
    const [isStreaming, setIsStreaming] = useState(false);

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
    } = useChat({
      api: '/api/chat',
      body: {
        apiKeys,
        files,
        promptId,
        contextOptimization: contextOptimizationEnabled,
      },
      sendExtraMessageFields: true,
      onError: (e) => {
        logger.error('Request failed\n\n', e, error);
        logStore.logError('Chat request failed', e, {
          component: 'Chat',
          action: 'request',
          error: e.message,
        });
        toast.error(
          'There was an error processing your request: ' + (e.message ? e.message : 'No details were returned'),
        );
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
          content: [
            {
              type: 'text',
              text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${prompt}`,
            },
          ] as any, // Type assertion to bypass compiler check
        });
      }
    }, [model, provider, searchParams]);

    const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
    const { parsedMessages, parseMessages } = useMessageParser();
    const { searchResults, performSearch, clearSearchResults, isSearching } = useWebSearch();

    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    useEffect(() => {
      chatStore.setKey('started', initialMessages.length > 0);
    }, []);

    useEffect(() => {
      processSampledMessages({
        messages,
        initialMessages,
        isLoading,
        parseMessages,
        storeMessageHistory,
      });
    }, [messages, isLoading, parseMessages]);

    const scrollTextArea = () => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    };

    const abort = useCallback(() => {
      chatStore.setKey('aborted', true);
      stop();
      setIsStreaming(false);
    }, [stop]);

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
    };

    const handleSearch = async (query: string) => {
      try {
        console.log(`handleSearch called with query: "${query}"`);

        const results = await performSearch(query);

        console.log(`Search completed, ${results?.data?.length || 0} results found`);

        return results;
      } catch (error) {
        console.error('Error in handleSearch:', error);
        toast.error('Search failed. Please try again.');

        return null;
      }
    };

    const sendMessage = useCallback(
      async (message: string) => {
        if (!message || isLoading) {
          return;
        }

        setInput('');
        setChatStarted(true);
        setIsStreaming(true);

        try {
          // Check if the message starts with @search command
          const searchCommandRegex = /^@search\s+(.+)$/i;
          const searchMatch = message.match(searchCommandRegex);

          if (searchMatch) {
            let searchQueryToUse = searchMatch[1].trim();

            // Check if the query appears to be asking for code generation
            const codeGenerationTerms = [
              'create a',
              'build a',
              'make a',
              'write a',
              'code a',
              'develop a',
              'generate a',
              'implement a',
              'example of',
              'sample of',
              'top 10',
              'list of',
              'using',
              'with',
            ];

            // Add exception patterns for error messages and debugging queries
            const errorRelatedTerms = [
              'error',
              'exception',
              'bug',
              'crash',
              'failed',
              'failure',
              'not working',
              "doesn't work",
              'issue',
              'problem',
              'debug',
              'fix',
              'troubleshoot',
              'TypeError',
              'ReferenceError',
              'SyntaxError',
              'RangeError',
            ];

            const queryLower = searchQueryToUse.toLowerCase();

            // Check if query contains error-related terms first
            const isErrorRelatedQuery = errorRelatedTerms.some((term) => queryLower.includes(term.toLowerCase()));

            // Only treat as code generation if it's not an error-related query
            const isLikelyCodeRequest =
              !isErrorRelatedQuery &&
              codeGenerationTerms.some((term) => queryLower.includes(term)) &&
              (queryLower.includes('code') ||
                queryLower.includes('app') ||
                queryLower.includes('project') ||
                queryLower.includes('website') ||
                queryLower.includes('application') ||
                queryLower.includes('component') ||
                queryLower.includes('react') ||
                queryLower.includes('vue') ||
                queryLower.includes('angular') ||
                queryLower.includes('html') ||
                queryLower.includes('css') ||
                queryLower.includes('javascript') ||
                queryLower.includes('typescript'));

            if (isLikelyCodeRequest) {
              // Add a clarification that we're using web search to find information, not generate code
              searchQueryToUse = `information about ${searchQueryToUse}`;
              console.log(`Search query appears to be asking for code. Clarifying to: "${searchQueryToUse}"`);

              // Add the user message to the messages with original query
              setMessages([
                ...messages,
                {
                  id: generateUUID(),
                  role: 'user',
                  content: message,
                  createdAt: new Date(),
                },
              ]);

              // Add a clarifying assistant message
              setMessages((prev) => [
                ...prev,
                {
                  id: generateUUID(),
                  role: 'assistant',
                  content: `I'll search the web for information about "${searchMatch[1].trim()}". Note that web search is for finding facts and information, not for generating code directly.`,
                  createdAt: new Date(),
                },
              ]);
            } else {
              // Add the user message to the messages
              setMessages([
                ...messages,
                {
                  id: generateUUID(),
                  role: 'user',
                  content: message,
                  createdAt: new Date(),
                },
              ]);
            }

            // Perform the search
            try {
              console.log(`Processing search for: ${searchQueryToUse}`);

              // Set streaming flag and show loading indicator
              setIsStreaming(true);

              // Show a toast to inform the user that search is in progress
              toast.info(`Searching the web for "${searchQueryToUse}". Results will be added to the chat once found.`, {
                autoClose: 5000,
              });

              // Clear any previous search results first
              clearSearchResults();

              // Perform the search and get results
              const searchPromise = performSearch(searchQueryToUse);

              // Wait longer for the search results to be available
              await searchPromise;

              // Wait for state update to complete (React state updates are asynchronous)
              await new Promise((resolve) => setTimeout(resolve, 500));

              console.log('Search results after waiting:', searchResults);

              // If searchResults is still null after waiting, there was an issue with state updating
              if (!searchResults) {
                console.error('Search state not updated with results after waiting');
                throw new Error('Search state not synchronized');
              }

              // If we have search results, create a new message that includes them for the LLM
              if (searchResults.data && searchResults.data.length > 0) {
                console.log(`Found ${searchResults.data.length} search results, processing...`);

                // Inform user that results were found
                toast.success(`Found ${searchResults.data.length} search results. Adding to chat...`, {
                  autoClose: 3000,
                });

                // Create a formatted version of search results to include in the prompt
                const formattedResults = searchResults.data
                  .map(
                    (item, index) =>
                      `Result ${index + 1}:\nTitle: ${item.title}\nURL: ${item.link}\nSummary: ${item.snippet}`,
                  )
                  .join('\n\n');

                // Create the prompt with search results - make it more explicit about what we want
                const promptWithResults = isErrorRelatedQuery
                  ? `I searched the web for information about this error: "${searchQueryToUse}" and found these results:\n\n${formattedResults}\n\nPlease analyze these search results and provide troubleshooting advice for this specific error. Explain what likely caused the error and how to fix it based on the search information. Include practical steps to resolve the issue.`
                  : `I searched the web for "${searchQueryToUse}" and found these results:\n\n${formattedResults}\n\nPlease summarize the information from these search results. DO NOT generate code or create projects - just analyze and explain the web search results.`;

                // Use the proper append function with search results as content
                const modifiedFiles = workbenchStore.getModifiedFiles();
                chatStore.setKey('aborted', false);

                // Instead of switching models, just make sure the data is ready
                console.log(`Using ${model} from ${provider.name} for web search results processing`);

                try {
                  if (modifiedFiles !== undefined) {
                    const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
                    append({
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userUpdateArtifact}${promptWithResults}`,
                        },
                      ] as any,
                    });

                    workbenchStore.resetAllFileModifications();
                  } else {
                    append({
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${promptWithResults}`,
                        },
                      ] as any,
                    });
                  }

                  // Hide the search results UI since we're incorporating them into the chat
                  clearSearchResults();
                } catch (appendError) {
                  console.error('Error appending search results to chat:', appendError);
                  toast.error('Error adding search results to chat. Please try again.');
                  setIsStreaming(false);
                }
              } else {
                console.log('No search results found, sending fallback message');

                // Inform user that no results were found
                toast.info(`No search results found for "${searchQueryToUse}". Using AI knowledge instead.`, {
                  autoClose: 3000,
                });

                // Handle case where no search results were found
                try {
                  append({
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: isErrorRelatedQuery
                          ? `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\nI searched for information about this error: "${searchQueryToUse}" but didn't find specific results. Based on your knowledge, can you please explain what might be causing this error and suggest troubleshooting steps? Focus on practical advice for fixing the issue.`
                          : `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\nI searched for "${searchQueryToUse}" but didn't find any results. Please provide general information about this topic based on your knowledge. DO NOT generate code or create projects - just provide factual information.`,
                      },
                    ] as any,
                  });
                } catch (appendError) {
                  console.error('Error appending no-results message:', appendError);
                  toast.error('Error processing your request. Please try again.');
                  setIsStreaming(false);
                }
              }
            } catch (error) {
              console.error('Search operation failed:', error);
              toast.error(
                'Search failed. The web search feature may not be working correctly. Try a different query or continue without search.',
                { autoClose: 5000 },
              );
              setIsStreaming(false);
            }

            return;
          }

          // Continue with normal message handling if not a search command
          /*
           * We don't actually use the UUID here, but we keep the line for code clarity
           * as a placeholder for the original code
           */
          generateUUID(); // Generate UUID but don't assign it

          if (error != null) {
            setMessages(messages.slice(0, -1));
          }

          const modifiedFiles = workbenchStore.getModifiedFiles();

          chatStore.setKey('aborted', false);

          if (modifiedFiles !== undefined) {
            const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
            append({
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userUpdateArtifact}${message}`,
                },
                ...imageDataList.map((imageData) => ({
                  type: 'image',
                  image: imageData,
                })),
              ] as any,
            });

            workbenchStore.resetAllFileModifications();
          } else {
            append({
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${message}`,
                },
                ...imageDataList.map((imageData) => ({
                  type: 'image',
                  image: imageData,
                })),
              ] as any,
            });
          }

          Cookies.remove(PROMPT_COOKIE_KEY);

          setUploadedFiles([]);
          setImageDataList([]);

          resetEnhancer();

          textareaRef.current?.blur();
        } catch (error) {
          console.error(error);
        }
      },
      [input, isLoading, messages, error, append, setMessages, workbenchStore, model, provider, imageDataList],
    );

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

    const [messageRef, scrollRef] = useSnapScroll();

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
        showChat={showChat}
        chatStarted={chatStarted}
        isStreaming={isLoading || fakeLoading}
        onStreamingChange={(streaming) => {
          setIsStreaming(streaming);
        }}
        enhancingPrompt={enhancingPrompt}
        _promptEnhanced={promptEnhanced}
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
        sendMessage={sendMessage}
        model={model}
        setModel={handleModelChange}
        provider={provider}
        setProvider={handleProviderChange}
        providerList={activeProviders}
        messageRef={messageRef}
        scrollRef={scrollRef}
        handleInputChange={(e) => {
          onTextareaChange(e);
          debouncedCachePrompt(e);
        }}
        handleKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();

            if (isStreaming) {
              abort();
              return;
            }

            if (input.trim()) {
              sendMessage(input);
            }
          }
        }}
        _handleResetChat={() => {
          setMessages([]);
          chatStore.setKey('started', false);
          setChatStarted(false);
        }}
        _handleRegenerate={() => {
          if (!messages.length) {
            return;
          }

          reload();
        }}
        _handleClearChat={() => {
          setMessages([]);
          chatStore.setKey('started', false);
          setChatStarted(false);
        }}
        handleStop={abort}
        _description={description}
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
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        imageDataList={imageDataList}
        setImageDataList={setImageDataList}
        _actionAlert={actionAlert}
        clearAlert={() => workbenchStore.clearAlert()}
        data={chatData}
        _handleSearch={handleSearch}
        onSearch={handleSearch}
        isSearching={isSearching}
        onClearSearchResults={clearSearchResults}
      />
    );
  },
);
